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

function makeHeadlineResponse(query: string, results: FindRankedResult[]): FindSearchResponse {
  return {
    success: true,
    query,
    normalizedQuery: query,
    queryType: 'sports',
    rssBacked: true,
    results,
    selectedIndex: 0,
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

  it('links the main result title and source to the result url', fakeAsync(() => {
    runSearch('new era detroit', makeEntityResponse('new era detroit'));

    const title = root().querySelector<HTMLAnchorElement>('.find-card-title a');
    const source = root().querySelector<HTMLAnchorElement>('a.find-card-source');
    expect(title?.getAttribute('href')).toBe('https://example.com/result');
    expect(title?.textContent?.trim()).toBe('Example Result');
    expect(source?.getAttribute('href')).toBe('https://example.com/result');
  }));

  it('opens a forwarded q query directly in the result view', fakeAsync(async () => {
    await harness.navigateByUrl('/?q=weather', FindHomeComponent);
    harness.detectChanges();

    expect(component.isForwardedQuery).toBeTrue();
    expect(component.activeView).toBe('result');
    expect(root().querySelector('[data-cy="find-search-shell"]')).toBeNull();
    expect(root().querySelector('[data-cy="find-result-shell"]')).toBeTruthy();

    const req = http.expectOne(r => r.url.endsWith('/find/search'));
    req.flush(makeWeatherResponse('weather'));
    tick();
    harness.detectChanges();

    expect(root().querySelector('[data-cy="find-search-shell"]')).toBeNull();
    expect(root().querySelector('.find-weather-card')).toBeTruthy();
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

  it('opens all results from the All tab', fakeAsync(() => {
    runSearch('coffee', makeEntityResponse('coffee', {
      results: [makeResult({ title: 'Result A' }), makeResult({ title: 'Result B', rank: 2 })],
    }));

    byLabel('All results').click();
    harness.detectChanges();

    expect(component.activeView).toBe('booklet');
    expect(root().querySelectorAll('.find-grid-card').length).toBe(2);
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

  // --- Redesign: image rule, headlines, pager, feedback row ---

  it('puts a result\'s own image in the hero spot', fakeAsync(() => {
    runSearch('coffee', makeEntityResponse('coffee', {
      results: [makeResult({ imageUrl: 'https://example.com/photo.jpg' })],
    }));

    expect(component.imageState).toBe('own');
    expect(root().querySelector('.find-media__hero img')?.getAttribute('src')).toBe('https://example.com/photo.jpg');
    expect(root().querySelector('.find-media__thumb')).toBeNull();
  }));

  it('shows Find\'s default artwork only as a thumbnail, never the hero', fakeAsync(() => {
    runSearch('nba scores', makeEntityResponse('nba scores'));

    expect(component.imageState).toBe('fallback');
    expect(root().querySelector('.find-media__hero')).toBeNull();
    expect(root().querySelector('.find-media__thumb')?.getAttribute('src')).toBe('/fallback/find-sports.png');
  }));

  it('lets the text take the width when there is no image', fakeAsync(() => {
    runSearch('coffee', makeEntityResponse('coffee'));

    expect(component.imageState).toBe('none');
    expect(root().querySelector('.find-media--none')).toBeTruthy();
  }));

  it('renders an RSS sports headline with source, time, actions and attribution, without summarizing it', fakeAsync(() => {
    const now = Date.now();
    component.query = 'sports news';
    harness.detectChanges();
    submitButton().click();
    tick();
    http.expectOne(r => r.url.endsWith('/find/search')).flush(makeHeadlineResponse('sports news', [
      makeResult({ title: 'Chiefs rally late', url: 'https://www.cbssports.com/a', rssSource: 'CBS Sports', publishedAt: new Date(now - 4 * 3600000).toISOString() }),
      makeResult({ title: 'Arsenal go top', url: 'https://www.bbc.co.uk/sport/b', rssSource: 'BBC Sport', publishedAt: new Date(now - 2 * 3600000).toISOString(), rank: 2 }),
    ]));
    tick();
    harness.detectChanges();
    http.expectNone(r => r.url.endsWith('/find/summarize'));

    expect(component.isHeadlineMode).toBeTrue();
    expect(root().querySelector('.find-source-row')?.textContent).toContain('CBS Sports');
    expect(root().querySelector('.find-source-row')?.textContent).toContain('4h ago');
    expect(root().querySelector('.find-media__thumb')?.getAttribute('src')).toBe('/fallback/find-sports.png');
    expect(root().querySelector('.find-action--primary')?.getAttribute('href')).toBe('https://www.cbssports.com/a');
    expect(root().querySelector('.find-action--primary')?.textContent).toContain('Read on CBS Sports');
    expect(component.pagerNext?.label).toBe('Next · BBC Sport · 2h ago');
    expect(root().querySelector('.find-footer__meta')?.textContent).toContain('From CBS Sports and BBC Sport · updated hourly');
  }));

  it('adds the TODD summary under a place without replacing its hours or text', fakeAsync(() => {
    const week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      .map(day => ({ day, periods: [{ open: '8am', close: '3pm' }] }));
    component.query = 'restaurants near me';
    harness.detectChanges();
    submitButton().click();
    tick();
    http.expectOne(r => r.url.endsWith('/find/search')).flush({
      ...makeLocalResponse('restaurants near me'),
      results: [makeResult({ title: "Young's Restaurant", summary: 'Chinese and American breakfast and brunch.', address: '9413 16th Ave SW, Seattle, WA', hours: { days: week } })],
    });
    tick();
    http.expectOne(r => r.url.endsWith('/find/summarize')).flush({
      answer: "Young's Restaurant closes at 3:00 pm.",
      hours: { days: [{ day: 'Tuesday', periods: [{ open: '8am', close: '8pm' }] }] },
    });
    tick();
    harness.detectChanges();

    expect(component.currentBusinessHours?.days.length).toBe(7);
    expect(root().querySelector('.find-card-summary')?.textContent).toContain('Chinese and American breakfast and brunch.');
    expect(root().querySelector('.find-ai-summary')?.textContent).toContain("Young's Restaurant closes at 3:00 pm.");
  }));

  it('formats relative publish times', () => {
    const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
    expect(component.relativeTime(ago(10 * 1000))).toBe('just now');
    expect(component.relativeTime(ago(12 * 60000))).toBe('12m ago');
    expect(component.relativeTime(ago(5 * 3600000))).toBe('5h ago');
    expect(component.relativeTime('')).toBe('');
  });

  it('steps through results with the arrow keys and the pager', fakeAsync(() => {
    runSearch('coffee', makeEntityResponse('coffee', {
      results: [makeResult({ title: 'Result A' }), makeResult({ title: 'Result B', rank: 2 })],
    }));

    expect(component.pagerPrevious).toEqual({ label: 'Back', title: 'New search' });
    // Arrow keys are ignored while an award overlay is up; the first search unlocks one.
    component.dismissAwardUnlock();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    harness.detectChanges();
    expect(component.resultIndex).toBe(1);
    expect(component.pagerPrevious).toEqual({ label: 'Previous', title: 'Result A' });
    expect(component.pagerNext).toBeNull();

    root().querySelector<HTMLButtonElement>('.find-pager__link--prev')!.click();
    harness.detectChanges();
    expect(component.resultIndex).toBe(0);
  }));

  it('shows a single Back pager with a label for weather', fakeAsync(() => {
    runSearch('weather', makeWeatherResponse('weather'));

    expect(root().querySelector('.find-pager__label')?.textContent).toContain('Weather');
    expect(root().querySelector('.find-pager__link--next')).toBeNull();
  }));

  it('posts a rating from the one-row feedback footer', fakeAsync(() => {
    runSearch('coffee', makeEntityResponse('coffee'));

    root().querySelector<HTMLButtonElement>('.find-footer__pill')!.click();
    const req = http.expectOne(r => r.url.endsWith('/find/feedback'));
    expect(req.request.body.rating).toBe('excellent');
    req.flush({});
    harness.detectChanges();
    expect(root().querySelector('.find-footer')?.textContent).toContain('Thanks for the feedback.');
  }));

  it('offers Visit site and Copy link on an ordinary web result', fakeAsync(() => {
    runSearch('eiffel tower history', makeEntityResponse('eiffel tower history'));

    expect(component.currentActions.map(a => a.shortLabel)).toEqual(['Site', 'Copy']);
    expect(root().querySelector('.find-action--primary')?.getAttribute('href')).toBe('https://example.com/result');
  }));

  it('leads a place with Maps, then Call, Site and Copy', fakeAsync(() => {
    runSearch('youngs restaurant', makeEntityResponse('youngs restaurant', {
      queryType: 'local',
      results: [makeResult({ title: "Young's Restaurant", phone: '(206) 555-0142', address: '9828 16th Ave SW, Seattle, WA 98106' })],
    }));

    const actions = component.currentActions;
    expect(actions.map(a => a.shortLabel)).toEqual(['Go', 'Call', 'Site', 'Copy']);
    expect(actions[0].href).toContain(encodeURIComponent('9828 16th Ave SW, Seattle, WA 98106'));
    expect(actions[1].href).toBe('tel:2065550142');
  }));

  it('searches Maps by name and city when a place has hours but no address', fakeAsync(() => {
    runSearch('youngs restaurant hours', makeEntityResponse('youngs restaurant hours', {
      results: [makeResult({
        title: "Young's Restaurant | Seattle, WA | View and Order Online",
        summary: 'Hours: Tuesday: 8am - 8pm',
        hours: { days: [{ day: 'Tuesday', periods: [{ open: '8am', close: '8pm' }] }] },
      })],
    }));

    const maps = component.currentActions[0];
    expect(maps.shortLabel).toBe('Go');
    expect(maps.href).toContain(encodeURIComponent("Young's Restaurant Seattle, WA"));
  }));

  it('reads a street address and city from separate title segments', fakeAsync(() => {
    runSearch('youngs restaurant', makeEntityResponse('youngs restaurant', {
      results: [makeResult({ title: "Young's Restaurant - 9413 16th Ave SW - Restaurants - Seattle, WA - EverOut Seattle" })],
    }));

    expect(component.currentBusinessName).toBe("Young's Restaurant");
    expect(component.currentBusinessAddress).toBe('9413 16th Ave SW, Seattle, WA');
    expect(component.currentActions.map(a => a.shortLabel)).toEqual(['Go', 'Site', 'Copy']);
  }));

  it('does not mistake a numbered list title for an address', fakeAsync(() => {
    runSearch('best pho', makeEntityResponse('best pho', {
      results: [makeResult({ title: '10 Best Pho Spots - Seattle, WA - The Infatuation' })],
    }));

    expect(component.currentBusinessAddress).toBe('');
    expect(component.currentActions.map(a => a.shortLabel)).toEqual(['Site', 'Copy']);
  }));
});
