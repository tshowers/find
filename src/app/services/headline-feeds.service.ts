import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { FindRankedResult, FindSearchResponse } from './find-experience.service';

export type HeadlineSection = 'news' | 'sports';

interface HeadlineFeed {
  source: string;
  url: string;
}

// Feeds that block cloud servers (so the backend's hourly RSS job can't read
// them) but allow any website to read them in the browser. NPR is not here:
// its feeds only allow npr.org pages, so a browser on find.taliferro.tech
// can't read them (the iOS app fetches NPR itself).
const BROWSER_FEEDS: Record<HeadlineSection, HeadlineFeed[]> = {
  sports: [
    { source: 'ESPN', url: 'https://www.espn.com/espn/rss/news' },
    { source: 'ESPN', url: 'https://www.espn.com/espn/rss/nfl/news' },
    { source: 'ESPN', url: 'https://www.espn.com/espn/rss/mlb/news' },
  ],
  news: [],
};

const FETCH_TIMEOUT_MS = 4000;
const CACHE_MS = 10 * 60 * 1000;
// Same as the backend's MAX_ARTICLE_AGE_MS and its 20-headline page.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_HEADLINES = 20;
// ESPN posts so often it would fill all 20; each added source gets its 6 newest.
const MAX_PER_ADDED_SOURCE = 6;
// Added stories without a photo go last, and take at most 6 of the 20.
const MAX_WITHOUT_PHOTO = 6;

/**
 * News/Sports headlines from feeds the backend can't reach, fetched in the
 * visitor's browser and merged into the backend's RSS headlines
 * (searchFindRss in todd-backend findRss.service.js). Any failure just
 * means no extra headlines.
 */
@Injectable( { providedIn: 'root' } )
export class HeadlineFeedsService {
  private readonly isBrowser = isPlatformBrowser( inject( PLATFORM_ID ) );
  private readonly cache = new Map<HeadlineSection, { at: number; items: Promise<FindRankedResult[]> }>();

