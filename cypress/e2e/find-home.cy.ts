/**
 * End-to-end coverage of every clickable element on the Find home screen:
 * the search submit button, all five quick-action chips, and all five
 * bottom tabs. The backend (/find/search, /find/summarize) is a shared
 * service outside this repo, so every test stubs it with cy.intercept
 * rather than hitting the real API or a local emulator.
 */

function stubSummarize (): void {
  cy.intercept( 'POST', '**/find/summarize', { answer: '' } ).as( 'summarize' );
}

function stubSearch ( response: Record<string, unknown> ): void {
  cy.intercept( 'POST', '**/find/search', response ).as( 'search' );
}

function stubGeolocation ( win: Cypress.AUTWindow ): void {
  cy.stub( win.navigator.geolocation, 'getCurrentPosition' ).callsFake( ( success: PositionCallback ) => {
    success( { coords: { latitude: 47.6, longitude: -122.3 } } as GeolocationPosition );
  } );
}

function entityResponse ( query: string, results?: Record<string, unknown>[] ) {
  return {
    success: true,
    query,
    normalizedQuery: query,
    queryType: 'entity',
    selectedIndex: 0,
    results: results ?? [ {
      rank: 1,
      title: 'Example Result',
      summary: 'An example summary.',
      url: 'https://example.com/result',
      displayUrl: 'example.com',
      imageUrl: '',
      sourceType: 'publisher',
      confidence: 0.92,
      pills: [ 'Alpha', 'Beta' ],
    } ],
  };
}

function weatherResponse ( query: string ) {
  return {
    success: true,
    query,
    normalizedQuery: query,
    queryType: 'weather',
    results: [],
    selectedIndex: 0,
    weather: {
      location: 'Seattle, WA',
      tempF: 62,
      feelsLikeF: 60,
      condition: 'cloudy',
      description: 'Mostly cloudy',
      iconUrl: '',
      humidity: 70,
      windMph: 5,
    },
  };
}

function localResponse ( query: string ) {
  return {
    success: true,
    query,
    normalizedQuery: query,
    queryType: 'local',
    selectedIndex: 0,
    results: [ {
      rank: 1,
      title: 'Corner Cafe',
      summary: 'Cafe · 123 Main St',
      url: 'https://example.com/cafe',
      displayUrl: 'example.com',
      imageUrl: '',
      sourceType: 'publisher',
      confidence: 0.9,
      pills: [ 'Cafe' ],
    } ],
  };
}

function conversionResponse ( query: string ) {
  return {
    success: true,
    query,
    normalizedQuery: query,
    queryType: 'conversion',
    results: [],
    selectedIndex: 0,
    conversion: {
      category: 'currency',
      inputAmount: 100,
      inputUnit: 'USD',
      outputAmount: 92,
      outputUnit: 'EUR',
      rate: 0.92,
      source: 'test-provider',
    },
  };
}

/** Types a query into the home search box, submits it, and waits for the stubbed response. */
function runSearch ( query: string, response: Record<string, unknown> ): void {
  stubSearch( response );
  cy.visit( '/' );
  cy.get( '#findQuery' ).type( query );
  cy.get( '.find-search-screen .find-submit' ).click();
  cy.wait( '@search' );
}

