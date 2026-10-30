import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, PLATFORM_ID, SimpleChanges, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { FindEntity, FindEntitySection, FindEntitySummary, FindExperienceService, FindGameSide, FindSportsGame, FindSportsGamesSection, FindSportsLeadersSection, FindSportsNewsSection, FindSportsTeamSection } from '../../services/find-experience.service';

interface EntityAction {
  label: string;
  shortLabel: string;
  icon: string;
  href: string;
}

type StackedSection = 'game' | 'stats' | 'leaders' | 'next' | 'news';

const LIVE_REFRESH_MS = 30 * 1000;

// docs/design_handoff_find_single_results: one rich card when the query names
// one thing (an NFL, NBA or MLB team). Layout A (dashboard) above 900px, layout B
// (stacked, live-first) below; both are in the template and CSS shows one.
// Every section loads on its own: undefined = still loading (placeholder),
// null = not available (hidden), so the card fills in as answers arrive.
@Component( {
  selector: 'app-find-entity-card',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './find-entity-card.component.html',
  styleUrls: [ './find-entity-card.component.css' ],
} )
export class FindEntityCardComponent implements OnChanges, OnDestroy {
  @Input( { required: true } ) entity!: FindEntity;
  @Input() query = '';
  /** Results behind "More results"; null while the normal search is still running. */
  @Input() moreCount: number | null = null;
  @Output() moreResults = new EventEmitter<void>();

  team?: FindSportsTeamSection | null;
  games?: FindSportsGamesSection | null;
  leaders?: FindSportsLeadersSection | null;
  news?: FindSportsNewsSection | null;
  summary?: FindEntitySummary | null;

  expanded = false;
  readonly openSections = new Set<StackedSection>();
  imageFailed = false;
  logoFailed = false;

  private readonly isBrowser = isPlatformBrowser( inject( PLATFORM_ID ) );
  private subs: Subscription[] = [];
  private liveTimer: ReturnType<typeof setInterval> | null = null;

