import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { MarketStripComponent } from './market-strip.component';

describe( 'MarketStripComponent', () => {
  let fixture: ComponentFixture<MarketStripComponent>;
  let respond: ( body: object ) => void;

  const member = { id: 'p1', title: 'Find Unisex Hoodie', priceCents: 4800, image: 'https://img.test/hoodie.jpg', storeName: 'TODD Apparel', storeSlug: 'todd-apparel', storeTint: null, storeTintFg: null };
  const listing = ( n: number, extra: object = {} ) => ( {
    id: `listing:shop.test:${ n }`, title: `Ribbon Heel ${ n }`, priceCents: 12800, image: `https://shop.test/heel-${ n }.jpg`,
    url: `https://shop.test/products/heel-${ n }`, storeName: 'Shop Test', storeDomain: 'shop.test', ...extra,
  } );

  beforeEach( async () => {
    await TestBed.configureTestingModule( { imports: [MarketStripComponent] } ).compileComponents();
    spyOn( window, 'fetch' ).and.callFake( () => new Promise( ( resolve ) => {
      respond = ( body ) => resolve( { ok: true, json: () => Promise.resolve( body ) } as Response );
    } ) );
    fixture = TestBed.createComponent( MarketStripComponent );
  } );

  function search ( query: string, body: object ): HTMLElement {
    fixture.componentRef.setInput( 'query', query );
    fixture.componentInstance.ngOnChanges();
    respond( body );
    tick();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it( 'shows member stores, and not listed shops, when a member store has it', fakeAsync( () => {
    const el = search( 'hoodie', { items: [member], listingItems: [listing( 1 )] } );
    expect( el.textContent ).toContain( 'From local stores on 16Ahead Store' );
    expect( el.textContent ).toContain( 'Find Unisex Hoodie' );
    expect( el.textContent ).not.toContain( 'Not on 16Ahead Store yet' );
  } ) );

  it( 'falls back to listed shops, marked not on 16Ahead Store yet, with their site and Buy it here', fakeAsync( () => {
    const el = search( 'heels', { items: [], listingItems: [listing( 1 ), listing( 2, { image: 'http://shop.test/heel-2.jpg', priceCents: null } ), listing( 3, { image: null } ), listing( 4 ), listing( 5 ), listing( 6 )] } );
    expect( el.textContent ).toContain( 'From independent shops' );
    expect( el.textContent ).toContain( 'Not on 16Ahead Store yet' );
    expect( el.textContent ).not.toContain( 'From local stores on 16Ahead Store' );
    const cards = el.querySelectorAll( '.market-strip--listed article' );
    // No photo, no card; at most four.
    expect( cards.length ).toBe( 4 );
    expect( el.textContent ).not.toContain( 'Ribbon Heel 3' );
    const first = cards[0];
    // The photo opens the shop's own product page.
    expect( first.querySelector( 'a.market-strip__img' )?.getAttribute( 'href' ) ).toBe( 'https://shop.test/products/heel-1' );
    const links = [...first.querySelectorAll( '.market-strip__actions a' )].map( ( a ) => [a.textContent?.trim(), a.getAttribute( 'href' )] );
    expect( links ).toEqual( [['Shop on their site ↗', 'https://shop.test/products/heel-1'], ['Buy it here', 'https://16ahead.store/?q=heels']] );
    // http photos are asked for over https; no price, no price line.
    expect( cards[1].querySelector( 'img' )?.getAttribute( 'src' ) ).toBe( 'https://shop.test/heel-2.jpg' );
    expect( cards[1].querySelector( '.market-strip__price' ) ).toBeNull();
  } ) );

  it( 'shows nothing when neither has it', fakeAsync( () => {
    const el = search( 'tractor tires', { items: [], listingItems: [] } );
    expect( el.querySelector( '.market-strip' ) ).toBeNull();
  } ) );
} );
