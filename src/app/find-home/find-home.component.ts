import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { FindSwipeDirective } from '../directives/find-swipe.directive';
import { FindExperienceService, FindRankedResult, FindSearchResponse } from '../services/find-experience.service';
import { FindGyroscopeService, GyroTilt } from '../services/find-gyroscope.service';

type FindView = 'search' | 'result' | 'detail' | 'booklet' | 'history' | 'info';

@Component( {
  selector: 'app-find-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, FindSwipeDirective],
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
  resultIndex = 0;
  selectedResultIndex = 0;
  allCards: FindRankedResult[] = [];
  currentCard: FindRankedResult | null = null;

  gyroEnabled = false;
  gyroSupported = false;
  highlightedPill = '';

  searchHistory: string[] = [];
  private readonly brokenImageUrls = new Set<string>();
  heroImageOrientation: 'landscape' | 'portrait' | 'square' | null = null;
  heroImageAspectRatio = 16 / 9;

  private readonly HISTORY_KEY = 'find-history';
  private readonly HISTORY_MAX = 20;
  private readonly tiltToPillIndex: Partial<Record<GyroTilt, number>> = {
    left: 0, right: 1, up: 2, down: 3
  };

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
    private readonly gyroscope: FindGyroscopeService
  ) { }

  ngOnInit (): void {
    this.gyroSupported = this.gyroscope.isSupported;
    this.loadHistory();

    this.routeSub = this.route.queryParamMap.subscribe( ( params ) => {
      // Support both the app's internal `query` parameter and browser search
      // shortcuts such as Firefox, which use the conventional `q` parameter.
      const next = String( params.get( 'query' ) || params.get( 'q' ) || '' ).trim();
      const nextContext = String( params.get( 'context' ) || '' ).trim();
      if ( next ) {
        this.query = next;
        this.activeContext = nextContext;
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
    if ( view === 'booklet' && ( !this.result || this.isWeatherMode ) ) return;
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

  get currentHasHeroImage (): boolean {
    if ( this.isGroundedAnswerSlide ) {
      return this.isUsableImage( this.result?.answer?.imageUrl || this.currentCard?.imageUrl || '' );
    }
    return this.isUsableImage( this.currentCard?.imageUrl || '' );
  }

  get currentHeroImage (): string {
    if ( this.isGroundedAnswerSlide ) {
      return String( this.result?.answer?.imageUrl || this.currentCard?.imageUrl || '' ).trim();
    }
    return String( this.currentCard?.imageUrl || '' ).trim();
  }

  isImageBroken ( url: string | null | undefined ): boolean {
    const normalized = String( url || '' ).trim();
    return !normalized || this.brokenImageUrls.has( normalized );
  }

  onImageError ( url: string | null | undefined ): void {
    const normalized = String( url || '' ).trim();
    if ( normalized ) this.brokenImageUrls.add( normalized );
  }

  onHeroImageLoad ( event: Event ): void {
    const image = event.target as HTMLImageElement | null;
    if ( !image?.naturalWidth || !image.naturalHeight ) return;

    this.heroImageAspectRatio = image.naturalWidth / image.naturalHeight;
    if ( this.heroImageAspectRatio > 1.15 ) {
      this.heroImageOrientation = 'landscape';
    } else if ( this.heroImageAspectRatio < 0.9 ) {
      this.heroImageOrientation = 'portrait';
    } else {
      this.heroImageOrientation = 'square';
    }
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
    return this.isQuestionMode && this.resultIndex === this.selectedResultIndex && !!this.questionAnswerText;
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

  get currentQuestionSourceUrl (): string {
    if ( this.isGroundedAnswerSlide ) return '';
    return String( this.currentCard?.displayUrl || '' ).trim();
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
    if ( !this.result || !Array.isArray( this.result.results ) ) {
      this.allCards = [];
      this.currentCard = null;
      return;
    }
    this.allCards = this.result.results
      .slice( 0, 10 )
      .map( ( item, index ) => ( {
        ...item,
        rank: index + 1,
        imageUrl: this.isRealImage( item.imageUrl ) ? item.imageUrl : ''
      } ) )
      .filter( card => !!card.imageUrl || !!String( card.summary || '' ).trim() );
    if ( this.selectedResultIndex >= this.allCards.length ) {
      this.selectedResultIndex = 0;
    }
    if ( this.resultIndex >= this.allCards.length ) {
      this.resultIndex = 0;
    }
    this.currentCard = this.allCards[this.resultIndex] ?? null;
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

  private loadSummary (): void {
    this.summarySub?.unsubscribe();
    const card = this.allCards[0];
    if ( !card ) return;
    this.summarySub = this.findExperienceService.summarize( {
      query: this.query,
      url: card.url,
      title: card.title,
    } ).subscribe( {
      next: ( res ) => {
        if ( res?.answer && this.allCards[0]?.url === card.url ) {
          this.allCards[0] = { ...this.allCards[0], answer: res.answer };
          if ( this.resultIndex === 0 ) this.currentCard = this.allCards[0];
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

    if ( this.resultIndex === 0 ) {
      this.resetToSearch();
      return;
    }

    this.resultIndex--;
    this.currentCard = this.allCards[this.resultIndex] ?? null;
  }

  /** Move to the next result when one is available. */
  onNextResult (): void {
    if ( this.activeView === 'detail' ) return;
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

    this.findExperienceService.search( {
      query,
      context: normalizedContext || null,
      maxResults: 10
    } ).subscribe( {
      next: ( response ) => {
        this.isLoading = false;
        this.stopLoadingTimer( response?.timings?.totalMs );
        this.result = response || null;
        this.selectedResultIndex = Math.max( 0, Math.min( response.selectedIndex || 0, ( response.results?.length || 1 ) - 1 ) );
        this.resultIndex = this.selectedResultIndex;
        this.updateCards();
        this.highlightedPill = '';
        this.activeView = 'result';
        this.saveToHistory( query );
        if ( response?.queryType !== 'question' && response?.queryType !== 'weather' ) {
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
      }
    } );
  }
}