  constructor ( private readonly findExperienceService: FindExperienceService ) { }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( changes[ 'entity' ] && this.entity ) this.load();
  }

  ngOnDestroy (): void {
    this.stop();
  }

  private load (): void {
    this.stop();
    this.team = this.games = this.leaders = this.news = this.summary = undefined;
    this.expanded = false;
    this.openSections.clear();
    this.imageFailed = this.logoFailed = false;
    this.fetch<FindSportsTeamSection>( 'team', data => this.team = data );
    this.fetch<FindSportsGamesSection>( 'games', data => {
      this.games = data;
      this.syncLiveTimer();
    } );
    this.fetch<FindSportsLeadersSection>( 'leaders', data => this.leaders = data && ( data.offense.length || data.defense.length ) ? data : null );
    this.fetch<FindSportsNewsSection>( 'news', data => this.news = data?.articles?.length ? data : null );
    this.fetch<FindEntitySummary>( 'summary', data => this.summary = data?.text ? data : null );
  }

  private fetch<T> ( section: FindEntitySection, apply: ( data: T | null ) => void ): void {
    this.subs.push( this.findExperienceService.entitySection<T>( this.entity, section ).subscribe( {
      next: response => apply( response?.data ?? null ),
      error: () => apply( null ),
    } ) );
  }

  // Scores refresh every 30 s while a game is on; a failed refresh keeps the last score.
  private syncLiveTimer (): void {
    const live = !!this.games?.live;
    if ( live && !this.liveTimer && this.isBrowser ) {
      this.liveTimer = setInterval( () => this.fetch<FindSportsGamesSection>( 'games', data => {
        if ( data ) this.games = data;
        this.syncLiveTimer();
      } ), LIVE_REFRESH_MS );
    } else if ( !live && this.liveTimer ) {
      clearInterval( this.liveTimer );
      this.liveTimer = null;
    }
  }

  private stop (): void {
    this.subs.forEach( sub => sub.unsubscribe() );
    this.subs = [];
    if ( this.liveTimer ) clearInterval( this.liveTimer );
    this.liveTimer = null;
  }

  // --- Display helpers ---

  get live () {
    return this.games?.live || null;
  }

  /** B's status pill: a game in progress, or one later today. */
  get status (): { tone: 'pink' | 'cyan'; text: string } | null {
    const live = this.live;
    if ( live ) return { tone: 'pink', text: [ 'Live', live.detail ].filter( Boolean ).join( ' · ' ) };
    const next = this.games?.next;
    if ( next && this.isToday( next.date ) ) return { tone: 'cyan', text: [ 'Today', this.timeOf( next.date ), next.network ].filter( Boolean ).join( ' · ' ) };
    return null;
  }

  get metaItems (): string[] {
    return [ this.team?.record, this.team?.standing ].filter( ( item ): item is string => !!item );
  }

  get heroImage (): string | null {
    return this.imageFailed ? null : this.team?.imageUrl || null;
  }

  get actions (): EntityAction[] {
    const links = this.entity.links;
    if ( !links ) return [];
    const live = this.live;
    return [
      live
        ? { label: 'Live on ESPN', shortLabel: 'Live', icon: 'fa-tower-broadcast', href: `https://www.espn.com/${ this.entity.league || 'nfl' }/game/_/gameId/${ live.id }` }
        : { label: 'Full coverage on ESPN', shortLabel: 'ESPN', icon: 'fa-arrow-up-right-from-square', href: links.espn },
      { label: links.siteName || 'League site', shortLabel: links.siteName || 'League', icon: this.sportIcon, href: links.site || '' },
      { label: 'Schedule', shortLabel: 'Schedule', icon: 'fa-calendar', href: links.schedule },
      { label: 'Tickets', shortLabel: 'Tickets', icon: 'fa-ticket', href: links.tickets },
    ].filter( action => !!action.href );
  }

  /** The losing (or trailing) side is shown muted. */
  isBehind ( game: FindSportsGame, side: 'home' | 'away' ): boolean {
    const mine = Number( game[ side ].score );
    const theirs = Number( game[ side === 'home' ? 'away' : 'home' ].score );
    if ( game[ side ].score === null || !Number.isFinite( mine ) || !Number.isFinite( theirs ) ) return false;
    return mine < theirs;
  }

  sides ( game: FindSportsGame ): Array<{ key: 'home' | 'away'; side: FindGameSide }> {
    return [ { key: 'away', side: game.away }, { key: 'home', side: game.home } ];
  }

  // --- Layout B accordion ---

  toggleSection ( section: StackedSection ): void {
    if ( this.openSections.has( section ) ) this.openSections.delete( section );
    else this.openSections.add( section );
  }

  get gamePreview (): string {
    const game = this.live || this.games?.last;
    if ( !game ) return '';
    const score = `${ game.away.abbr } ${ game.away.score } – ${ game.home.abbr } ${ game.home.score }`;
    return this.live ? `${ score } · ${ this.live.detail }` : `${ game.result } ${ game.score } ${ game.homeAway } ${ game.opponentAbbr }`;
  }

  get statsPreview (): string {
    return ( this.team?.tiles || [] ).filter( tile => tile.label !== 'Record' ).slice( 0, 2 ).map( tile => `${ tile.value } ${ tile.label.toLowerCase() }` ).join( ' · ' );
  }

  get leadersPreview (): string {
    const top = this.leaders?.offense[ 0 ];
    return top ? `${ top.name } · ${ top.stat }` : '';
  }

  get sportIcon (): string {
    return this.entity.league === 'nba' ? 'fa-basketball' : this.entity.league === 'mlb' ? 'fa-baseball' : 'fa-football';
  }

  get newsPreview (): string {
    return this.news?.articles[ 0 ]?.headline || '';
  }

  /** "2h ago", "Yesterday", "Oct 27". */
  ago ( iso: string | null ): string {
    const time = Date.parse( iso || '' );
    if ( !Number.isFinite( time ) ) return '';
    const minutes = Math.round( ( Date.now() - time ) / 60000 );
    if ( minutes < 60 ) return `${ Math.max( minutes, 1 ) }m ago`;
    if ( minutes < 24 * 60 ) return `${ Math.round( minutes / 60 ) }h ago`;
    if ( minutes < 48 * 60 ) return 'Yesterday';
    return new Date( time ).toLocaleDateString( [], { month: 'short', day: 'numeric' } );
  }

  get nextPreview (): string {
    const next = this.games?.next;
    return next ? `${ next.homeAway } ${ next.opponent } · ${ this.dayOf( next.date ) }` : '';
  }

  // --- Formatting ---

  private isToday ( iso: string ): boolean {
    const date = new Date( iso );
    return !Number.isNaN( date.getTime() ) && date.toDateString() === new Date().toDateString();
  }

  private timeOf ( iso: string ): string {
    return new Date( iso ).toLocaleTimeString( [], { hour: 'numeric', minute: '2-digit' } );
  }

  private dayOf ( iso: string ): string {
    return new Date( iso ).toLocaleDateString( [], { weekday: 'short', month: 'short', day: 'numeric' } );
  }

}
