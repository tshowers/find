import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, PLATFORM_ID, SimpleChanges, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { FindEntity, FindEntitySection, FindEntitySummary, FindExperienceService, FindKeyFact, FindListRow, FindRegionLocal, FindRegionNews, FindRegionSection, FindRegionTodo } from '../../services/find-experience.service';

interface RegionAction {
  label: string;
  shortLabel: string;
  icon: string;
  /** A link, or a search Find runs itself (the currency conversion). */
  href?: string;
  search?: string;
}

type Tint = 'green' | 'blue';

// Tint per type, from the r5 handoff: country and state green, city blue.
const TINTS: Record<string, Tint> = { country: 'green', state: 'green', city: 'blue' };

const CLOCK_MS = 30 * 1000;

// docs/design_handoff_find_single_results_r5, types 7–9: one card for a
// country, a US state or a city. Same layouts and loading behavior as the
// other single-item cards: A above 900px, B below; undefined = loading,
// null = hidden. The backend sends tiles and list rows already worded; the
// card adds the running local clock and how far ahead of the visitor it is.
@Component( {
  selector: 'app-find-region-card',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './find-region-card.component.html',
  styleUrls: [ '../entity-card/find-entity-card.component.css', './find-region-card.component.css' ],
} )
export class FindRegionCardComponent implements OnChanges, OnDestroy {
  @Input( { required: true } ) entity!: FindEntity;
  @Input() query = '';
  @Input() moreCount: number | null = null;
  @Output() moreResults = new EventEmitter<void>();
  /** "Convert USD to JPY": Find runs that search and shows its conversion result. */
  @Output() search = new EventEmitter<string>();

  region?: FindRegionSection | null;
  local?: FindRegionLocal | null;
  todo?: FindRegionTodo | null;
  news?: FindRegionNews | null;
  summary?: FindEntitySummary | null;

  expanded = false;
  readonly openSections = new Set<string>();
  imageFailed = false;
  thumbFailed = false;
  now = Date.now();

  private readonly isBrowser = isPlatformBrowser( inject( PLATFORM_ID ) );
  private subs: Subscription[] = [];
  private clock: ReturnType<typeof setInterval> | null = null;

