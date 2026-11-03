import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { FindEntity, FindEntitySection, FindEntitySummary, FindExperienceService, FindListRow, FindMediaTitleSection, FindMovieFactsSection, FindStatTile, FindTvEpisode, FindTvShowSection } from '../../services/find-experience.service';

interface MediaAction {
  label: string;
  shortLabel: string;
  icon: string;
  href: string;
}

// The rating logos production already uses on the movie result.
const SCORE_ICONS: Record<string, string> = {
  imdb: '/assets/find/ratings/imdb.svg',
  rt: '/assets/find/ratings/rotten-tomatoes.svg',
  mc: '/assets/find/ratings/metacritic.svg',
};

// docs/design_handoff_find_single_results_r5, types 1–2: one card for a movie
// (violet) or a TV show (cyan). Same layouts and loading behavior as the
// other single-item cards: A above 900px, B below; undefined = loading,
// null = hidden. Scores show only the sources OMDb returned. No showtimes
// or streaming prices (no free source): a movie links out for tickets or
// where to watch, a show to its own service.
@Component( {
  selector: 'app-find-media-card',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './find-media-card.component.html',
  styleUrls: [ '../entity-card/find-entity-card.component.css', './find-media-card.component.css' ],
} )
export class FindMediaCardComponent implements OnChanges, OnDestroy {
  @Input( { required: true } ) entity!: FindEntity;
  @Input() query = '';
  @Input() moreCount: number | null = null;
  @Output() moreResults = new EventEmitter<void>();

  title?: FindMediaTitleSection | null;
  facts?: FindMovieFactsSection | null;
  show?: FindTvShowSection | null;
  summary?: FindEntitySummary | null;

  expanded = false;
  readonly openSections = new Set<string>();
  posterFailed = false;

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
    this.title = this.facts = this.show = this.summary = undefined;
    this.expanded = false;
    this.openSections.clear();
    this.posterFailed = false;
    this.fetch<FindMediaTitleSection>( 'title', data => this.title = data );
    if ( this.isMovie ) {
      this.fetch<FindMovieFactsSection>( 'facts', data => this.facts = data );
      this.show = null;
    } else {
      this.fetch<FindTvShowSection>( 'show', data => this.show = data );
      this.facts = null;
    }
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

  // Getters here build new objects on every check; tracking by position keeps
  // the rows in place instead of rebuilding them. iPhone Safari drops a tap
  // when the page rebuilds under it (the award screen's Continue did nothing).
  trackByIndex ( index: number ): number {
    return index;
  }

  get isMovie (): boolean {
    return this.entity.type === 'movie';
  }

  get tint (): 'violet' | 'cyan' {
    return this.isMovie ? 'violet' : 'cyan';
  }

  get poster (): string | null {
    return this.posterFailed ? null : this.title?.posterUrl || this.show?.imageUrl || null;
  }

  scoreIcon ( source: string ): string {
    return SCORE_ICONS[ source ] || '';
  }

  /** The tags: OMDb's, plus a show's status from TVmaze ("Season 3 airing", "Ended 2013"). */
  get tags () {
    const tags = this.title?.tags || [ { text: this.entity.label, tone: this.tint } ];
    const status = this.show?.statusTag;
    return status ? [ ...tags, { text: status, tone: 'pink' as const } ] : tags;
  }

  get tiles (): FindStatTile[] {
    // A show's TVmaze tiles lead (seasons, status, runtime…); IMDb votes last.
    const own = this.isMovie ? [ ...( this.title?.tiles || [] ), ...( this.facts?.tiles || [] ) ] : [ ...( this.show?.tiles || [] ), ...( this.title?.tiles || [] ) ];
    // Movie: box office and budget read best before US gross and votes.
    const order = [ 'Box office', 'US gross', 'Budget', 'IMDb votes' ];
    return ( this.isMovie ? own.sort( ( a, b ) => this.rank( order, a.label ) - this.rank( order, b.label ) ) : own ).slice( 0, 6 );
  }

  /** Cast with roles when Wikidata has them, else OMDb's top-billed names. */
  get cast (): FindListRow[] {
    return this.isMovie ? this.facts?.cast || this.title?.cast || [] : this.show?.cast || [];
  }

  get crew (): FindListRow[] {
    const crew = [ ...( this.title?.crew || [] ) ];
    if ( this.facts?.composer ) crew.push( { name: this.facts.composer, value: 'Music', sub: '' } );
    return crew;
  }

