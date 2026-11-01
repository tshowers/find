import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { FindEntity, FindEntitySection, FindEntitySummary, FindEntityTag, FindExperienceService, FindListRow, FindMusicAppleSection, FindMusicFactsSection, FindMusicTrack } from '../../services/find-experience.service';

interface MusicAction {
  label: string;
  shortLabel: string;
  icon: string;
  href: string;
}

// docs/design_handoff_find_single_results_r5, types 3–5: one card for a song
// (pink), an album (pink) or an artist or band (violet). Same layouts and
// loading behavior as the other single-item cards: A above 900px, B below;
// undefined = loading, null = hidden. No lyrics (they need a licence): the
// song's panel plays Apple's 30-second preview and links to its lyrics on
// Genius. No stream counts or tour data (no free source).
@Component( {
  selector: 'app-find-music-card',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './find-music-card.component.html',
  styleUrls: [ '../entity-card/find-entity-card.component.css', './find-music-card.component.css' ],
} )
export class FindMusicCardComponent implements OnChanges, OnDestroy {
  @Input( { required: true } ) entity!: FindEntity;
  @Input() query = '';
  @Input() moreCount: number | null = null;
  @Output() moreResults = new EventEmitter<void>();

  facts?: FindMusicFactsSection | null;
  apple?: FindMusicAppleSection | null;
  summary?: FindEntitySummary | null;

  expanded = false;
  readonly openSections = new Set<string>();
  imageFailed = false;

  private subs: Subscription[] = [];