describe( 'Find home - buttons and navigation', () => {
  beforeEach( () => {
    stubSummarize();
  } );

  it( 'loads the search screen', () => {
    cy.visit( '/' );
    cy.get( '[data-cy="find-search-shell"]' ).should( 'be.visible' );
  } );

  // --- 1. The "Find" search button ---

  it( 'submits the typed query and shows the result', () => {
    runSearch( 'sushi in seattle', entityResponse( 'sushi in seattle' ) );

    cy.get( '[data-cy="find-result-shell"]' ).should( 'be.visible' );
    cy.contains( '.find-card-title', 'Example Result' ).should( 'be.visible' );
  } );

  // --- 12. The platform menu ---

  it( 'opens the platform menu from the search screen', () => {
    cy.visit( '/' );
    cy.get( '.platform-menu-trigger' ).click();
    cy.get( '.platform-menu-panel' ).should( 'have.class', 'platform-menu-panel--open' );
  } );

  // --- 2-6. The five quick-action chips ---

  it( 'runs a News search from the News quick action', () => {
    stubSearch( entityResponse( "Today's News" ) );
    cy.visit( '/' );
    cy.get( '[aria-label="Search News"]' ).click();
    cy.wait( '@search' ).its( 'request.body.query' ).should( 'eq', "Today's News" );
  } );

  it( 'requests geolocation and forwards coordinates for the Weather quick action', () => {
    stubSearch( weatherResponse( 'weather' ) );
    cy.visit( '/', { onBeforeLoad: stubGeolocation } );
    cy.get( '[aria-label="Search Weather"]' ).click();
    cy.wait( '@search' ).its( 'request.body' ).should( 'deep.include', { latitude: 47.6, longitude: -122.3 } );
    cy.get( '.find-weather-card__location' ).should( 'contain.text', 'Seattle' );
  } );

  it( 'runs a sports search from the Sports quick action', () => {
    stubSearch( entityResponse( 'sports news' ) );
    cy.visit( '/' );
    cy.get( '[aria-label="Search Sports"]' ).click();
    cy.wait( '@search' ).its( 'request.body.query' ).should( 'eq', 'sports news' );
  } );

  it( 'runs a currency search and renders the conversion card from the Conversion quick action', () => {
    stubSearch( conversionResponse( '100 USD to EUR' ) );
    cy.visit( '/' );
    cy.get( '[aria-label="Search Conversion"]' ).click();
    cy.wait( '@search' );
    cy.get( '.find-conversion-card' ).should( 'be.visible' );
    cy.get( '.find-conversion-output' ).should( 'contain.text', '92' );
  } );

  it( 'requests geolocation and returns local results from the Restaurants quick action', () => {
    stubSearch( localResponse( 'restaurants near me' ) );
    cy.visit( '/', { onBeforeLoad: stubGeolocation } );
    cy.get( '[aria-label="Search Restaurants"]' ).click();
    cy.wait( '@search' ).its( 'request.body' ).should( 'deep.include', {
      query: 'restaurants near me', latitude: 47.6, longitude: -122.3,
    } );
    cy.contains( '.find-card-title', 'Corner Cafe' ).should( 'be.visible' );
  } );

  it( 'shows the Events quick action as disabled rather than searchable', () => {
    cy.visit( '/' );
    cy.get( '[aria-label="Events coming soon"]' ).should( 'be.disabled' );
  } );

  // --- 7-11. The five bottom tab-bar buttons ---

  it( 'opens the results grid from the Grid tab', () => {
    runSearch( 'coffee', entityResponse( 'coffee', [
      { rank: 1, title: 'Result A', summary: 'First result.', url: 'https://example.com/a', displayUrl: 'example.com', imageUrl: '', sourceType: 'publisher', confidence: 0.9, pills: [] },
      { rank: 2, title: 'Result B', summary: 'Second result.', url: 'https://example.com/b', displayUrl: 'example.com', imageUrl: '', sourceType: 'publisher', confidence: 0.8, pills: [] },
    ] ) );

    cy.get( '[aria-label="All results grid"]' ).click();
    cy.get( '[data-cy="find-grid-shell"]' ).should( 'be.visible' );
    cy.get( '.find-grid-tile' ).should( 'have.length', 2 );
  } );

  it( 'shows a past search in the History tab', () => {
    runSearch( 'injera near me', localResponse( 'injera near me' ) );

    cy.get( '[aria-label="Search history"]' ).click();
    cy.get( '[data-cy="find-history-shell"]' ).should( 'be.visible' );
    cy.contains( '.find-history-list li', 'injera near me' ).should( 'be.visible' );
  } );

  it( 'shows the About panel from the Info tab', () => {
    cy.visit( '/' );
    cy.get( '[aria-label="About Find"]' ).click();
    cy.get( '[data-cy="find-info-shell"]' ).should( 'be.visible' );
    cy.contains( 'h2', 'About Find' ).should( 'be.visible' );
  } );

  it( 'shows the awards progress from the Awards tab', () => {
    cy.visit( '/' );
    cy.get( '[aria-label="Awards"]' ).click();
    cy.get( '[data-cy="find-awards-shell"]' ).should( 'be.visible' );
  } );

  it( 'shares the current result from the Share tab', () => {
    runSearch( 'sushi in seattle', entityResponse( 'sushi in seattle' ) );

    cy.window().then( ( win ) => {
      const shareStub = cy.stub().resolves();
      // navigator.share may not exist in the test browser at all - assign
      // it directly rather than cy.stub(obj, 'method'), which requires the
      // method to already be present.
      ( win.navigator as unknown as { share: unknown } ).share = shareStub;
      cy.wrap( shareStub ).as( 'share' );
    } );

    cy.get( '[aria-label="Share result"]' ).click();
    cy.get( '@share' ).should( 'have.been.calledWith', { title: 'Example Result', url: 'https://example.com/result' } );
  } );
} );