  /** The backend's rssSectionForQuery: which queries are served as headlines. */
  sectionForQuery ( query: string ): HeadlineSection | null {
    const normalized = String( query || '' ).trim().toLowerCase().replace( /[?.!]+$/, '' );
    if ( /^(today'?s|latest|current) news$/.test( normalized ) || normalized === 'news' ) return 'news';
    if ( /^(sports?|sports news)$/.test( normalized ) ) return 'sports';
    return null;
  }

  /** Headlines for this section from the browser-readable feeds (cached 10 minutes). */
  extraHeadlines ( section: HeadlineSection | null ): Promise<FindRankedResult[]> {
    const feeds = section ? BROWSER_FEEDS[section] : [];
    if ( !this.isBrowser || !section || !feeds.length ) return Promise.resolve( [] );
    const cached = this.cache.get( section );
    if ( cached && Date.now() - cached.at < CACHE_MS ) return cached.items;
    const items = Promise.all( feeds.map( feed => this.fetchFeed( feed ) ) ).then( lists => lists.flat() );
    this.cache.set( section, { at: Date.now(), items } );
    // Don't keep an empty result (e.g. offline) for the full 10 minutes.
    items.then( list => { if ( !list.length ) this.cache.delete( section ); } );
    return items;
  }

  /**
   * Backend headlines plus extra ones (6 newest per source): no duplicate
   * links, newest first, 20 at most. Added stories without a photo (ESPN's
   * feeds have none) go after the ones with photos.
   */
  merge ( response: FindSearchResponse, extra: FindRankedResult[] ): FindSearchResponse {
    if ( !extra.length ) return response;
    const cutoff = Date.now() - MAX_AGE_MS;
    // Drop duplicates first: ESPN's top and NFL feeds share stories.
    const seen = new Set( ( response.results || [] ).map( result => result.url ) );
    const perSource = new Map<string, number>();
    const added = extra
      .filter( result => {
        if ( seen.has( result.url ) ) return false;
        seen.add( result.url );
        return true;
      } )
      .sort( ( a, b ) => String( b.publishedAt || '' ).localeCompare( String( a.publishedAt || '' ) ) )
      .filter( result => {
        const count = perSource.get( result.rssSource || '' ) || 0;
        perSource.set( result.rssSource || '', count + 1 );
        return count < MAX_PER_ADDED_SOURCE;
      } );
    const newestFirst = ( list: FindRankedResult[] ) => list
      .filter( result => !result.publishedAt || new Date( result.publishedAt ).getTime() >= cutoff )
      .sort( ( a, b ) => String( b.publishedAt || '' ).localeCompare( String( a.publishedAt || '' ) ) );
    const last = newestFirst( added.filter( result => !result.imageUrl ) ).slice( 0, MAX_WITHOUT_PHOTO );
    const first = newestFirst( [...( response.results || [] ), ...added.filter( result => !!result.imageUrl )] )
      .slice( 0, MAX_HEADLINES - last.length );
    const results = [...first, ...last]
      .slice( 0, MAX_HEADLINES )
      .map( ( result, index ) => ( { ...result, rank: index + 1 } ) );
    return { ...response, results, selectedIndex: 0 };
  }

  private async fetchFeed ( feed: HeadlineFeed ): Promise<FindRankedResult[]> {
    const controller = new AbortController();
    const timeout = setTimeout( () => controller.abort(), FETCH_TIMEOUT_MS );
    try {
      const response = await fetch( feed.url, { signal: controller.signal } );
      if ( !response.ok ) return [];
      return this.parseFeed( await response.text(), feed );
    } catch {
      return [];
    } finally {
      clearTimeout( timeout );
    }
  }

  /** RSS/Atom items as headline results, like the backend's parseFeed. */
  parseFeed ( xml: string, feed: HeadlineFeed ): FindRankedResult[] {
    const doc = new DOMParser().parseFromString( xml, 'text/xml' );
    if ( doc.getElementsByTagName( 'parsererror' ).length ) return [];
    return Array.from( doc.querySelectorAll( 'item, entry' ) ).map( node => {
      const text = ( name: string ) => this.childText( node, name );
      const url = text( 'link' ) || node.querySelector( 'link' )?.getAttribute( 'href' ) || '';
      const title = stripMarkup( text( 'title' ) );
      if ( !title || !/^https?:\/\//i.test( url ) ) return null;
      const published = new Date( text( 'pubDate' ) || text( 'published' ) || text( 'updated' ) );
      return {
        rank: 0,
        title,
        summary: stripMarkup( text( 'description' ) || text( 'summary' ) ),
        url,
        displayUrl: feed.source,
        imageUrl: this.imageFor( node ),
        sourceType: 'publisher',
        confidence: 0.95,
        pills: [],
        rssSource: feed.source,
        publishedAt: Number.isNaN( published.getTime() ) ? new Date().toISOString() : published.toISOString(),
      } as FindRankedResult;
    } ).filter( ( result ): result is FindRankedResult => !!result );
  }

  /** A direct child's text, matched by local name (so dc:date, content:encoded work). */
  private childText ( node: Element, localName: string ): string {
    const child = Array.from( node.children ).find( el => el.localName === localName );
    return child?.textContent?.trim() || '';
  }

  private imageFor ( node: Element ): string {
    for ( const child of Array.from( node.children ) ) {
      if ( [ 'content', 'thumbnail', 'enclosure' ].includes( child.localName ) ) {
        const url = child.getAttribute( 'url' ) || child.getAttribute( 'href' );
        if ( url && ( child.localName !== 'enclosure' || /^image\//.test( child.getAttribute( 'type' ) || 'image/' ) ) ) return url;
      }
    }
    const markup = this.childText( node, 'encoded' ) || this.childText( node, 'description' );
    return markup.match( /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i )?.[1] || '';
  }
}

function stripMarkup ( value: string ): string {
  if ( !value.includes( '<' ) ) return value.replace( /\s+/g, ' ' ).trim();
  return ( new DOMParser().parseFromString( value, 'text/html' ).body.textContent || '' ).replace( /\s+/g, ' ' ).trim();
}
