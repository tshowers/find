import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, PLATFORM_ID, SimpleChanges, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { FindEntity, FindEntitySection, FindEntitySummary, FindExperienceService, FindPlaceDetails, FindPlaceLocation, FindPlaceSection, FindSaleSection, FindWatch } from '../../services/find-experience.service';
import { FindWatchButtonComponent } from '../watch-button/find-watch-button.component';

interface BusinessAction {
  label: string;
  shortLabel: string;
  icon: string;
  href: string;
  external: boolean;
}

type StackedSection = 'details' | 'sale' | 'hours' | 'locations' | 'location';
type Tone = 'green' | 'yellow' | 'muted';

// Tint per type, from the handoff: store green, restaurant yellow, service violet.
const TINTS: Record<string, string> = { store: 'green', restaurant: 'yellow', service: 'violet' };

// docs/design_handoff_find_single_results, types 2–4: one card for a store,
// restaurant or local service. Same layouts and loading behavior as the team
// card (find-entity-card): A above 900px, B below; undefined = loading,
// null = hidden. Facts come from Google Places; sales, dishes and services
// from the business's website (details), when the site can be read.
@Component( {
  selector: 'app-find-business-card',
  standalone: true,
  imports: [ CommonModule, FindWatchButtonComponent ],
  templateUrl: './find-business-card.component.html',
  styleUrls: [ '../entity-card/find-entity-card.component.css', './find-business-card.component.css' ],
} )
export class FindBusinessCardComponent implements OnChanges, OnDestroy {
  @Input( { required: true } ) entity!: FindEntity;
  @Input() query = '';
  @Input() moreCount: number | null = null;
  /** The visitor's position, for the nearest location; null shows Google's pick. */
  @Input() position: { latitude: number; longitude: number } | null = null;
  @Output() moreResults = new EventEmitter<void>();
  @Output() watched = new EventEmitter<FindWatch>();

  place?: FindPlaceSection | null;
  details?: FindPlaceDetails | null;
  sale?: FindSaleSection | null;
  summary?: FindEntitySummary | null;

  expanded = false;
  readonly openSections = new Set<StackedSection>();
  imageFailed = false;
  logoFailed = false;
  now = Date.now();

  private readonly isBrowser = isPlatformBrowser( inject( PLATFORM_ID ) );
  private subs: Subscription[] = [];
  private clock: ReturnType<typeof setInterval> | null = null;