  constructor ( private readonly findExperienceService: FindExperienceService ) { }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( changes[ 'entity' ] && this.entity ) this.load();
  }

  ngOnDestroy (): void {
    this.stop();
  }

  private load (): void {
    this.stop();
    this.facts = this.apple = this.summary = undefined;
    this.expanded = false;
    this.openSections.clear();
    this.imageFailed = false;
    this.fetch<FindMusicFactsSection>( 'facts', data => this.facts = data );
    this.fetch<FindMusicAppleSection>( 'apple', data => this.apple = data );
    this.fetch<FindEntitySummary>( 'summary', data => this.summary = data?.text ? data : null );
  }

  private fetch<T> ( section: FindEntitySection, apply: ( data: T | null ) => void ): void {
    this.subs.push( this.findExperienceService.entitySection<T>( this.entity, section ).subscribe( {
      next: response => apply( response?.data ?? null ),
      error: () => apply( null ),
    } ) );
  }

  private stop (): void {
    this.subs.forEach( sub => sub.unsubscribe() );
    this.subs = [];
  }

  // --- Display helpers ---

  get kind (): 'song' | 'album' | 'artist' {
    return this.entity.type === 'song' ? 'song' : this.entity.type === 'album' ? 'album' : 'artist';
  }

  get tint (): 'pink' | 'violet' {
    return this.kind === 'artist' ? 'violet' : 'pink';
  }

  get tags (): FindEntityTag[] {
    const genre = this.facts?.tiles.find( tile => tile.label === 'Genre' )?.value.split( ',' )[ 0 ];
    return [ { text: this.entity.label, tone: this.tint }, ...( genre ? [ { text: genre, tone: 'plain' as const } ] : [] ) ];
  }

  /** The cover (song, album) or the artist's photo. */
  get image (): string | null {
    if ( this.imageFailed ) return null;
    return this.kind === 'artist' ? this.facts?.imageUrl || null : this.apple?.artworkUrl || null;
  }

  get meta (): string[] {
    const facts = this.facts;
    if ( !facts ) return [];
    const tile = ( label: string ) => facts.tiles.find( item => item.label === label )?.value || '';
    if ( this.kind === 'song' ) return [ facts.artist, facts.album || this.apple?.album || '', tile( 'Length' ) || this.apple?.track?.length || '' ].filter( Boolean );
    if ( this.kind === 'album' ) {
      const tracks = this.apple?.trackCount;
      return [ facts.artist, ( facts.released || '' ).slice( 0, 4 ), tracks ? `${ tracks } tracks` : '', this.apple?.length || tile( 'Length' ) ].filter( Boolean );
    }
    return [ tile( 'From' ), tile( 'Active since' ) && `Since ${ tile( 'Active since' ) }` ].filter( Boolean );
  }

  get tiles () {
    const tiles = [ ...( this.facts?.tiles || [] ) ];
    if ( this.kind === 'album' && this.apple?.trackCount && !tiles.some( tile => tile.label === 'Tracks' ) ) {
      tiles.splice( 1, 0, { label: 'Tracks', value: String( this.apple.trackCount ), sub: this.apple.length || '' } );
    }
    if ( this.kind === 'artist' && this.apple?.albumCount ) {
      tiles.splice( 2, 0, { label: 'Albums', value: String( this.apple.albumCount ), sub: 'On Apple Music' } );
    }
    return tiles.slice( 0, 6 );
  }

  /** The tracklist's first six; the rest under Show more. */
  get firstTracks (): FindMusicTrack[] {
    return ( this.apple?.tracks || [] ).slice( 0, 6 );
  }

  get moreTracks (): FindMusicTrack[] {
    return ( this.apple?.tracks || [] ).slice( 6 );
  }

  get searchText (): string {
    return [ this.entity.name, this.kind !== 'artist' ? this.facts?.artist : '' ].filter( Boolean ).join( ' ' );
  }

  /** Spotify, Apple Music, YouTube: the item's own pages, else a search there. */
  get listen (): MusicAction[] {
    const links = this.facts?.links;
    const text = encodeURIComponent( this.searchText );
    return [
      { label: 'Spotify', shortLabel: 'Spotify', icon: 'fa-play', href: links?.spotify || `https://open.spotify.com/search/${ text }` },
      { label: 'Apple Music', shortLabel: 'Apple Music', icon: 'fa-music', href: this.apple?.links.apple || `https://music.apple.com/us/search?term=${ text }` },
      { label: 'YouTube Music', shortLabel: 'YouTube', icon: 'fa-play', href: `https://music.youtube.com/search?q=${ text }` },
    ];
  }

  /** Where a song's lyrics are: its Genius page, else a Genius search. */
  get lyricsUrl (): string {
    return this.facts?.links.genius || `https://genius.com/search?q=${ encodeURIComponent( this.searchText ) }`;
  }

  get actions (): MusicAction[] {
    const links = this.facts?.links;
    const text = encodeURIComponent( this.searchText );
    const actions: Array<MusicAction | null | ''> = this.kind === 'song'
      ? [
        { label: 'Lyrics', shortLabel: 'Lyrics', icon: 'fa-align-left', href: this.lyricsUrl },
        { label: 'Music video', shortLabel: 'Video', icon: 'fa-video', href: links?.youtube || `https://www.youtube.com/results?search_query=${ text }%20official%20video` },
        this.apple?.links.appleArtist ? { label: this.facts?.artist || 'Artist', shortLabel: 'Artist', icon: 'fa-user', href: this.apple.links.appleArtist } : null,
        links?.wikipedia ? { label: 'Wikipedia', shortLabel: 'Wikipedia', icon: 'fa-arrow-up-right-from-square', href: links.wikipedia } : null,
      ]
      : this.kind === 'album'
        ? [
          { label: 'Lyrics', shortLabel: 'Lyrics', icon: 'fa-align-left', href: links?.genius || `https://genius.com/search?q=${ text }` },
          this.apple?.links.appleArtist ? { label: this.facts?.artist || 'Artist', shortLabel: 'Artist', icon: 'fa-user', href: this.apple.links.appleArtist } : null,
          links?.wikipedia ? { label: 'Wikipedia', shortLabel: 'Wikipedia', icon: 'fa-arrow-up-right-from-square', href: links.wikipedia } : null,
        ]
        : [
          // Tour dates: no free source, so a search where tickets are sold.
          { label: 'Tour dates', shortLabel: 'Tour', icon: 'fa-ticket', href: `https://www.ticketmaster.com/search?q=${ encodeURIComponent( this.entity.name ) }` },
          links?.website ? { label: 'Official site', shortLabel: 'Site', icon: 'fa-globe', href: links.website } : null,
          links?.wikipedia ? { label: 'Wikipedia', shortLabel: 'Wikipedia', icon: 'fa-arrow-up-right-from-square', href: links.wikipedia } : null,
        ];
    return actions.filter( ( action ): action is MusicAction => !!action );
  }

  /** B's status pill: "Song · Taylor Swift", "New: Moon Music · Oct 4". */
  get statusText (): string {
    if ( this.kind === 'artist' ) {
      const latest = this.apple?.latest;
      return latest ? `New ${ latest.kind.toLowerCase() }: ${ latest.name }` : '';
    }
    return this.facts?.artist ? `${ this.entity.label } · ${ this.facts.artist }` : '';
  }

  releaseDay ( iso: string | null | undefined ): string {
    const time = Date.parse( iso || '' );
    return Number.isFinite( time ) ? new Date( time ).toLocaleDateString( [], { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' } ) : '';
  }

  get hasMore (): boolean {
    return this.kind === 'album' ? this.moreTracks.length > 0 || !!this.facts?.credits.length
      : this.kind === 'artist' ? !!this.apple?.albums?.length || !!this.facts?.members.length
        : !!this.facts?.credits.length;
  }

  /** An album's tracks are numbered; an artist's top songs aren't (their numbers are from their own albums). */
  trackRows ( tracks: FindMusicTrack[] | undefined, numbered = true ): FindListRow[] {
    return ( tracks || [] ).map( track => ( { name: `${ numbered && track.number ? `${ track.number }. ` : '' }${ track.name }`, value: track.length, sub: track.album || '', url: track.url } ) );
  }

  firstRow ( rows: FindListRow[] | undefined ): string {
    const row = rows?.[ 0 ];
    return row ? [ row.name, row.value ].filter( Boolean ).join( ' · ' ) : '';
  }

  // --- Layout B accordion ---

  toggleSection ( section: string ): void {
    if ( this.openSections.has( section ) ) this.openSections.delete( section );
    else this.openSections.add( section );
  }

}
