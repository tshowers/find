import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { FindCardVideo, FindCompanyMarket, FindCompanyVideos, FindEntity, FindEntitySection, FindEntitySummary, FindExperienceService, FindFirstPartyContact, FindFirstPartyOverview, FindStatTile } from '../../services/find-experience.service';
import { FindVideoPlayerComponent } from '../video-player/find-video-player.component';

const ACTION_ICONS: Record<string, string> = {
  email: 'fa-solid fa-envelope',
  site: 'fa-solid fa-arrow-up-right-from-square',
  open: 'fa-solid fa-arrow-up-right-from-square',
  products: 'fa-solid fa-table-cells-large',
  company: 'fa-solid fa-building',
  linkedin: 'fa-brands fa-linkedin',
  stock: 'fa-solid fa-chart-line',
  news: 'fa-solid fa-newspaper',
};

const CONTACT_ICONS: Record<FindFirstPartyContact[ 'kind' ], string> = {
  call: 'fa-phone',
  email: 'fa-envelope',
  directions: 'fa-location-dot',
  website: 'fa-globe',
};

// design_handoff_find_taliferro_results 5a–5c: our own company ("taliferro
// tech") and products ("image creator"); 5e: any other company ("apple").
// Same layouts and loading behavior as the other single-item cards: A above
// 900px, B below; undefined = loading, null = hidden. Video first, then the
// cyan panel: contact options (with another company's next earnings report
// above them), or a product's How it works.
@Component( {
  selector: 'app-find-company-card',
  standalone: true,
  imports: [ CommonModule, FindVideoPlayerComponent ],
  templateUrl: './find-company-card.component.html',
  styleUrls: [ '../entity-card/find-entity-card.component.css', './find-company-card.component.css' ],
} )
export class FindCompanyCardComponent implements OnChanges, OnDestroy {
  @Input( { required: true } ) entity!: FindEntity;
  @Input() query = '';
  @Input() moreCount: number | null = null;
  @Output() moreResults = new EventEmitter<void>();

  overview?: FindFirstPartyOverview | null;
  summary?: FindEntitySummary | null;
  /** Another company only: market cap and next earnings, and its videos. */
  market?: FindCompanyMarket | null;
  companyVideos?: FindCompanyVideos | null;

  expanded = false;
  readonly openSections = new Set<string>();
  logoFailed = false;

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
    this.overview = this.summary = this.market = this.companyVideos = undefined;
    this.expanded = false;
    this.openSections.clear();
    this.logoFailed = false;
    this.fetch<FindFirstPartyOverview>( 'overview', data => this.overview = data );
    this.fetch<FindEntitySummary>( 'summary', data => this.summary = data?.text ? data : null );
    if ( this.isCorporation ) {
      this.fetch<FindCompanyMarket>( 'market', data => this.market = data );
      this.fetch<FindCompanyVideos>( 'videos', data => this.companyVideos = data );
    }
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

  get isCompany (): boolean {
    return this.entity.type === 'company';
  }

  /** Another company, not ours. */
  get isCorporation (): boolean {
    return this.entity.type === 'corporation';
  }

  /** Company logos sit on a white tile; our product icons fill theirs. */
  get whiteLogo (): boolean {
    return this.isCompany || this.isCorporation;
  }

  get videos (): FindCardVideo[] {
    return ( this.isCorporation ? this.companyVideos?.videos : this.overview?.videos ) || [];
  }

  get videosLoading (): boolean {
    return this.overview === undefined || ( this.isCorporation && this.companyVideos === undefined );
  }

  /** Ours always show the player ("Video coming soon" until there is one); another company's only with videos. */
  get showPlayer (): boolean {
    return !!this.overview && !this.videosLoading && ( !this.isCorporation || this.videos.length > 0 );
  }

  /** Another company's next earnings report heads its panel, above the contacts. */
  get panelHead (): { label: string; title?: string; text?: string } | null {
    if ( !this.overview ) return null;
    return this.market?.next || this.overview.panel;
  }

  /** In layout B the contacts are tiles of their own, so the panel shows for a product's steps or a next event. */
  get showPanelBelow (): boolean {
    return !this.isCompany && ( !this.isCorporation || !!this.market?.next );
  }

  get statTiles (): FindStatTile[] {
    return [ ...( this.market?.tile ? [ this.market.tile ] : [] ), ...( this.overview?.tiles || [] ) ];
  }

  get logo (): string | null {
    return this.logoFailed ? null : this.entity.logoUrl;
  }

  get contacts (): FindFirstPartyContact[] {
    return this.overview?.panel.contacts || [];
  }

  get steps (): string[] {
    return this.overview?.panel.steps || [];
  }

  /** Show more opens the company's background, or a product's FAQs. */
  get hasMore (): boolean {
    return !!( this.overview?.more?.length || this.overview?.faq?.length );
  }

  actionIcon ( kind: string ): string {
    return ACTION_ICONS[ kind ] || 'fa-solid fa-arrow-up-right-from-square';
  }

  contactIcon ( kind: FindFirstPartyContact[ 'kind' ] ): string {
    return CONTACT_ICONS[ kind ];
  }

  /** Links that leave Find open in a new tab; tel: and mailto: don't. */
  isWebLink ( url: string ): boolean {
    return /^https?:/.test( url );
  }

  productNames ( products: Array<{ name: string }> ): string {
    return products.map( product => product.name ).join( ', ' );
  }

  // --- Layout B accordion ---

  toggleSection ( section: string ): void {
    if ( this.openSections.has( section ) ) this.openSections.delete( section );
    else this.openSections.add( section );
  }
}