  constructor ( private readonly findExperienceService: FindExperienceService ) { }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( ( changes[ 'entity' ] || changes[ 'position' ] ) && this.entity ) this.load();
  }

  ngOnDestroy (): void {
    this.stop();
  }

  private load (): void {
    this.stop();
    this.place = this.details = this.sale = this.summary = undefined;
    this.expanded = false;
    this.openSections.clear();
    this.imageFailed = this.logoFailed = false;
    this.fetch<FindPlaceSection>( 'place', data => this.place = data );
    this.fetch<FindPlaceDetails>( 'details', data => this.details = data );
    // A store's sale pages, each with its own Watch.
    if ( this.entity.type === 'store' ) this.fetch<FindSaleSection>( 'sale', data => this.sale = data?.items?.length ? data : null );
    else this.sale = null;
    this.fetch<FindEntitySummary>( 'summary', data => this.summary = data?.text ? data : null );
    // "Closes in 12 min" counts down without a refresh.
    if ( this.isBrowser ) this.clock = setInterval( () => this.now = Date.now(), 60 * 1000 );
  }

  private fetch<T> ( section: FindEntitySection, apply: ( data: T | null ) => void ): void {
    this.subs.push( this.findExperienceService.entitySection<T>( this.entity, section, this.position ).subscribe( {
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

  get tint (): string {
    return TINTS[ this.entity.type ] || 'blue';
  }

  get nearest (): FindPlaceLocation | null {
    return this.place?.nearest || null;
  }

  get name (): string {
    return this.entity.name;
  }

  get heroImage (): string | null {
    return this.imageFailed ? null : this.place?.photoUrl || null;
  }

  /** Open / closing soon / closed, worked out from the place's own hours and the current time. */
  get status (): { tone: Tone; text: string; short: string } | null {
    const location = this.nearest;
    if ( !location || location.openNow === null ) return null;
    if ( location.open24Hours ) {
      return this.entity.type === 'service'
        ? { tone: 'green', text: 'Available now · open 24 hours', short: 'Open 24 hours' }
        : { tone: 'green', text: 'Open 24 hours', short: 'Open 24 hours' };
    }
    if ( location.openNow ) {
      const closes = Date.parse( location.nextCloseTime || '' );
      const minutes = Math.round( ( closes - this.now ) / 60000 );
      if ( minutes > 0 && minutes <= 60 ) {
        return { tone: 'yellow', text: `Closes in ${ minutes } min · open until ${ this.placeTime( closes, location ) }`, short: `Closes in ${ minutes } min` };
      }
      return { tone: 'green', text: Number.isFinite( closes ) ? `Open now · until ${ this.placeTime( closes, location ) }` : 'Open now', short: 'Open now' };
    }
    const opens = Date.parse( location.nextOpenTime || '' );
    return { tone: 'muted', text: Number.isFinite( opens ) ? `Closed · opens ${ this.placeDayTime( opens, location ) }` : 'Closed', short: 'Closed' };
  }

  get todayHours (): string {
    const location = this.nearest;
    const week = this.place?.hoursWeek || [];
    if ( !location || week.length !== 7 ) return '';
    return this.shortHours( week[ this.todayIndex( location ) ]?.hours || '' );
  }

  /** "10:00 AM – 9:00 PM" -> "10 AM – 9 PM". */
  shortHours ( hours: string ): string {
    return hours.replace( /:00(?=\s?[AP]M)/g, '' );
  }

  /** "111 N State St, Chicago, IL 60602, USA" -> "111 N State St". */
  street ( location: FindPlaceLocation ): string {
    return location.address.split( ',' )[ 0 ] || location.shortAddress;
  }

  miles ( location: FindPlaceLocation ): string {
    if ( location.distanceMi === null ) return '';
    return location.distanceMi < 0.1 ? 'under 0.1 mi' : `${ location.distanceMi } mi`;
  }

  isToday ( index: number ): boolean {
    return !!this.nearest && index === this.todayIndex( this.nearest );
  }

  distanceText ( location: FindPlaceLocation ): string {
    return location.distanceMi !== null ? this.miles( location ) : location.city;
  }

  openText ( location: FindPlaceLocation ): string {
    if ( location.open24Hours ) return 'Open 24 hours';
    return location.openNow === null ? '' : location.openNow ? 'Open now' : 'Closed';
  }

  get nowLabel (): string {
    const where = this.place?.usedPosition ? 'Nearest' : 'Top';
    const kind = this.entity.type === 'store' ? 'store' : 'location';
    return [ `${ where } ${ kind }`, this.status?.short ].filter( Boolean ).join( ' · ' );
  }

  get metaItems (): string[] {
    const place = this.place;
    if ( !place ) return [];
    return [
      place.rating ? `★ ${ place.rating.value.toFixed( 1 ) } (${ place.rating.count.toLocaleString() })` : '',
      place.priceLevel && this.entity.type === 'restaurant' ? place.priceLevel : '',
      [ this.street( place.nearest ), place.nearest.city ].filter( Boolean ).join( ', ' ),
      place.nearest.phone,
    ].filter( Boolean );
  }

  get keyFacts (): Array<{ value: string; label: string }> {
    const place = this.place;
    if ( !place ) return [];
    const firstSale = this.details?.sales?.[ 0 ];
    const firstPrice = this.details?.services?.find( service => service.price );
    return [
      place.rating ? { value: `★ ${ place.rating.value.toFixed( 1 ) }`, label: `(${ place.rating.count.toLocaleString() })` } : null,
      place.nearest.distanceMi !== null ? { value: this.miles( place.nearest ), label: 'away' } : { value: place.nearest.city, label: '' },
      this.entity.type === 'restaurant' && place.priceLevel ? { value: place.priceLevel, label: 'price' } : null,
      firstSale ? { value: firstSale.discount || firstSale.title, label: firstSale.discount ? firstSale.title : 'on sale' } : null,
      firstPrice ? { value: firstPrice.price, label: firstPrice.name } : null,
    ].filter( ( fact ): fact is { value: string; label: string } => !!fact && !!fact.value );
  }

  get detailsTitle (): string {
    return this.entity.type === 'store' ? 'On sale now' : this.entity.type === 'restaurant' ? 'Popular dishes' : 'Services';
  }

  get detailRows (): Array<{ left: string; right: string; sub: string }> {
    const details = this.details;
    if ( !details ) return [];
    if ( details.sales ) return details.sales.map( sale => ( { left: sale.title, right: sale.discount, sub: [ sale.detail, sale.endsAt && `ends ${ sale.endsAt }` ].filter( Boolean ).join( ' · ' ) } ) );
    if ( details.popular ) return details.popular.map( dish => ( { left: dish.name, right: dish.price, sub: dish.description || '' } ) );
    if ( details.services ) return details.services.map( service => ( { left: service.name, right: service.price, sub: service.duration } ) );
    return [];
  }

  get actions (): BusinessAction[] {
    const place = this.place;
    const website = place?.website || this.entity.website || '';
    const location = this.nearest;
    const call = location?.phone ? { label: this.entity.type === 'service' ? 'Call now' : 'Call', shortLabel: 'Call', icon: 'fa-phone', href: `tel:${ location.phone.replace( /[^0-9+]/g, '' ) }`, external: false } : null;
    const site = website ? {
      label: this.entity.type === 'store' ? 'Shop online' : this.entity.type === 'restaurant' ? 'Menu & ordering' : 'Website',
      shortLabel: this.entity.type === 'restaurant' ? 'Menu' : 'Website',
      icon: this.entity.type === 'store' ? 'fa-bag-shopping' : this.entity.type === 'restaurant' ? 'fa-utensils' : 'fa-globe',
      href: website, external: true,
    } : null;
    const directions = location ? { label: 'Directions', shortLabel: 'Directions', icon: 'fa-location-arrow', href: location.directionsUrl, external: true } : null;
    const maps = location?.mapsUrl ? { label: 'Google Maps', shortLabel: 'Maps', icon: 'fa-map-location-dot', href: location.mapsUrl, external: true } : null;
    const menu = this.details?.menuUrl && this.details.menuUrl !== website ? { label: 'Full menu', shortLabel: 'Menu', icon: 'fa-book-open', href: this.details.menuUrl, external: true } : null;
    if ( menu && site ) Object.assign( site, { label: 'Order online', shortLabel: 'Order', icon: 'fa-bag-shopping' } );
    const ordered = this.entity.type === 'service' ? [ call, site, directions, maps ] : this.entity.type === 'restaurant' && menu ? [ menu, site, directions, call ] : [ site, directions, call, maps ];
    return ordered.filter( ( action ): action is BusinessAction => !!action );
  }

  // --- Layout B accordion ---

  toggleSection ( section: StackedSection ): void {
    if ( this.openSections.has( section ) ) this.openSections.delete( section );
    else this.openSections.add( section );
  }

  get detailsPreview (): string {
    return this.detailRows.slice( 0, 2 ).map( row => row.left ).join( ' · ' );
  }

  get salePreview (): string {
    return ( this.sale?.items || [] ).slice( 0, 2 ).map( item => item.title ).join( ' · ' );
  }

  get othersPreview (): string {
    const others = this.place?.others || [];
    return others.length ? `${ others.length } more · closest ${ this.distanceText( others[ 0 ] ) }` : '';
  }

  // --- Time in the place's own time zone ---

  private placeDate ( ms: number, location: FindPlaceLocation ): Date {
    const offset = location.utcOffsetMinutes ?? -new Date( ms ).getTimezoneOffset();
    return new Date( ms + offset * 60000 );
  }

  private placeTime ( ms: number, location: FindPlaceLocation ): string {
    return this.placeDate( ms, location ).toLocaleTimeString( 'en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' } ).replace( ':00', '' );
  }

  private placeDayTime ( ms: number, location: FindPlaceLocation ): string {
    const sameDay = this.placeDate( ms, location ).getUTCDate() === this.placeDate( this.now, location ).getUTCDate();
    if ( sameDay ) return this.placeTime( ms, location );
    const day = this.placeDate( ms, location ).toLocaleDateString( 'en-US', { weekday: 'short', timeZone: 'UTC' } );
    return `${ day } ${ this.placeTime( ms, location ) }`;
  }

  // Google lists hours Monday first.
  private todayIndex ( location: FindPlaceLocation ): number {
    return ( this.placeDate( this.now, location ).getUTCDay() + 6 ) % 7;
  }
}