  constructor ( private readonly findExperienceService: FindExperienceService ) { }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( changes[ 'entity' ] && this.entity ) this.load();
  }

  ngOnDestroy (): void {
    this.stop();
  }

  private load (): void {
    this.stop();
    this.region = this.local = this.todo = this.news = this.summary = undefined;
    this.expanded = false;
    this.openSections.clear();
    this.imageFailed = this.thumbFailed = false;
    this.fetch<FindRegionSection>( 'region', data => this.region = data );
    this.fetch<FindRegionLocal>( 'local', data => this.local = data?.timeZone ? data : null );
    this.fetch<FindRegionTodo>( 'todo', data => this.todo = data?.rows?.length ? data : null );
    this.fetch<FindRegionNews>( 'news', data => this.news = data?.articles?.length ? data : null );
    this.fetch<FindEntitySummary>( 'summary', data => this.summary = data?.text ? data : null );
    // The local clock keeps time without a refresh.
    if ( this.isBrowser ) this.clock = setInterval( () => this.now = Date.now(), CLOCK_MS );
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
    if ( this.clock ) clearInterval( this.clock );
    this.clock = null;
  }

  // --- Display helpers ---

  get tint (): Tint {
    return TINTS[ this.entity.type ] || 'green';
  }

  get heroImage (): string | null {
    return this.imageFailed ? null : this.region?.imageUrl || null;
  }

  get thumb (): string | null {
    return this.thumbFailed ? null : this.region?.thumbUrl || null;
  }

  /** B's line under the name: "Asia · Capital Tokyo", or a city's "Washington, US". */
  get subtitle (): string {
    const region = this.region;
    if ( !region ) return '';
    if ( this.entity.type === 'city' ) return region.meta.find( item => !item.label )?.value || '';
    const second = region.tags[ 1 ]?.text || '';
    const capital = region.meta.find( item => item.label === 'Capital' );
    const population = region.meta.find( item => item.label === 'Population' );
    return [ second, capital ? `Capital ${ capital.value }` : population ? `${ population.value } people` : '' ].filter( Boolean ).join( ' · ' );
  }

  /** B's stat chips: people, the currency against the dollar, the time difference. */
  get keyFacts (): FindKeyFact[] {
    const facts: FindKeyFact[] = [];
    const population = this.region?.meta.find( item => item.label === 'Population' );
    if ( population ) facts.push( { value: population.value, label: 'people' } );
    const currency = this.region?.currency;
    if ( currency ) facts.push( { value: currency.code, label: `${ this.rateText( currency.rate ) } = $1` } );
    const hours = this.hoursFromVisitor;
    if ( hours ) facts.push( { value: `${ hours > 0 ? '+' : '' }${ this.hoursText( hours ) }h`, label: 'from you' } );
    return facts;
  }

  /** B's status pill: "10:12 AM in Tokyo · 18° Clear". */
  get statusText (): string {
    const local = this.local;
    if ( !local ) return '';
    const weather = local.weather ? `${ local.weather.temperature }° ${ local.weather.condition }`.trim() : '';
    return [ `${ this.localTime } in ${ local.place }`, weather ].filter( Boolean ).join( ' · ' );
  }

  get localTime (): string {
    return this.local ? this.format( { hour: 'numeric', minute: '2-digit' } ) : '';
  }

  /** "Sunday, Nov 1 · GMT+9 · 16 hours ahead of you". */
  get localDateLine (): string {
    if ( !this.local ) return '';
    const hours = this.hoursFromVisitor;
    const relative = hours === null ? '' : hours === 0 ? 'same as you' : `${ this.hoursText( Math.abs( hours ) ) } hour${ Math.abs( hours ) === 1 ? '' : 's' } ${ hours > 0 ? 'ahead of' : 'behind' } you`;
    return [ this.format( { weekday: 'long', month: 'short', day: 'numeric' } ), this.zoneName, relative ].filter( Boolean ).join( ' · ' );
  }

  get shortDateLine (): string {
    return this.local ? [ this.format( { weekday: 'short', month: 'short', day: 'numeric' } ), this.zoneName ].filter( Boolean ).join( ' · ' ) : '';
  }

  /** The place's clock minus the visitor's, in hours (5.5 for India from UTC). */
  get hoursFromVisitor (): number | null {
    const zone = this.local?.timeZone;
    if ( !zone ) return null;
    const there = this.offsetMinutes( zone );
    if ( there === null ) return null;
    const here = -new Date( this.now ).getTimezoneOffset();
    return ( there - here ) / 60;
  }

  get actions (): RegionAction[] {
    const region = this.region;
    if ( !region ) return [];
    const links = region.links;
    const advisory = region.advisory;
    const currency = region.currency;
    const actions: Array<RegionAction | null | false | ''> = [
      advisory && { label: 'Travel advisory', shortLabel: 'Advisory', icon: 'fa-arrow-up-right-from-square', href: advisory.url },
      currency && { label: `Convert USD to ${ currency.code }`, shortLabel: currency.code, icon: 'fa-right-left', search: `1 USD to ${ currency.code }` },
      { label: 'Open map', shortLabel: 'Map', icon: 'fa-location-dot', href: links.map },
      links.website && this.entity.type !== 'country' && { label: 'Official site', shortLabel: 'Site', icon: 'fa-arrow-up-right-from-square', href: links.website },
      links.wikipedia && { label: 'Wikipedia', shortLabel: 'Wikipedia', icon: 'fa-arrow-up-right-from-square', href: links.wikipedia },
    ];
    return actions.filter( ( action ): action is RegionAction => !!action && !!( action.href || action.search ) ).slice( 0, 4 );
  }

  runAction ( action: RegionAction, event: Event ): void {
    if ( !action.search ) return;
    event.preventDefault();
    this.search.emit( action.search );
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

  // --- Formatting ---

  private format ( options: Intl.DateTimeFormatOptions ): string {
    try {
      return new Date( this.now ).toLocaleString( [], { ...options, timeZone: this.local?.timeZone } );
    } catch {
      return '';
    }
  }

  private get zoneName (): string {
    try {
      const parts = new Intl.DateTimeFormat( 'en-US', { timeZone: this.local?.timeZone, timeZoneName: 'short' } ).formatToParts( new Date( this.now ) );
      return parts.find( part => part.type === 'timeZoneName' )?.value || '';
    } catch {
      return '';
    }
  }

  /** Minutes the zone is ahead of UTC right now (daylight time included). */
  private offsetMinutes ( timeZone: string ): number | null {
    try {
      const parts = new Intl.DateTimeFormat( 'en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' } ).formatToParts( new Date( this.now ) );
      const part = ( type: string ) => Number( parts.find( item => item.type === type )?.value );
      const asUtc = Date.UTC( part( 'year' ), part( 'month' ) - 1, part( 'day' ), part( 'hour' ), part( 'minute' ) );
      const now = new Date( this.now );
      now.setSeconds( 0, 0 );
      return Math.round( ( asUtc - now.getTime() ) / 60000 );
    } catch {
      return null;
    }
  }

  private hoursText ( hours: number ): string {
    return Number.isInteger( hours ) ? String( hours ) : hours.toFixed( 1 ).replace( /\.0$/, '' );
  }

  private rateText ( rate: number ): string {
    return rate >= 100 ? rate.toFixed( 1 ) : rate.toFixed( 2 );
  }

}
