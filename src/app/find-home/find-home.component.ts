import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { FindSwipeDirective } from '../directives/find-swipe.directive';
import { FindAward, FindAwardView, FindAwardsProgress, FindAwardsService } from '../services/find-awards.service';
import { FindBusinessHours, FindBusinessHoursDay, FindConversionCategory, FindConversionResult, FindExperienceService, FindFeedbackRating, FindMovieRatings, FindRankedResult, FindSearchResponse, FindSourceType, FindWeatherForecastDay } from '../services/find-experience.service';
import { FindGyroscopeService, GyroTilt } from '../services/find-gyroscope.service';
import { environment } from '../../environments/environment';
import { AwardBadgeComponent } from '../shared/award-badge/award-badge.component';
import { PlatformMenuComponent } from '../shared/platform-menu/platform-menu.component';
import { SeoService } from '../shared/seo.service';
import { Title, Meta } from '@angular/platform-browser';

type FindView = 'search' | 'result' | 'detail' | 'booklet' | 'history' | 'info' | 'awards';

interface FindQuickAction {
  label: string;
  icon: string;
  color: string;
  query: string;
  disabled?: boolean;
}

// One quick action on a result (Read, Copy link, ...). Desktop shows `label`
// in the action bar; phones show `shortLabel` under the icon in a tile row.
interface FindAction {
  key: string;
  label: string;
  shortLabel: string;
  icon: string;
  href?: string;
  copyText?: string;
}

interface FindPagerTarget {
  label: string;
  title: string;
}

type FindImageState = 'own' | 'fallback' | 'none';

@Component( {
  selector: 'app-find-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, FindSwipeDirective, PlatformMenuComponent, AwardBadgeComponent],
  templateUrl: './find-home.component.html',
  styleUrl: './find-home.component.css'
} )
export class FindHomeComponent implements OnInit, OnDestroy {
  query = '';
  activeContext = '';
  isLoading = false;
  errorMessage = '';
  result: FindSearchResponse | null = null;
  breadcrumb: string[] = [];
  loadingElapsedMs = 0;
  lastResponseMs = 0;

  activeView: FindView = 'search';
  // A `q` parameter is the public handoff format used by TODD and other
  // launchers. Those links should open directly into the answer experience,
  // rather than briefly/rendering the full Find landing screen alongside it.
  isForwardedQuery = false;
  resultIndex = 0;
  selectedResultIndex = 0;
  // True while the swipe carousel is showing the backend's own generated
  // answer.text as a slide *before* resultIndex 0, rather than treating it
  // as a replacement for the top-ranked source card.
  viewingGroundedAnswer = false;
  allCards: FindRankedResult[] = [];
  // The full mapped/filtered result set (up to 20), independent of allCards
  // (which stays capped at 10 for the swipeable single-card carousel — a
  // one-at-a-time swipe is a poor fit for "load more"). Only the booklet
  // grid view reveals past the first 10, via gridCards/gridVisibleCount.
  allResults: FindRankedResult[] = [];
  gridVisibleCount = 10;
  currentCard: FindRankedResult | null = null;
  conversionAmount = 0;
  conversionAmountText = '0';
  conversionOutputAmount: number | null = null;
  conversionInputUnit = '';
  conversionOutputUnit = '';
  conversionRate: number | null = null;
  conversionRateUpdatedAt = '';
  conversionSource = '';
  private conversionBaseInputUnit = '';
  private conversionBaseOutputUnit = '';
  private conversionBaseRate: number | null = null;
  readonly conversionKeypadDigits = [ '1', '2', '3', '4', '5', '6', '7', '8', '9' ];
  readonly quickActions: FindQuickAction[] = [
    { label: 'News', icon: 'fa-newspaper', color: 'news', query: "Today's News" },
    { label: 'Weather', icon: 'fa-sun', color: 'weather', query: 'weather' },
    { label: 'Sports', icon: 'fa-trophy', color: 'sports', query: 'sports news' },
    { label: 'Conversion', icon: 'fa-arrow-right-arrow-left', color: 'conversion', query: '100 USD to EUR' },
    { label: 'Restaurants', icon: 'fa-utensils', color: 'restaurants', query: 'restaurants near me' },
    { label: 'Events', icon: 'fa-calendar', color: 'events', query: 'events near me', disabled: true },
  ];

  gyroEnabled = false;
  gyroSupported = false;
  highlightedPill = '';