  /** A movie's release, for the "Where to watch" panel and B's status pill. */
  get release (): { headline: string; line: string; pill: string } | null {
    const title = this.title;
    if ( !title || !this.isMovie ) return null;
    const date = title.released ? new Date( `${ title.released }T00:00:00Z` ) : null;
    const day = date ? date.toLocaleDateString( [], { month: 'short', day: 'numeric', timeZone: 'UTC' } ) : '';
    const by = this.facts?.distributors?.[ 0 ] ? `Released by ${ this.facts.distributors[ 0 ] }` : '';
    if ( title.status === 'theaters' ) return { headline: 'In theaters now', line: [ day && `Opened ${ day }`, by ].filter( Boolean ).join( ' · ' ), pill: 'In theaters' };
    if ( title.status === 'coming' ) return { headline: day ? `In theaters ${ day }` : 'Coming soon', line: by, pill: day ? `Opens ${ day }` : 'Coming soon' };
    const year = date ? String( date.getUTCFullYear() ) : '';
    return { headline: 'Streaming, rent or buy', line: [ year && `Out since ${ year }`, by ].filter( Boolean ).join( ' · ' ), pill: '' };
  }

  /** B's status pill. */
  get statusText (): string {
    if ( this.isMovie ) return this.release?.pill || '';
    const next = this.show?.next;
    if ( next ) return [ `Next: ${ next.code }`, this.episodeDay( next ) ].filter( Boolean ).join( ' · ' );
    return this.show?.statusTag || '';
  }

  episodeDay ( episode: FindTvEpisode ): string {
    const time = Date.parse( episode.airstamp || '' ) || Date.parse( episode.airdate ? `${ episode.airdate }T12:00:00Z` : '' );
    return Number.isFinite( time ) ? new Date( time ).toLocaleDateString( [], { weekday: 'short', month: 'short', day: 'numeric' } ) : '';
  }

  episodeTime ( episode: FindTvEpisode ): string {
    const time = Date.parse( episode.airstamp || '' );
    return Number.isFinite( time ) ? new Date( time ).toLocaleTimeString( [], { hour: 'numeric', minute: '2-digit' } ) : '';
  }

  get actions (): MediaAction[] {
    const links = this.title?.links;
    if ( !links ) return [];
    const actions: Array<MediaAction | null | undefined | false | ''> = this.isMovie
      ? [
        this.title?.status === 'released'
          ? links.watch && { label: 'Find where to watch', shortLabel: 'Watch', icon: 'fa-tv', href: links.watch }
          : links.tickets && { label: 'Get tickets', shortLabel: 'Tickets', icon: 'fa-ticket', href: links.tickets },
        { label: 'Watch trailer', shortLabel: 'Trailer', icon: 'fa-play', href: links.trailer },
        { label: 'IMDb', shortLabel: 'IMDb', icon: 'fa-arrow-up-right-from-square', href: links.imdb },
        ( this.facts?.links.website || this.facts?.links.wikipedia ) && {
          label: this.facts?.links.website ? 'Official site' : 'Wikipedia', shortLabel: this.facts?.links.website ? 'Site' : 'Wikipedia',
          icon: 'fa-arrow-up-right-from-square', href: this.facts?.links.website || this.facts?.links.wikipedia || '',
        },
      ]
      : [
        this.show?.serviceUrl && { label: `Watch on ${ this.show.service || 'its service' }`, shortLabel: 'Watch', icon: 'fa-play', href: this.show.serviceUrl },
        this.show?.links.guide && { label: 'Episode guide', shortLabel: 'Episodes', icon: 'fa-list', href: this.show.links.guide },
        { label: 'Trailer', shortLabel: 'Trailer', icon: 'fa-play', href: links.trailer },
        { label: 'IMDb', shortLabel: 'IMDb', icon: 'fa-arrow-up-right-from-square', href: links.imdb },
      ];
    return actions.filter( ( action ): action is MediaAction => !!action && !!action.href ).slice( 0, 4 );
  }

  get hasMore (): boolean {
    return this.isMovie ? !!this.crew.length || !!this.title?.awards : !!this.cast.length || !!this.show?.episodes?.length || !!this.title?.awards;
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

  private rank ( order: string[], label: string ): number {
    const index = order.indexOf( label );
    return index < 0 ? order.length : index;
  }

}
