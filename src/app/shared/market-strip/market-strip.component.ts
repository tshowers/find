import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, PLATFORM_ID, inject } from '@angular/core';

/** TODD Market's public network search (functions/market, shop.routes.js); it allows this origin. */
const MARKET = 'https://market.taliferro.tech';

interface MarketItem {
  id: string; title: string; priceCents: number; image: string | null; storeName: string; storeSlug: string; storeTint: string | null; storeTintFg: string | null;
}

/** A product from a shop Market has listed but that hasn't joined (Market's "Not on TODD Market yet"). */
interface ListingItem {
  id: string; title: string; priceCents: number | null; image: string | null; url: string; storeName: string; storeDomain: string;
}

/**
 * "From local stores on TODD Market": items independent stores in the
 * Market network sell that match the search. When no member store has it,
 * the same strip shows products from shops Market has listed, marked "Not
 * on TODD Market yet", with their own site and "Buy it here" (Market's
 * search, where "Want to buy it here?" lives). Find shows it only for
 * shopping searches (the response's shoppingIntent), under the result, and
 * only items with a photo. Uses Market's ranking-only search (no AI call).
 */
@Component( {
  selector: 'app-market-strip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="market-strip" *ngIf="items.length" aria-label="From local stores on 16Ahead Store">
      <div class="market-strip__head">
        <span class="market-strip__label"><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i> From local stores on 16Ahead Store</span>
        <a [href]="searchUrl" target="_blank" rel="noopener">See all {{ total }} →</a>
      </div>
      <div class="market-strip__items">
        <a *ngFor="let item of items" class="market-strip__item" [href]="itemUrl(item)" target="_blank" rel="noopener">
          <span class="market-strip__img"><img [src]="item.image" alt="" (error)="dropItem(item)"></span>
          <span class="market-strip__store">{{ item.storeName }}</span>
          <strong>{{ item.title }}</strong>
          <span class="market-strip__price">{{ price(item.priceCents) }}</span>
        </a>
      </div>
    </section>
    <section class="market-strip market-strip--listed" *ngIf="!items.length && listings.length" aria-label="From independent shops, not on 16Ahead Store yet">
      <div class="market-strip__head">
        <span class="market-strip__label"><i class="fa-solid fa-store" aria-hidden="true"></i> From independent shops</span>
        <span class="market-strip__tag">Not on 16Ahead Store yet</span>
      </div>
      <div class="market-strip__items">
        <article *ngFor="let item of listings" class="market-strip__item">
          <a class="market-strip__img" [href]="item.url" target="_blank" rel="noopener nofollow" [attr.aria-label]="item.title + ' at ' + item.storeName"><img [src]="item.image" alt="" (error)="dropListing(item)"></a>
          <span class="market-strip__store">{{ item.storeName }}</span>
          <strong>{{ item.title }}</strong>
          <span class="market-strip__price" *ngIf="item.priceCents">{{ price(item.priceCents) }}</span>
          <span class="market-strip__actions">
            <a [href]="item.url" target="_blank" rel="noopener nofollow">Shop on their site ↗</a>
            <a [href]="searchUrl" target="_blank" rel="noopener">Buy it here</a>
          </span>
        </article>
      </div>
    </section>`,
  styles: [`
    .market-strip { display: flex; flex-direction: column; gap: 10px; margin: 14px 0; padding: 16px; border-radius: 20px; background: var(--surface); }
    .market-strip__head { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 13px; }
    .market-strip__label { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
    .market-strip__head a { font-weight: 600; color: var(--blue); text-decoration: none; }
    .market-strip__items { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
    .market-strip__item { display: flex; flex-direction: column; gap: 4px; padding: 8px; border-radius: 16px; background: var(--bg); color: var(--text); text-decoration: none; }
    .market-strip__img { height: 96px; border-radius: 12px; overflow: hidden; background: var(--surface2); }
    .market-strip__img img { width: 100%; height: 100%; object-fit: cover; }
    .market-strip__store { font-size: 12px; font-weight: 700; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .market-strip__item strong { font-size: 14px; line-height: 1.3; }
    .market-strip__price { font-size: 14px; font-weight: 700; }
    .market-strip__tag { padding: 4px 10px; border-radius: 999px; background: var(--bg); font-size: 12px; font-weight: 600; color: var(--muted); }
    .market-strip--listed .market-strip__img { display: block; }
    .market-strip__actions { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: auto; padding-top: 4px; font-size: 13px; font-weight: 600; }
    .market-strip__actions a { color: var(--blue); text-decoration: none; }
  `],
} )
export class MarketStripComponent implements OnChanges {
  @Input() query = '';
  items: MarketItem[] = [];
  listings: ListingItem[] = [];
  total = 0;
  searchUrl = MARKET;
  private readonly cdr = inject( ChangeDetectorRef );
  private readonly isBrowser = isPlatformBrowser( inject( PLATFORM_ID ) );
  private lastQuery = '';

  async ngOnChanges (): Promise<void> {
    const q = String( this.query || '' ).trim();
    if ( !this.isBrowser || !q || q === this.lastQuery ) return;
    this.lastQuery = q;
    this.items = [];
    this.listings = [];
    this.searchUrl = `${ MARKET }/?q=${ encodeURIComponent( q ) }`;
    try {
      const res = await fetch( `${ MARKET }/api/network/search`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify( { query: q, lite: true } ) } );
      if ( !res.ok || q !== this.lastQuery ) return;
      const body = await res.json() as { items?: MarketItem[]; listingItems?: ListingItem[] };
      // No photo, no card (Market's lite search already leaves those out).
      const withImages = ( body.items || [] ).filter( ( i ) => !!i.image );
      this.total = withImages.length;
      this.items = withImages.slice( 0, 4 );
      // Listed shops' photos are sometimes http://, which this https page would block.
      this.listings = withImages.length ? [] : ( body.listingItems || [] )
        .filter( ( i ) => !!i.image && /^https?:\/\//.test( i.url ) )
        .map( ( i ) => ( { ...i, image: String( i.image ).replace( /^http:\/\//, 'https://' ) } ) )
        .slice( 0, 4 );
    } catch {
      this.items = [];
      this.listings = [];
    }
    this.cdr.markForCheck();
  }

  /** A photo that doesn't load takes its card with it. */
  dropItem ( item: MarketItem ): void {
    this.items = this.items.filter( ( i ) => i !== item );
    this.cdr.markForCheck();
  }

  dropListing ( item: ListingItem ): void {
    this.listings = this.listings.filter( ( i ) => i !== item );
    this.cdr.markForCheck();
  }

  itemUrl ( item: MarketItem ): string {
    return `${ MARKET }/${ item.storeSlug }?q=${ encodeURIComponent( this.lastQuery ) }`;
  }

  price ( cents: number ): string {
    const d = cents / 100;
    return '$' + ( Number.isInteger( d ) ? d.toLocaleString( 'en-US' ) : d.toFixed( 2 ) );
  }
}
