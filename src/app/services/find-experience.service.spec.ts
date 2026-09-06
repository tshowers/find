import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FindExperienceService } from './find-experience.service';

describe('FindExperienceService', () => {
  let service: FindExperienceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FindExperienceService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(FindExperienceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('forwards a five-digit ZIP code separately for weather searches', () => {
    service.search({ query: 'weather 98106', maxResults: 1 }).subscribe();

    const request = http.expectOne( item => item.url.endsWith('/find/search') );
    expect(request.request.body).toEqual({
      query: 'weather 98106',
      context: null,
      postalCode: '98106',
      maxResults: 1,
    });
    request.flush({ success: true, query: 'weather 98106', normalizedQuery: 'weather 98106', queryType: 'weather', results: [], selectedIndex: 0 });
  });

  it('does not add a ZIP field to ordinary searches', () => {
    service.search({ query: 'weather tomorrow' }).subscribe();

    const request = http.expectOne( item => item.url.endsWith('/find/search') );
    expect(request.request.body).toEqual({
      query: 'weather tomorrow',
      context: null,
      maxResults: 10,
    });
    request.flush({ success: true, query: 'weather tomorrow', normalizedQuery: 'weather tomorrow', queryType: 'weather', results: [], selectedIndex: 0 });
  });

  it('forwards coordinates for a "near me" search when a position is available', () => {
    service.search({ query: 'places to eat near me', latitude: 47.5218, longitude: -122.3466 }).subscribe();

    const request = http.expectOne( item => item.url.endsWith('/find/search') );
    expect(request.request.body).toEqual({
      query: 'places to eat near me',
      context: null,
      latitude: 47.5218,
      longitude: -122.3466,
      maxResults: 10,
    });
    request.flush({ success: true, query: 'places to eat near me', normalizedQuery: 'places to eat near me', queryType: 'local', results: [], selectedIndex: 0 });
  });

  it('omits coordinates when geolocation was denied or unavailable', () => {
    service.search({ query: 'places to eat near me', latitude: null, longitude: null }).subscribe();

    const request = http.expectOne( item => item.url.endsWith('/find/search') );
    expect(request.request.body).toEqual({
      query: 'places to eat near me',
      context: null,
      maxResults: 10,
    });
    request.flush({ success: true, query: 'places to eat near me', normalizedQuery: 'places to eat near me', queryType: 'entity', results: [], selectedIndex: 0 });
  });
});
