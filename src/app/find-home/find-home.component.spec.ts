import { fakeAsync, tick, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { FindHomeComponent } from './find-home.component';
import { routes } from '../app.routes';
import { FindRankedResult, FindSearchResponse } from '../services/find-experience.service';

function makeResult(overrides: Partial<FindRankedResult> = {}): FindRankedResult {
  return {
    rank: 1,
    title: 'Example Result',
    summary: 'An example summary.',
    url: 'https://example.com/result',
    displayUrl: 'example.com',
    imageUrl: '',
    sourceType: 'publisher',
    confidence: 0.92,
    pills: ['Alpha', 'Beta'],
    ...overrides,
  };
}

function makeEntityResponse(query: string, overrides: Partial<FindSearchResponse> = {}): FindSearchResponse {
  return {
    success: true,
    query,
    normalizedQuery: query,
    queryType: 'entity',
    results: [makeResult()],
    selectedIndex: 0,
    ...overrides,
  };
}

function makeWeatherResponse(query: string): FindSearchResponse {
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

function makeLocalResponse(query: string): FindSearchResponse {
  return {
    success: true,
    query,
    normalizedQuery: query,
    queryType: 'local',
    results: [makeResult({ title: 'Corner Cafe', summary: 'Cafe · 123 Main St' })],
    selectedIndex: 0,
  };
}

function makeConversionResponse(query: string): FindSearchResponse {
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

describe('FindHomeComponent', () => {
  let harness: RouterTestingHarness;
  let component: FindHomeComponent;
  let http: HttpTestingController;

  function root(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  function byLabel(label: string): HTMLButtonElement {
    const el = root().querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
    if (!el) throw new Error(`No element with aria-label "${label}"`);
    return el;
  }

  function submitButton(): HTMLButtonElement {
    return root().querySelector<HTMLButtonElement>('.find-search-screen .find-submit')!;
  }

  // Non-question/weather/conversion results trigger a follow-up
  // /find/summarize call for the top card; drain it if one was made.
  function drainSummarize(): void {
    for (const pending of http.match(r => r.url.endsWith('/find/summarize'))) {
      pending.flush({ answer: '' });
    }
    tick();
  }

  /** Types a query into the home search box and submits it, flushing the resulting HTTP call(s). */
  function runSearch(query: string, response: FindSearchResponse): void {
    component.query = query;
    harness.detectChanges();
    submitButton().click();
    tick();
    const req = http.expectOne(r => r.url.endsWith('/find/search'));
    req.flush(response);
    tick();
    harness.detectChanges();
    drainSummarize();
  }

  beforeEach(async () => {
    localStorage.removeItem('find-history');
    localStorage.removeItem('find-awards-count');
    localStorage.removeItem('find-awards-unlocked');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
      ],
    });

    http = TestBed.inject(HttpTestingController);

    spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake((success: PositionCallback) => {
      success({ coords: { latitude: 47.6, longitude: -122.3 } } as GeolocationPosition);
    });

    harness = await RouterTestingHarness.create();
    component = (await harness.navigateByUrl('/', FindHomeComponent))!;
    harness.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  // --- 1. The "Find" search button ---

  it('submits the typed query, runs a search, and saves it to history', fakeAsync(() => {
    runSearch('sushi in seattle', makeEntityResponse('sushi in seattle'));

    expect(component.activeView).toBe('result');
    expect(component.currentCard?.title).toBe('Example Result');
    expect(JSON.parse(localStorage.getItem('find-history') || '[]')).toContain('sushi in seattle');
  }));

  // --- 2-6. The five quick-action chips ---

  it('runs a News search from the News quick action', fakeAsync(() => {
    byLabel('Search News').click();
    tick();
    const req = http.expectOne(r => r.url.endsWith('/find/search'));
    expect(req.request.body.query).toBe("Today's News");
    req.flush(makeEntityResponse("Today's News"));
    tick();
    drainSummarize();
  }));

  it('requests geolocation and forwards coordinates for the Weather quick action', fakeAsync(() => {
    byLabel('Search Weather').click();
    tick();
    const req = http.expectOne(r => r.url.endsWith('/find/search'));
    expect(req.request.body.query).toBe('weather');
    expect(req.request.body.latitude).toBe(47.6);
    expect(req.request.body.longitude).toBe(-122.3);
    req.flush(makeWeatherResponse('weather'));
    tick();
    harness.detectChanges();

    expect(component.isWeatherMode).toBeTrue();
  }));

  it('runs a sports search from the Sports quick action', fakeAsync(() => {
    byLabel('Search Sports').click();
    tick();
    const req = http.expectOne(r => r.url.endsWith('/find/search'));
    expect(req.request.body.query).toBe('sports news');
    req.flush(makeEntityResponse('sports news'));
    tick();
    drainSummarize();
  }));

  it('runs a currency search and renders the conversion card from the Conversion quick action', fakeAsync(() => {
    byLabel('Search Conversion').click();
    tick();
    const req = http.expectOne(r => r.url.endsWith('/find/search'));
    expect(req.request.body.query).toBe('100 USD to EUR');
    req.flush(makeConversionResponse('100 USD to EUR'));
    tick();
    harness.detectChanges();

    expect(component.isConversionMode).toBeTrue();
    expect(component.conversionOutputAmount).toBe(92);
  }));

  it('requests geolocation and returns local results from the Restaurants quick action', fakeAsync(() => {
    byLabel('Search Restaurants').click();
    tick();
    const req = http.expectOne(r => r.url.endsWith('/find/search'));
    expect(req.request.body.query).toBe('restaurants near me');
    expect(req.request.body.latitude).toBe(47.6);
    expect(req.request.body.longitude).toBe(-122.3);
    req.flush(makeLocalResponse('restaurants near me'));
    tick();
    harness.detectChanges();
    drainSummarize();

    expect(component.isLocalMode).toBeTrue();
  }));

  it('does nothing when the disabled Events quick action is activated', fakeAsync(() => {
    // A native <button disabled> never dispatches a click event even via
    // .click(), so the guard clause is exercised directly instead.
    component.onQuickActionClick(component.quickActions.find(a => a.label === 'Events')!);
    tick();
    http.expectNone(r => r.url.endsWith('/find/search'));
    expect(component.query).toBe('');
  }));

  // --- 7-11. The five bottom tab-bar buttons ---

  it('opens the results grid from the Grid tab', fakeAsync(() => {
    runSearch('coffee', makeEntityResponse('coffee', {
      results: [makeResult({ title: 'Result A' }), makeResult({ title: 'Result B', rank: 2 })],
    }));

    byLabel('All results grid').click();
    harness.detectChanges();

    expect(component.activeView).toBe('booklet');
    expect(root().querySelectorAll('.find-grid-tile').length).toBe(2);
  }));

  it('shows a past search in the History tab', fakeAsync(() => {
    runSearch('injera near me', makeLocalResponse('injera near me'));

    byLabel('Search history').click();
    harness.detectChanges();

    expect(component.activeView).toBe('history');
    const entries = Array.from(root().querySelectorAll('.find-history-list li')).map(li => li.textContent?.trim());
    expect(entries.some(text => text?.includes('injera near me'))).toBeTrue();
  }));

  it('shows the About panel from the Info tab', fakeAsync(() => {
    byLabel('About Find').click();
    harness.detectChanges();

    expect(component.activeView).toBe('info');
    expect(root().querySelector('.find-info-screen h2')?.textContent).toContain('About Find');
  }));

  it('shows the awards progress from the Awards tab', fakeAsync(() => {
    byLabel('Awards').click();
    harness.detectChanges();

    expect(component.activeView).toBe('awards');
    expect(root().querySelector('.find-awards-screen')).toBeTruthy();
  }));

  it('shares the current result from the Share tab', fakeAsync(() => {
    runSearch('sushi in seattle', makeEntityResponse('sushi in seattle'));

    const shareSpy = jasmine.createSpy('share').and.returnValue(Promise.resolve());
    (navigator as unknown as { share: unknown }).share = shareSpy;

    byLabel('Share result').click();
    tick();

    expect(shareSpy).toHaveBeenCalledWith({ title: 'Example Result', url: 'https://example.com/result' });
  }));
});