  searchHistory: string[] = [];
  pendingAwardUnlock: FindAward | null = null;
  readonly year = new Date().getFullYear();
  readonly appVersion = String( environment.VERSION || '' ).trim();
  private readonly brokenImageUrls = new Set<string>();
  readonly feedbackRatings: Array<{ value: FindFeedbackRating; label: string }> = [
    { value: 'excellent', label: 'Excellent' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' },
  ];
  copiedActionKey = '';
  private feedbackSentFor = '';
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;
  private backspaceTimer: ReturnType<typeof setTimeout> | null = null;
  private backspaceLongPressed = false;
  // Logo colours, cycled across the pager's progress segments.
  private readonly logoColors = [ 'var(--blue)', 'var(--cyan)', 'var(--yellow)', 'var(--pink)', 'var(--violet)' ];

  private readonly HISTORY_KEY = 'find-history';
  private readonly HISTORY_MAX = 20;
  private readonly tiltToPillIndex: Partial<Record<GyroTilt, number>> = {
    left: 0, right: 1, up: 2, down: 3
  };

  private lastKnownPosition: { latitude: number; longitude: number } | null = null;
  private readonly NEAR_ME_PATTERN = /\b(?:near me|nearby|near here|close(?:st)? to me|close by|around here|by me|in my area|in my neighborhood|in my zip\s*code|in my zipcode|in my zip)\b/i;
  private readonly LOCATIONLESS_WEATHER_PATTERN = /^(?:(?:what'?s|what is|how'?s|how is|the)\s+)?(?:weather|forecast|temperature)(?:\s+(?:like|today|tomorrow|tonight|right now|currently|this week|this weekend|now))?[?.!]*$/i;

  private gyroHoldTimer: ReturnType<typeof setTimeout> | null = null;
  private loadingTimer: ReturnType<typeof setInterval> | null = null;
  private loadingStartedAtMs: number | null = null;
  private readonly GYRO_HOLD_MS = 1500;
  private routeSub?: Subscription;
  private gyroSub?: Subscription;
  private summarySub?: Subscription;

  constructor (
    private readonly findExperienceService: FindExperienceService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly gyroscope: FindGyroscopeService,
    private readonly awardsService: FindAwardsService,
    private readonly title: Title,
    private readonly meta: Meta,
    private readonly seo: SeoService
  ) { }

  ngOnInit (): void {
    // index.html ships the homepage's title/meta/canonical as static
    // defaults, but the Help and About pages overwrite them via Title/Meta/
    // SeoService when visited — restore the defaults here so a client-side
    // navigation back to Home (no full page reload) doesn't leave those
    // pages' metadata stuck in place.
    this.title.setTitle( 'Find — Search that ends with an answer | Taliferro Tech' );
    this.meta.updateTag( { name: 'description', content: 'Find is TODD\'s visual search experience: the best-weighted answer first, not ten blue links, backed by authoritative answers, curated Taliferro knowledge, and the web. Free, no account required.' } );
    this.meta.updateTag( { property: 'og:title', content: 'Find — Search that ends with an answer' } );
    this.meta.updateTag( { property: 'og:description', content: 'The best-weighted answer first, not ten blue links. Find combines authoritative answers, curated Taliferro knowledge, and web results — free, no account required.' } );
    this.meta.updateTag( { property: 'og:url', content: 'https://find.taliferro.tech/' } );
    this.meta.updateTag( { name: 'twitter:title', content: 'Find — Search that ends with an answer' } );
    this.meta.updateTag( { name: 'twitter:description', content: 'The best-weighted answer first, not ten blue links. Find combines authoritative answers, curated Taliferro knowledge, and web results — free, no account required.' } );
    this.seo.setCanonical( 'https://find.taliferro.tech/' );

    this.gyroSupported = this.gyroscope.isSupported;
    this.loadHistory();

    this.routeSub = this.route.queryParamMap.subscribe( ( params ) => {
      // Support both the app's internal `query` parameter and browser search
      // shortcuts such as Firefox, which use the conventional `q` parameter.
      const next = String( params.get( 'query' ) || params.get( 'q' ) || '' ).trim();
      const nextContext = String( params.get( 'context' ) || '' ).trim();
      const requestedView = params.get( 'view' );
      this.isForwardedQuery = params.has( 'q' ) && !params.has( 'query' );
      if ( next ) {
        this.query = next;
        this.activeContext = nextContext;
        // Set the view before starting the async search so a forwarded link
        // never presents the landing shell as part of the result page.
        this.activeView = 'result';
        this.syncBreadcrumb();
        this.runSearch( next, false, nextContext );
        return;
      }
      this.result = null;
      this.updateCards();
      this.breadcrumb = [];
      this.query = '';
      this.activeContext = '';
      this.activeView = 'search';
      if ( requestedView === 'history' || requestedView === 'info' ) {
        this.activeView = requestedView;
      }
      this.selectedResultIndex = 0;
    } );
  }

  ngOnDestroy (): void {
    this.routeSub?.unsubscribe();
    this.gyroSub?.unsubscribe();
    this.summarySub?.unsubscribe();
    this.gyroscope.disable();
    this.clearGyroTimer();
    this.stopLoadingTimer();
    if ( this.copiedTimer !== null ) clearTimeout( this.copiedTimer );
    this.cancelBackspacePress();
  }

  // ← / → step through results, the same as the pager's Previous / Next.
  @HostListener( 'document:keydown', [ '$event' ] )
  onDocumentKeydown ( event: KeyboardEvent ): void {
    if ( event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' ) return;
    if ( event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ) return;
    if ( ( this.activeView !== 'result' && this.activeView !== 'detail' ) || !this.result || this.isLoading || this.pendingAwardUnlock ) return;
    const target = event.target as HTMLElement | null;
    if ( target?.closest?.( 'input, textarea, select, [contenteditable="true"]' ) ) return;
    event.preventDefault();
    if ( event.key === 'ArrowLeft' ) this.onPreviousResult();
    else this.onNextResult();
  }

  onSubmit (): void {
    const q = String( this.query || '' ).trim();
    if ( !q ) return;
    this.activeContext = '';
    this.syncBreadcrumb();
    this.resultIndex = 0;
    this.selectedResultIndex = 0;
    this.navigate( q, null );
  }

  onQuickActionClick ( action: FindQuickAction ): void {
    if ( action.disabled ) return;
    this.query = action.query;
    this.activeContext = '';
    this.syncBreadcrumb();
    this.resultIndex = 0;
    this.selectedResultIndex = 0;
    this.navigate( action.query, null );
  }

  onQueryInput (): void {
    const typedQuery = String( this.query || '' ).trim();
    const displayedQuery = String( this.result?.query || '' ).trim();
    if ( typedQuery === displayedQuery ) return;

    // Keep the compact search in place while the user starts a new search.
    // Clearing the result here makes the old answer disappear immediately.
    this.summarySub?.unsubscribe();
    this.result = null;
    this.updateCards();
    this.errorMessage = '';
    this.activeContext = '';
    this.activeView = 'result';
    this.resultIndex = 0;
    this.selectedResultIndex = 0;
  }

  onResultQueryChange ( value: string ): void {
    this.query = value;
    this.onQueryInput();
  }

  resetToSearch (): void {
    this.summarySub?.unsubscribe();
    this.result = null;
    this.updateCards();
    this.breadcrumb = [];
    this.query = '';
    this.activeContext = '';
    this.activeView = 'search';
    this.highlightedPill = '';
    this.resultIndex = 0;
    this.selectedResultIndex = 0;
    this.router.navigate( [], {
      relativeTo: this.route,
      queryParams: {},
      queryParamsHandling: 'replace'
    } );
  }

  async shareResult (): Promise<void> {
    const card = this.currentCard;
    if ( !card ) return;
    const data = { title: card.title, url: card.url };
    if ( navigator.share ) {
      try { await navigator.share( data ); } catch { /* user cancelled */ }
    } else {
      try { await navigator.clipboard.writeText( card.url ); } catch { /* ignore */ }
    }
  }

  setView ( view: FindView ): void {
    if ( view === 'booklet' && ( !this.result || this.isWeatherMode || this.isMovieMode ) ) return;
    if ( view === 'booklet' && this.activeView === 'booklet' ) {
      this.activeView = 'result';
      return;
    }
    this.activeView = view;
  }

  get isResultView (): boolean {
    return this.activeView === 'result' || this.activeView === 'detail' || this.activeView === 'booklet';
  }

  get isQuestionMode (): boolean {
    return this.result?.queryType === 'question';
  }

  get isPersonSearch (): boolean {
    return this.result?.queryType === 'person';
  }

  get isWeatherMode (): boolean {
    return this.result?.queryType === 'weather';
  }

  get isConversionMode (): boolean {
    return this.result?.queryType === 'conversion' && !!this.result?.conversion;
  }

  get isLocalMode (): boolean {
    return this.result?.queryType === 'local';
  }

  get isMovieMode (): boolean {
    return this.result?.queryType === 'movie' && !!this.result?.movieRatings;
  }

  get movieRatings (): FindMovieRatings | null {
    return this.result?.movieRatings || null;
  }

  get conversion (): FindConversionResult | null {
    return this.result?.conversion || null;
  }

  get conversionCategory (): FindConversionCategory | null {
    return this.conversion?.category || null;
  }

  get conversionUnitOptions (): Array<{ value: string; label: string }> {
    const options: Record<string, Array<{ value: string; label: string }>> = {
      currency: [
        { value: 'USD', label: 'US Dollar (USD)' }, { value: 'CAD', label: 'Canadian Dollar (CAD)' },
        { value: 'EUR', label: 'Euro (EUR)' }, { value: 'GBP', label: 'British Pound (GBP)' },
        { value: 'JPY', label: 'Japanese Yen (JPY)' }, { value: 'AUD', label: 'Australian Dollar (AUD)' },
        { value: 'CNY', label: 'Chinese Yuan (CNY)' }, { value: 'CHF', label: 'Swiss Franc (CHF)' },
        { value: 'MXN', label: 'Mexican Peso (MXN)' },
      ],
      temperature: [ { value: 'F', label: 'Fahrenheit (°F)' }, { value: 'C', label: 'Celsius (°C)' } ],
      distance: [ { value: 'mi', label: 'Miles' }, { value: 'km', label: 'Kilometers' } ],
      weight: [ { value: 'lb', label: 'Pounds' }, { value: 'kg', label: 'Kilograms' } ],
      length: [ { value: 'in', label: 'Inches' }, { value: 'cm', label: 'Centimeters' }, { value: 'ft', label: 'Feet' }, { value: 'm', label: 'Meters' } ],
      volume: [ { value: 'gal', label: 'US Gallons' }, { value: 'l', label: 'Liters' } ],
    };
    return options[String( this.conversionCategory || '' )] || [];
  }

  get awards (): FindAwardView[] {
    return this.awardsService.awards;
  }

  get awardsProgress (): FindAwardsProgress {
    return this.awardsService.progress;
  }

  dismissAwardUnlock (): void {
    this.pendingAwardUnlock = null;
  }

  get leadVaultSearchUrl (): string {
    const query = String( this.result?.query || this.query || '' ).trim();
    return `https://todd.taliferro.tech/lead-vault?query=${encodeURIComponent( query )}`;
  }

  get isDetailView (): boolean {
    return this.activeView === 'detail';
  }

  get showPillBar (): boolean {
    return !!this.result && this.isResultView;
  }

  get shelfTitle (): string {
    const base = String( this.result?.query || this.query || '' ).trim();
    const context = String( this.activeContext || '' ).trim();
    if ( base && context ) {
      return `${base} · ${context}`;
    }
    return base || 'Find';
  }

  get currentPills (): string[] {
    return this.currentCard?.pills?.slice( 0, 4 ) || [];
  }

  get currentAnswerText (): string {
    return String( this.currentCard?.answer || this.currentCard?.summary || '' ).trim();
  }

  get currentBusinessName (): string {
    return this.businessTitleParts.name || String( this.currentCard?.title || '' ).trim();
  }

  get currentBusinessAddress (): string {
    return String( this.currentCard?.address || '' ).trim() || this.businessTitleParts.address;
  }

  get currentBusinessPhone (): string {
    return String( this.currentCard?.phone || '' ).trim();
  }

  get currentBusinessPhoneHref (): string {
    return `tel:${ this.currentBusinessPhone.replace( /[^\d+]/g, '' ) }`;
  }

  get currentBusinessMeta (): string[] {
    return this.businessTitleParts.meta;
  }

  private static readonly STREET_ADDRESS = /^\d{1,6}\s+[\w .'#-]*\b(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Way|Dr|Drive|Ln|Lane|Pl|Place|Hwy|Highway|Pkwy|Parkway|Ct|Court|Ter|Terrace|Cir|Circle|Sq|Square)\b\.?(?:\s+(?:N|S|E|W|NE|NW|SE|SW))?$/i;
  private static readonly CITY_STATE = /^[A-Za-z .'-]+, [A-Z]{2}(?: \d{5})?$/;

  private get businessTitleParts (): { name: string; address: string; meta: string[] } {
    const title = String( this.currentCard?.title || '' ).trim();
    const segments = title.split( /\s+-\s+/ ).map( segment => segment.trim() ).filter( Boolean );
    if ( segments.length < 2 ) return { name: title, address: '', meta: [] };

    // A street address segment: "123 Main St, Seattle, WA", or just
    // "9413 16th Ave SW" when the city comes in its own later segment
    // ("... - Seattle, WA - ..."), as on listing sites like EverOut.
    const addressIndex = segments.findIndex( segment =>
      /^\d{1,6}\s+[^-]+,/.test( segment ) || FindHomeComponent.STREET_ADDRESS.test( segment ) );
    if ( addressIndex < 1 ) return { name: title, address: '', meta: [] };

    let address = segments[addressIndex];
    if ( !address.includes( ',' ) ) {
      const city = segments.slice( addressIndex + 1 ).find( segment => FindHomeComponent.CITY_STATE.test( segment ) );
      if ( city ) address = `${ address }, ${ city }`;
    }

    const metadata = segments.slice( 1, addressIndex ).join( ' - ' );
    const meta = metadata.match( /Updated\s+[^&-]+|[\d,]+\s+Photos?|[\d,]+\s+Reviews?/gi ) || [];
    return {
      name: segments[0],
      address,
      meta: meta.map( item => item.trim() )
    };
  }

  get currentBusinessHours (): FindBusinessHours | null {
    const structured = this.currentCard?.hours;
    if ( structured?.days?.length ) return structured;
    return this.parseHoursFromText( this.currentAnswerText );
  }

  get currentHoursFromSummary (): boolean {
    return !this.currentCard?.hours && !!this.currentBusinessHours;
  }

  isTodayHoursDay ( day: string ): boolean {
    const today = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
    return String( day || '' ).toLowerCase() === today.toLowerCase() || String( day || '' ).toLowerCase() === today.slice( 0, 3 ).toLowerCase();
  }

  // Image rule (applies to every result type):
  //   the result's own image      -> hero spot
  //   Find's default artwork      -> small thumbnail, never the hero
  //   no image                    -> text takes the full width
  get imageState (): FindImageState {
    if ( this.currentOwnImage ) return 'own';
    if ( this.currentFallbackImage ) return 'fallback';
    return 'none';
  }

  /** The result's own image, when it has a usable one that isn't Find's default artwork. */
  get currentOwnImage (): string {
    if ( this.isWeatherMode || this.isConversionMode ) return '';
    const image = this.currentRawImage;
    return this.isUsableImage( image ) && !this.isFindFallbackUrl( image ) ? image : '';
  }

  /** Find's own default artwork for this result. Only ever shown as a thumbnail. */
  get currentFallbackImage (): string {
    if ( this.isWeatherMode || this.isConversionMode || this.currentOwnImage ) return '';
    const raw = this.currentRawImage;
    const fallback = this.isFindFallbackUrl( raw ) ? raw : this.defaultFallbackImage;
    return this.isUsableImage( fallback ) ? fallback : '';
  }

  private get currentRawImage (): string {
    if ( this.isMovieMode ) return String( this.movieRatings?.posterUrl || '' ).trim();
    if ( this.isGroundedAnswerSlide ) return String( this.result?.answer?.imageUrl || '' ).trim();
    return String( this.currentCard?.imageUrl || '' ).trim();
  }

  private get defaultFallbackImage (): string {
    if ( this.isHeadlineMode ) {
      return this.headlineKind === 'news' ? '/fallback/find-news.png' : '/fallback/find-sports.png';
    }
    const searchText = [
      this.result?.query,
      this.result?.normalizedQuery,
      this.result?.answer?.text,
      this.currentCard?.title
    ].join( ' ' ).toLowerCase();
    return /\b(sports?|nfl|nba|wnba|mlb|nhl|soccer|football|basketball|baseball|hockey)\b/.test( searchText )
      ? '/fallback/find-sports.png'
      : '';
  }

  // Our own /fallback/ artwork, whether the frontend picked it or the
  // backend returned it as the result image.
  private isFindFallbackUrl ( image: string ): boolean {
    if ( !image ) return false;
    try {
      const url = new URL( image, typeof window === 'undefined' ? 'https://find.taliferro.tech' : window.location.origin );
      const sameOrigin = typeof window !== 'undefined' && url.origin === window.location.origin;
      return url.pathname.startsWith( '/fallback/' ) && ( sameOrigin || url.hostname === 'find.taliferro.tech' );
    } catch {
      return false;
    }
  }

  // --- News / Sports headlines (hourly RSS snapshot) ---

  get isHeadlineMode (): boolean {
    const type = this.result?.queryType;
    return !!this.result?.rssBacked || type === 'sports' || type === 'news';
  }

  get headlineKind (): 'sports' | 'news' {
    return this.result?.queryType === 'news' ? 'news' : 'sports';
  }

  get currentHeadlineSource (): string {
    return String( this.currentCard?.rssSource || this.currentCard?.displayUrl || '' ).trim();
  }

  /** "From CBS Sports, BBC Sport and Sky Sports · updated hourly" */
  get headlineAttribution (): string {
    const sources = Array.from( new Set(
      this.allResults.map( card => String( card.rssSource || '' ).trim() ).filter( Boolean )
    ) );
    if ( !sources.length ) return 'Updated hourly';
    const list = sources.length === 1
      ? sources[0]
      : `${ sources.slice( 0, -1 ).join( ', ' ) } and ${ sources[sources.length - 1] }`;
    return `From ${ list } · updated hourly`;
  }

  /** "just now", "12m ago", "4h ago", "Yesterday", then a short date. */
  relativeTime ( value: string | null | undefined ): string {
    const time = new Date( String( value || '' ) ).getTime();
    if ( !Number.isFinite( time ) ) return '';
    const minutes = Math.floor( ( Date.now() - time ) / 60000 );
    if ( minutes < 1 ) return 'just now';
    if ( minutes < 60 ) return `${ minutes }m ago`;
    const hours = Math.floor( minutes / 60 );
    if ( hours < 24 ) return `${ hours }h ago`;
    const yesterday = new Date();
    yesterday.setDate( yesterday.getDate() - 1 );
    if ( new Date( time ).toDateString() === yesterday.toDateString() ) return 'Yesterday';
    return new Date( time ).toLocaleDateString( undefined, { month: 'short', day: 'numeric' } );
  }

  // --- Pager ---

  /** Weather, conversion and movie answers are a single result: Back only, no segments. */
  get isSingleResultMode (): boolean {
    return this.isWeatherMode || this.isConversionMode || this.isMovieMode;
  }

  get pagerCenterLabel (): string {
    if ( this.isWeatherMode ) return 'Weather';
    if ( this.isConversionMode ) return this.conversionCategory === 'currency' ? 'Currency conversion' : 'Unit conversion';
    if ( this.isMovieMode ) return 'Movie';
    return '';
  }

  get pagerPrevious (): FindPagerTarget {
    if ( this.isDetailView ) return { label: 'Back', title: 'All results' };
    if ( this.viewingGroundedAnswer || this.isSingleResultMode ) return { label: 'Back', title: 'New search' };
    if ( this.resultIndex === 0 ) {
      return this.isQuestionMode && this.questionAnswerText
        ? { label: 'Previous', title: 'Answer' }
        : { label: 'Back', title: 'New search' };
    }
    return this.pagerTarget( 'Previous', this.allCards[this.resultIndex - 1] );
  }

  get pagerNext (): FindPagerTarget | null {
    if ( this.isDetailView || this.isSingleResultMode ) return null;
    const card = this.viewingGroundedAnswer ? this.allCards[0] : this.allCards[this.resultIndex + 1];
    return card ? this.pagerTarget( 'Next', card ) : null;
  }

  /** Card shown after the current one, for the phone-only "Next" preview under a headline. */
  get nextHeadlineCard (): FindRankedResult | null {
    if ( !this.isHeadlineMode ) return null;
    return this.allCards[this.resultIndex + 1] ?? null;
  }

  get pagerSegments (): Array<{ current: boolean; color: string }> {
    const current = this.viewingGroundedAnswer ? -1 : this.resultIndex;
    return this.allCards.map( ( _, index ) => ( {
      current: index === current,
      color: index <= current ? this.logoColors[index % this.logoColors.length] : 'var(--surface2)'
    } ) );
  }

  private pagerTarget ( label: string, card: FindRankedResult ): FindPagerTarget {
    const details = this.isHeadlineMode
      ? [ String( card.rssSource || '' ).trim(), this.relativeTime( card.publishedAt ) ].filter( Boolean )
      : [];
    return { label: [ label, ...details ].join( ' · ' ), title: String( card.title || '' ).trim() };
  }

  // --- Actions ---

  get currentActions (): FindAction[] {
    if ( this.isConversionMode ) {
      const text = this.conversionResultText;
      return text ? [ { key: 'copy-result', label: 'Copy result', shortLabel: 'Copy', icon: 'fa-copy', copyText: text } ] : [];
    }
    if ( this.isHeadlineMode ) {
      const url = String( this.currentCard?.url || '' ).trim();
      if ( !url ) return [];
      const source = this.currentHeadlineSource;
      return [
        { key: 'read', label: source ? `Read on ${ source }` : 'Read article', shortLabel: 'Read', icon: 'fa-arrow-up-right-from-square', href: url },
        { key: 'copy-link', label: 'Copy link', shortLabel: 'Copy', icon: 'fa-copy', copyText: url },
      ];
    }
    if ( this.isQuestionMode || this.isMovieMode || this.isWeatherMode || !this.currentCard ) return [];

    // Any result with a link gets Visit site + Copy link; a place (hours,
    // address, phone, or a local search) also gets Directions first, plus
    // Call when there's a phone number - Go · Call · Site · Copy.
    const actions: FindAction[] = [];
    const mapsUrl = this.isPlaceResult ? this.directionsUrl : '';
    if ( mapsUrl ) {
      actions.push( { key: 'maps', label: this.currentBusinessAddress ? 'Directions' : 'Open in Maps', shortLabel: 'Go', icon: 'fa-location-arrow', href: mapsUrl } );
    }
    if ( this.currentBusinessPhone ) {
      actions.push( { key: 'call', label: 'Call', shortLabel: 'Call', icon: 'fa-phone', href: this.currentBusinessPhoneHref } );
    }
    const url = String( this.currentCard.url || '' ).trim();
    if ( /^https?:\/\//i.test( url ) ) {
      actions.push( { key: 'site', label: 'Visit site', shortLabel: 'Site', icon: 'fa-globe', href: url } );
      actions.push( { key: 'copy-link', label: 'Copy link', shortLabel: 'Copy', icon: 'fa-copy', copyText: url } );
    }
    return actions;
  }

  private get isPlaceResult (): boolean {
    return this.isLocalMode || !!this.currentBusinessHours || !!this.currentBusinessAddress || !!this.currentBusinessPhone;
  }

  /** Apple Maps on Apple devices, Google Maps elsewhere: directions to the
   *  address, or a search for the place name plus any "City, ST" in the title. */
  private get directionsUrl (): string {
    const address = this.currentBusinessAddress;
    const query = address || this.mapsSearchQuery;
    if ( !query ) return '';
    const encoded = encodeURIComponent( query );
    const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test( navigator.userAgent );
    if ( isApple ) return address ? `https://maps.apple.com/?daddr=${ encoded }` : `https://maps.apple.com/?q=${ encoded }`;
    return address
      ? `https://www.google.com/maps/dir/?api=1&destination=${ encoded }`
      : `https://www.google.com/maps/search/?api=1&query=${ encoded }`;
  }

  /** "Young's Restaurant | Seattle, WA | View and Order Online" -> "Young's Restaurant Seattle, WA". */
  private get mapsSearchQuery (): string {
    const segments = String( this.currentCard?.title || '' )
      .split( /\s*[|–—]\s*|\s+-\s+/ )
      .map( segment => segment.trim() )
      .filter( Boolean );
    if ( !segments.length ) return '';
    const city = segments.slice( 1 ).find( segment => /^[A-Za-z .'-]+, [A-Z]{2}$/.test( segment ) );
    return [ segments[0], city ].filter( Boolean ).join( ' ' );
  }

  trackAction ( _: number, action: FindAction ): string {
    return action.key;
  }

  async copyAction ( action: FindAction ): Promise<void> {
    if ( !action.copyText ) return;
    try {
      await navigator.clipboard.writeText( action.copyText );
    } catch {
      return;
    }
    this.copiedActionKey = action.key;
    if ( this.copiedTimer !== null ) clearTimeout( this.copiedTimer );
    this.copiedTimer = setTimeout( () => {
      this.copiedActionKey = '';
      this.copiedTimer = null;
    }, 1500 );
  }

  // --- Compact feedback row ---

  get feedbackSent (): boolean {
    return !!this.feedbackSentFor && this.feedbackSentFor === this.feedbackKey;
  }

  sendFeedback ( rating: FindFeedbackRating ): void {
    if ( this.feedbackSent ) return;
    this.feedbackSentFor = this.feedbackKey;
    this.findExperienceService.submitFeedback( {
      rating,
      query: String( this.result?.query || this.query || '' ).trim() || null,
      queryType: this.result?.queryType || null,
    } ).subscribe( { error: () => { } } );
  }

  private get feedbackKey (): string {
    return String( this.result?.query || this.query || '' ).trim().toLowerCase();
  }

  // --- Weather ---

  /** Font Awesome icon plus a colour tone (sun / cloud / rain / snow) for a condition. */
  weatherIcon ( condition: string | null | undefined ): { icon: string; tone: string } {
    const text = String( condition || '' ).toLowerCase();
    if ( /thunder|storm/.test( text ) ) return { icon: 'fa-cloud-bolt', tone: 'rain' };
    if ( /snow|sleet|flurr|ice|blizzard/.test( text ) ) return { icon: 'fa-snowflake', tone: 'snow' };
    if ( /rain|shower|drizzle/.test( text ) ) return { icon: 'fa-cloud-rain', tone: 'rain' };
    if ( /fog|haze|smoke|mist/.test( text ) ) return { icon: 'fa-smog', tone: 'cloud' };
    if ( /partly|mostly sunny|mostly clear/.test( text ) ) return { icon: 'fa-cloud-sun', tone: 'sun' };
    if ( /sun|clear|fair/.test( text ) ) return { icon: 'fa-sun', tone: 'sun' };
    return { icon: 'fa-cloud', tone: 'cloud' };
  }

  /** "Saturday" -> "Sat", so day names fit the narrow forecast column. */
  forecastDayLabel ( day: FindWeatherForecastDay ): string {
    return String( day.label || day.date || '' ).replace( /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*day\b/g, '$1' );
  }

  /** Position of a day's low→high bar within the whole forecast's range, in %. */
  forecastBar ( day: FindWeatherForecastDay ): { left: number; width: number } | null {
    const forecast = this.result?.weather?.forecast || [];
    const temps = forecast
      .flatMap( item => [ item.lowF, item.highF ] )
      .filter( ( value ): value is number => typeof value === 'number' && Number.isFinite( value ) );
    if ( !temps.length || typeof day.lowF !== 'number' || typeof day.highF !== 'number' ) return null;
    const min = Math.min( ...temps );
    const range = Math.max( ...temps ) - min;
    if ( range <= 0 ) return { left: 0, width: 100 };
    return {
      left: ( day.lowF - min ) / range * 100,
      width: Math.max( 4, ( day.highF - day.lowF ) / range * 100 )
    };
  }

  isImageBroken ( url: string | null | undefined ): boolean {
    const normalized = String( url || '' ).trim();
    return !normalized || this.brokenImageUrls.has( normalized );
  }

  onImageError ( url: string | null | undefined ): void {
    const normalized = String( url || '' ).trim();
    if ( normalized ) this.brokenImageUrls.add( normalized );
  }

  get liveElapsedSeconds (): string {
    return ( this.loadingElapsedMs / 1000 ).toFixed( 1 );
  }

  get responseSeconds (): string {
    return ( this.lastResponseMs / 1000 ).toFixed( 1 );
  }

  get questionAnswerText (): string {
    return String( this.result?.answer?.text || '' ).trim();
  }

  get questionReferences () {
    return this.result?.answer?.references || [];
  }

  get isGroundedAnswerSlide (): boolean {
    // The generated answer leads as its own slide (see viewingGroundedAnswer)
    // rather than replacing the top-ranked source card — swiping forward
    // reaches every ranked result exactly as before.
    return this.isQuestionMode && this.viewingGroundedAnswer && !!this.questionAnswerText;
  }

  get currentQuestionEyebrow (): string {
    return this.isGroundedAnswerSlide ? 'Answer' : `Result ${this.resultIndex + 1}`;
  }

  get currentQuestionTitle (): string {
    if ( this.isGroundedAnswerSlide ) {
      return String( this.result?.query || '' ).trim();
    }
    return String( this.currentCard?.title || this.result?.query || '' ).trim();
  }

  get currentQuestionText (): string {
    return this.isGroundedAnswerSlide ? this.questionAnswerText : this.currentAnswerText;
  }

  onConversionAmountChange ( value: number | string ): void {
    this.conversionAmountText = String( value ?? '' ).replace( /[^\d.-]/g, '' );
    const next = Number( this.conversionAmountText );
    this.conversionAmount = Number.isFinite( next ) ? next : 0;
    this.calculateConversion();
  }

  appendConversionDigit ( digit: string ): void {
    const current = this.conversionAmountText === '0' ? '' : this.conversionAmountText;
    this.onConversionAmountChange( `${current}${digit}` );
  }

  appendConversionDecimal (): void {
    if ( this.conversionAmountText.includes( '.' ) ) return;
    this.conversionAmountText = `${this.conversionAmountText || '0'}.`;
    this.conversionAmount = Number( this.conversionAmountText ) || 0;
    this.calculateConversion();
  }

  deleteConversionDigit (): void {
    const next = this.conversionAmountText.slice( 0, -1 );
    this.onConversionAmountChange( next || '0' );
  }

  clearConversionAmount (): void {
    this.onConversionAmountChange( '0' );
  }

  onConversionUnitChange (): void {
    this.refreshCurrencyRate();
    this.calculateConversion();
  }

  swapConversion (): void {
    const previousInput = this.conversionInputUnit;
    this.conversionInputUnit = this.conversionOutputUnit;
    this.conversionOutputUnit = previousInput;
    this.refreshCurrencyRate();
    this.calculateConversion();
  }

  /** Backspace key: tap deletes one digit, a long press clears the amount. */
  onBackspacePointerDown (): void {
    this.cancelBackspacePress();
    this.backspaceLongPressed = false;
    this.backspaceTimer = setTimeout( () => {
      this.backspaceLongPressed = true;
      this.backspaceTimer = null;
      this.clearConversionAmount();
    }, 500 );
  }

  cancelBackspacePress (): void {
    if ( this.backspaceTimer !== null ) {
      clearTimeout( this.backspaceTimer );
      this.backspaceTimer = null;
    }
  }

  onBackspaceClick (): void {
    this.cancelBackspacePress();
    if ( this.backspaceLongPressed ) {
      this.backspaceLongPressed = false;
      return;
    }
    this.deleteConversionDigit();
  }

  /** Short unit shown in the unit pill: "USD", "°F", "km". */
  conversionUnitShort ( unit: string ): string {
    if ( this.conversionCategory === 'temperature' ) return `°${ unit }`;
    return unit === 'l' ? 'L' : unit;
  }

  /** Full unit name shown under the amount: "US Dollar", "Kilometers". */
  conversionUnitName ( unit: string ): string {
    const option = this.conversionUnitOptions.find( item => item.value === unit );
    return String( option?.label || unit ).replace( /\s*\([^)]*\)\s*$/, '' );
  }

  get conversionResultText (): string {
    if ( this.conversionOutputAmount === null ) return '';
    const output = Number( this.conversionOutputAmount.toFixed( 4 ) );
    return `${ this.conversionAmount } ${ this.conversionUnitShort( this.conversionInputUnit ) } = ${ output } ${ this.conversionUnitShort( this.conversionOutputUnit ) }`;
  }

  get currentQuestionSourceUrl (): string {
    if ( this.isGroundedAnswerSlide ) return '';
    return String( this.currentCard?.displayUrl || '' ).trim();
  }

  // Surfaces the backend's sourceType classification as a trust badge so a
  // verified .gov/.edu/medical result doesn't look indistinguishable from an
  // ordinary publisher link — users otherwise have no way to tell a
  // legitimate government site apart from a lookalike before clicking.
  private readonly sourceTrustLabels: Partial<Record<FindSourceType, string>> = {
    government: 'Verified government site',
    official: 'Verified official site',
    medical: 'Verified medical source',
    academic: 'Verified academic source',
    encyclopedia: 'Encyclopedia',
  };

  sourceTrustLabel ( sourceType: FindSourceType | undefined | null ): string {
    return sourceType ? ( this.sourceTrustLabels[sourceType] || '' ) : '';
  }

  formatRichText ( text: string ): string {
    const normalized = String( text || '' )
      .replace( /\r\n/g, '\n' )
      .replace( /\n{3,}/g, '\n\n' )
      .trim();

    if ( !normalized ) return '';

    return this.normalizeParagraphs( normalized )
      .map( paragraph => this.renderRichTextBlock( paragraph ) )
      .join( '' );
  }

  private updateCards (): void {
    this.viewingGroundedAnswer = this.result?.queryType === 'question' && !!this.result?.answer?.text;
    if ( !this.result || !Array.isArray( this.result.results ) ) {
      this.allResults = [];
      this.allCards = [];
      this.gridVisibleCount = 10;
      this.currentCard = null;
      return;
    }
    this.allResults = this.result.results
      .slice( 0, 20 )
      .map( ( item, index ) => ( {
        ...item,
        rank: index + 1,
        imageUrl: this.isRealImage( item.imageUrl ) ? item.imageUrl : ''
      } ) )
      .filter( card => !!card.imageUrl || !!String( card.summary || '' ).trim() );
    this.allCards = this.allResults.slice( 0, 10 );
    this.gridVisibleCount = Math.min( 10, this.allResults.length );
    if ( this.selectedResultIndex >= this.allCards.length ) {
      this.selectedResultIndex = 0;
    }
    if ( this.resultIndex >= this.allCards.length ) {
      this.resultIndex = 0;
    }
    this.currentCard = this.allCards[this.resultIndex] ?? null;
  }

  get gridCards (): FindRankedResult[] {
    return this.allResults.slice( 0, this.gridVisibleCount );
  }

  get hasMoreGridResults (): boolean {
    return this.gridVisibleCount < this.allResults.length;
  }

  get totalResultCount (): number {
    return this.allResults.length;
  }

  loadMoreGridResults (): void {
    this.gridVisibleCount = Math.min( this.allResults.length, this.gridVisibleCount + 10 );
  }

  private isRealImage ( url: string ): boolean {
    return !!url && !url.startsWith( 'data:image/svg+xml' );
  }

  private isUsableImage ( url: string | null | undefined ): boolean {
    const normalized = String( url || '' ).trim();
    return !!normalized && !this.brokenImageUrls.has( normalized );
  }

  private normalizeParagraphs ( text: string ): string[] {
    const explicitParagraphs = text.split( /\n{2,}/ ).map( paragraph => paragraph.trim() ).filter( Boolean );
    if ( explicitParagraphs.length !== 1 || explicitParagraphs[0].includes( '\n' ) ) {
      return explicitParagraphs;
    }

    const singleParagraph = explicitParagraphs[0];
    const sentences = singleParagraph.match( /[^.!?]+(?:[.!?]+|$)/g )
      ?.map( sentence => sentence.trim() )
      .filter( Boolean ) || [];

    if ( singleParagraph.length < 240 || sentences.length < 4 ) {
      return explicitParagraphs;
    }

    const chunkSize = sentences.length >= 6 ? 2 : 3;
    const regrouped: string[] = [];
    for ( let index = 0; index < sentences.length; index += chunkSize ) {
      regrouped.push( sentences.slice( index, index + chunkSize ).join( ' ' ) );
    }
    return regrouped;
  }

  private renderRichTextBlock ( block: string ): string {
    const lines = block.split( '\n' ).map( line => line.trim() ).filter( Boolean );
    if ( lines.length === 0 ) return '';

    const bulletLines = lines.filter( line => /^([-*•]|\d+[.)])\s+/.test( line ) );
    if ( bulletLines.length === lines.length ) {
      const ordered = lines.every( line => /^\d+[.)]\s+/.test( line ) );
      const tag = ordered ? 'ol' : 'ul';
      const items = lines
        .map( line => line.replace( /^([-*•]|\d+[.)])\s+/, '' ) )
        .map( line => `<li>${ this.escapeHtml( line ) }</li>` )
        .join( '' );
      return `<${ tag }>${ items }</${ tag }>`;
    }

    return `<p>${ lines.map( line => this.escapeHtml( line ) ).join( '<br>' ) }</p>`;
  }

  private escapeHtml ( text: string ): string {
    return String( text || '' )
      .replace( /&/g, '&amp;' )
      .replace( /</g, '&lt;' )
      .replace( />/g, '&gt;' );
  }

  private parseHoursFromText ( text: string ): FindBusinessHours | null {
    const source = String( text || '' ).replace( /\u2013|\u2014/g, '-' );
    if ( !/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?\b/i.test( source ) ) return null;

    const dayPattern = '\\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\b';
    const matches = Array.from( source.matchAll( new RegExp( `${ dayPattern }\\s*[-:]`, 'gi' ) ) );
    if ( !matches.length ) return null;

    const days: FindBusinessHoursDay[] = matches.map( ( match, index ) => {
      const start = ( match.index || 0 ) + match[0].length;
      const end = index + 1 < matches.length ? ( matches[index + 1].index || source.length ) : source.length;
      const segment = source.slice( start, end ).replace( /[.,…]+\s*$/, '' );
      if ( /\bclosed\b/i.test( segment ) ) {
        return { day: this.normalizeDayName( match[1] ), periods: [], isClosed: true };
      }
      if ( /24\s*hours|open\s*24/i.test( segment ) ) {
        return { day: this.normalizeDayName( match[1] ), periods: [], isTwentyFourHours: true };
      }
      const periods = Array.from( segment.matchAll( /(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/gi ) )
        .map( period => ( { open: period[1].replace( /\s+/g, ' ' ), close: period[2].replace( /\s+/g, ' ' ) } ) );
      return { day: this.normalizeDayName( match[1] ), periods };
    } ).filter( day => day.isClosed || day.isTwentyFourHours || day.periods.length > 0 );

    if ( !days.length ) return null;
    return { days, isOpenNow: undefined };
  }

  private normalizeDayName ( value: string ): string {
    const names: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
    const normalized = String( value || '' ).toLowerCase();
    return names[normalized.slice( 0, 3 )] || value;
  }

  // Places results fall back to a Google Maps link (googleMapsUri, or a
  // constructed place-id URL) when a business has no real website — nothing
  // useful to scrape/summarize there, unlike an actual business site.
  private isGoogleMapsUrl ( url: string | null | undefined ): boolean {
    try {
      const parsed = new URL( String( url || '' ) );
      const host = parsed.hostname.replace( /^www\./, '' );
      return host === 'maps.google.com' || ( host === 'google.com' && parsed.pathname.startsWith( '/maps' ) );
    } catch {
      return false;
    }
  }

  private loadSummary (): void {
    this.summarySub?.unsubscribe();
    const card = this.allCards[0];
    // First-party cards already carry curated, approved copy (see
    // findFirstPartyCatalog.js) — an LLM rewrite of it risks mangling
    // brand names and drifting from approved wording.
    if ( !card || card.isFirstParty ) return;
    this.summarySub = this.findExperienceService.summarize( {
      query: this.query,
      url: card.url,
      title: card.title,
    } ).subscribe( {
      next: ( res ) => {
        if ( ( res?.answer || res?.hours ) && this.allCards[0]?.url === card.url ) {
          const patch = {
            ...( res.answer ? { answer: res.answer } : {} ),
            ...( res.hours ? { hours: res.hours } : {} )
          };
          this.allCards[0] = { ...this.allCards[0], ...patch };
          if ( this.resultIndex === 0 ) this.currentCard = this.allCards[0];
          // allResults[0] only shares allCards[0]'s object reference until
          // this reassignment — patch it too so the grid view's tile for
          // this same result doesn't show stale answer/hours data.
          if ( this.allResults[0]?.url === card.url ) {
            this.allResults[0] = { ...this.allResults[0], ...patch };
          }
        }
      },
      error: () => {},
    } );
  }

  highlightTerms ( text: string ): string {
    const safe = String( text || '' )
      .replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' );
    const query = String( this.result?.query || this.query || '' ).trim();
    if ( !query ) return safe;
    const words = query.split( /\s+/ ).filter( w => w.length > 2 );
    if ( !words.length ) return safe;
    const escaped = words.map( w => w.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) );
    const pattern = new RegExp( `(${ escaped.join( '|' ) })`, 'gi' );
    return safe.replace( pattern, '<span class="find-highlight">$1</span>' );
  }

  /** Pill text, prefixed with its tilt direction (L/R/U/D) while tilt navigation is on. */
  pillLabel ( pill: string, index: number ): string {
    if ( !this.gyroEnabled ) return pill;
    const letter = ( Object.keys( this.tiltToPillIndex ) as GyroTilt[] )
      .find( ( tilt ) => this.tiltToPillIndex[tilt] === index );
    return letter ? `${ letter.charAt( 0 ).toUpperCase() } - ${ pill }` : pill;
  }

  // --- History ---

  onHistoryClick ( query: string ): void {
    this.query = query;
    this.navigate( query );
  }

  clearHistory (): void {
    this.searchHistory = [];
    try { localStorage.removeItem( this.HISTORY_KEY ); } catch { /* ignore */ }
  }

  // --- Pill / drill-down ---

  onPillClick ( pill: string ): void {
    const base = String( this.query || '' ).trim();
    if ( !base ) return;
    const nextContext = this.activeContext === pill ? '' : pill;
    this.activeContext = nextContext;
    this.syncBreadcrumb();
    this.resultIndex = 0;
    this.selectedResultIndex = 0;
    this.highlightedPill = '';
    this.activeView = 'result';
    this.navigate( base, nextContext || null );
  }

  openCardDetail ( index: number ): void {
    if ( index < 0 || index >= this.allCards.length ) return;
    this.resultIndex = index;
    this.viewingGroundedAnswer = false;
    this.currentCard = this.allCards[index] ?? null;
    this.activeView = 'detail';
  }

  backFromResultView (): void {
    if ( this.activeView === 'detail' ) {
      this.activeView = 'booklet';
      return;
    }
    this.resetToSearch();
  }

  /** Move to the previous result, or return to Home from the first result. */
  onPreviousResult (): void {
    if ( this.activeView === 'detail' ) {
      this.backFromResultView();
      return;
    }

    if ( this.viewingGroundedAnswer ) {
      this.resetToSearch();
      return;
    }

    if ( this.resultIndex === 0 ) {
      if ( this.isQuestionMode && this.questionAnswerText ) {
        this.viewingGroundedAnswer = true;
        return;
      }
      this.resetToSearch();
      return;
    }

    this.resultIndex--;
    this.currentCard = this.allCards[this.resultIndex] ?? null;
  }

  /** Move to the next result when one is available. */
  onNextResult (): void {
    if ( this.activeView === 'detail' ) return;

    if ( this.viewingGroundedAnswer ) {
      this.viewingGroundedAnswer = false;
      return;
    }

    const max = this.allCards.length - 1;
    if ( this.resultIndex >= max ) return;

    this.resultIndex++;
    this.currentCard = this.allCards[this.resultIndex] ?? null;
  }

  // --- Swipe ---

  onSwipeLeft (): void {
    this.onNextResult();
  }

  onSwipeRight (): void {
    this.onPreviousResult();
  }

  onSwipeUp (): void {
    if ( this.highlightedPill ) this.onPillClick( this.highlightedPill );
  }

  onSwipeDown (): void {
    if ( this.activeContext ) {
      this.activeContext = '';
      this.syncBreadcrumb();
      this.resultIndex = 0;
      this.selectedResultIndex = 0;
      this.navigate( this.query, null );
    }
  }

  // --- Gyroscope ---

  async enableGyroscope (): Promise<void> {
    const ok = await this.gyroscope.enable();
    if ( !ok ) return;
    this.gyroEnabled = true;
    this.gyroSub = this.gyroscope.tilt$.subscribe( ( tilt ) => this.onTilt( tilt ) );
  }

  private onTilt ( tilt: GyroTilt ): void {
    this.clearGyroTimer();
    const idx = this.tiltToPillIndex[tilt] ?? -1;
    const pills = this.currentPills;
    this.highlightedPill = idx >= 0 && pills[idx] ? pills[idx] : '';
    if ( this.highlightedPill ) {
      this.gyroHoldTimer = setTimeout( () => {
        if ( this.highlightedPill ) this.onPillClick( this.highlightedPill );
      }, this.GYRO_HOLD_MS );
    }
  }

  private clearGyroTimer (): void {
    if ( this.gyroHoldTimer !== null ) {
      clearTimeout( this.gyroHoldTimer );
      this.gyroHoldTimer = null;
    }
  }

  private startLoadingTimer (): void {
    this.stopLoadingTimer();
    this.loadingStartedAtMs = Date.now();
    this.loadingElapsedMs = 0;
    this.loadingTimer = setInterval( () => {
      if ( this.loadingStartedAtMs === null ) return;
      this.loadingElapsedMs = Date.now() - this.loadingStartedAtMs;
    }, 100 );
  }

  private stopLoadingTimer ( finalElapsedMs?: number ): void {
    if ( this.loadingTimer !== null ) {
      clearInterval( this.loadingTimer );
      this.loadingTimer = null;
    }

    if ( typeof finalElapsedMs === 'number' ) {
      this.loadingElapsedMs = finalElapsedMs;
      this.lastResponseMs = finalElapsedMs;
    } else if ( this.loadingStartedAtMs !== null ) {
      const elapsed = Date.now() - this.loadingStartedAtMs;
      this.loadingElapsedMs = elapsed;
      this.lastResponseMs = elapsed;
    }

    this.loadingStartedAtMs = null;
  }

  private navigate ( q: string, context?: string | null ): void {
    this.router.navigate( [], {
      relativeTo: this.route,
      queryParams: {
        query: q,
        context: String( context || '' ).trim() || null
      },
      queryParamsHandling: 'merge'
    } );
  }

  private syncBreadcrumb (): void {
    const base = String( this.query || '' ).trim();
    const context = String( this.activeContext || '' ).trim();
    this.breadcrumb = [base, context].filter( Boolean );
  }

  private loadHistory (): void {
    try {
      const raw = localStorage.getItem( this.HISTORY_KEY );
      this.searchHistory = raw ? JSON.parse( raw ) : [];
    } catch {
      this.searchHistory = [];
    }
  }

  private saveToHistory ( query: string ): void {
    this.searchHistory = [query, ...this.searchHistory.filter( q => q !== query )].slice( 0, this.HISTORY_MAX );
    try {
      localStorage.setItem( this.HISTORY_KEY, JSON.stringify( this.searchHistory ) );
    } catch { /* ignore */ }
  }

  private runSearch ( query: string, resetBreadcrumb: boolean, contextOverride?: string | null ): void {
    if ( resetBreadcrumb ) this.breadcrumb = [];
    const normalizedContext = String( ( contextOverride ?? this.activeContext ) || '' ).trim();
    this.activeContext = normalizedContext;
    this.syncBreadcrumb();
    this.isLoading = true;
    this.startLoadingTimer();
    this.errorMessage = '';
    // Switch to result view immediately so the loading spinner shows there
    if ( this.activeView === 'search' ) {
      this.activeView = 'result';
      this.result = null;
      this.updateCards();
    }

    this.resolveCoordinatesForQuery( query ).then( ( coords ) => {
      this.findExperienceService.search( {
        query,
        context: normalizedContext || null,
        maxResults: 20,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null
      } ).subscribe( {
        next: ( response ) => {
          this.isLoading = false;
          this.stopLoadingTimer( response?.timings?.totalMs );
          this.result = response || null;
          this.syncConversionState( response?.conversion || null );
          this.selectedResultIndex = Math.max( 0, Math.min( response.selectedIndex || 0, ( response.results?.length || 1 ) - 1 ) );
          this.resultIndex = this.selectedResultIndex;
          this.updateCards();
          this.highlightedPill = '';
          this.activeView = 'result';
          this.saveToHistory( query );
          const newlyUnlocked = this.awardsService.recordSearch();
          if ( newlyUnlocked ) this.pendingAwardUnlock = newlyUnlocked;
          const isLocalResult = response?.queryType === 'local';
          const localHasRealWebsite = isLocalResult && !this.isGoogleMapsUrl( response.results?.[0]?.url );
          // RSS headlines already carry the publisher's own summary.
          if ( response?.queryType !== 'question' && response?.queryType !== 'weather' && response?.queryType !== 'conversion' && response?.queryType !== 'movie' && !this.isHeadlineMode && ( !isLocalResult || localHasRealWebsite ) ) {
            this.loadSummary();
          }
        },
        error: ( err ) => {
          this.isLoading = false;
          this.stopLoadingTimer();
          this.result = null;
          this.updateCards();
          this.activeView = 'search';
          this.selectedResultIndex = 0;
          this.errorMessage = err?.error?.message || err?.message || 'Find could not produce a result right now.';
          this.syncConversionState( null );
        }
      } );
    } );
  }

  // Geolocation is requested only for location-shaped queries (including the
  // Weather shortcut), never on page load, and the granted position is cached for the rest of the
  // session so the browser prompt doesn't reappear on every search. A
  // denied/unsupported/timed-out request resolves to null rather than
  // rejecting, so the query still runs (without coordinates) instead of
  // blocking — the backend falls back to normal search if location is absent and the
  // search falls through to a normal result.
  private resolveCoordinatesForQuery ( query: string ): Promise<{ latitude: number; longitude: number } | null> {
    if ( !this.NEAR_ME_PATTERN.test( query ) && !this.LOCATIONLESS_WEATHER_PATTERN.test( query ) ) return Promise.resolve( null );
    if ( this.lastKnownPosition ) return Promise.resolve( this.lastKnownPosition );
    if ( typeof navigator === 'undefined' || !navigator.geolocation ) return Promise.resolve( null );

    return new Promise( ( resolve ) => {
      const timeoutId = setTimeout( () => resolve( null ), 8000 );
      navigator.geolocation.getCurrentPosition(
        ( position ) => {
          clearTimeout( timeoutId );
          this.lastKnownPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          resolve( this.lastKnownPosition );
        },
        () => {
          clearTimeout( timeoutId );
          resolve( null );
        },
        { timeout: 8000, maximumAge: 5 * 60 * 1000 }
      );
    } );
  }

  private syncConversionState ( conversion: FindConversionResult | null ): void {
    if ( !conversion ) {
      this.conversionAmount = 0;
      this.conversionAmountText = '0';
      this.conversionOutputAmount = null;
      this.conversionInputUnit = '';
      this.conversionOutputUnit = '';
      this.conversionRate = null;
      this.conversionRateUpdatedAt = '';
      this.conversionSource = '';
      this.conversionBaseInputUnit = '';
      this.conversionBaseOutputUnit = '';
      this.conversionBaseRate = null;
      return;
    }
    this.conversionAmount = conversion.inputAmount;
    this.conversionAmountText = String( conversion.inputAmount );
    this.conversionOutputAmount = conversion.outputAmount;
    this.conversionInputUnit = this.normalizeConversionUnit( conversion.inputUnit );
    this.conversionOutputUnit = this.normalizeConversionUnit( conversion.outputUnit );
    this.conversionRate = conversion.rate ?? null;
    this.conversionRateUpdatedAt = conversion.rateUpdatedAt || '';
    this.conversionSource = conversion.source || '';
    this.conversionBaseInputUnit = this.conversionInputUnit;
    this.conversionBaseOutputUnit = this.conversionOutputUnit;
    this.conversionBaseRate = this.conversionRate;
  }

  private calculateConversion (): void {
    if ( !this.conversion ) return;
    if ( this.conversionCategory === 'currency' ) {
      this.conversionOutputAmount = this.conversionRate === null
        ? null
        : this.conversionAmount * this.conversionRate;
      return;
    }

    const category = this.conversionCategory;
    const input = this.unitFactor( category, this.conversionInputUnit );
    const output = this.unitFactor( category, this.conversionOutputUnit );
    if ( input === null || output === null ) {
      this.conversionOutputAmount = null;
      return;
    }
    if ( category === 'temperature' ) {
      const celsius = this.conversionInputUnit === 'F'
        ? ( this.conversionAmount - 32 ) * 5 / 9
        : ( this.conversionAmount * 9 / 5 ) + 32;
      this.conversionOutputAmount = this.conversionOutputUnit === 'F'
        ? celsius * 9 / 5 + 32
        : celsius;
      return;
    }
    this.conversionOutputAmount = this.conversionAmount * input / output;
  }

  private refreshCurrencyRate (): void {
    if ( this.conversionCategory !== 'currency' ) return;
    if ( this.conversionInputUnit === this.conversionBaseInputUnit && this.conversionOutputUnit === this.conversionBaseOutputUnit ) {
      this.conversionRate = this.conversionBaseRate;
      return;
    }
    if ( this.conversionInputUnit === this.conversionBaseOutputUnit && this.conversionOutputUnit === this.conversionBaseInputUnit && this.conversionBaseRate ) {
      this.conversionRate = 1 / this.conversionBaseRate;
      return;
    }
    this.conversionRate = null;
  }

  private normalizeConversionUnit ( value: string ): string {
    const normalized = String( value || '' ).trim().toLowerCase();
    const aliases: Record<string, string> = {
      dollar: 'USD', dollars: 'USD', usd: 'USD',
      cad: 'CAD', eur: 'EUR', euro: 'EUR', euros: 'EUR',
      gbp: 'GBP',
      jpy: 'JPY', yen: 'JPY', aud: 'AUD', cny: 'CNY', yuan: 'CNY',
      chf: 'CHF', mxn: 'MXN',
      fahrenheit: 'F', celsius: 'C',
      mile: 'mi', miles: 'mi', kilometer: 'km', kilometers: 'km',
      pound: 'lb', pounds: 'lb', poundmass: 'lb', kilogram: 'kg', kilograms: 'kg',
      inch: 'in', inches: 'in', centimeter: 'cm', centimeters: 'cm',
      foot: 'ft', feet: 'ft', meter: 'm', meters: 'm',
      gallon: 'gal', gallons: 'gal', liter: 'l', liters: 'l',
    };
    return aliases[normalized] || String( value || '' ).trim();
  }

  private unitFactor ( category: FindConversionCategory | null, unit: string ): number | null {
    const factors: Record<string, Record<string, number>> = {
      distance: { mi: 1609.344, km: 1000 },
      weight: { lb: 0.45359237, kg: 1 },
      length: { in: 0.0254, cm: 0.01, ft: 0.3048, m: 1 },
      volume: { gal: 3.785411784, l: 1 },
    };
    return category && category !== 'temperature' && category !== 'currency'
      ? factors[category]?.[unit] ?? null
      : 1;
  }
}
