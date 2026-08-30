import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type FindQueryType = 'entity' | 'question' | 'person' | 'weather';
export type FindSourceType = 'official' | 'publisher' | 'government' | 'academic' | 'medical' | 'encyclopedia';

export interface FindAnswerReference {
  title: string;
  url: string;
  displayUrl: string;
  sourceType: FindSourceType;
}

export interface FindAnswerBlock {
  text: string;
  imageUrl?: string;
  references: FindAnswerReference[];
}

export interface FindRankedResult {
  rank: number;
  title: string;
  summary: string;
  answer?: string;
  url: string;
  displayUrl: string;
  imageUrl: string;
  sourceType: FindSourceType;
  confidence: number;
  pills: string[];
  isFirstParty?: boolean;
  entityId?: string;
  entityName?: string;
  logoUrl?: string;
}

export interface FindWeatherResult {
  location: string;
  tempF: number;
  feelsLikeF: number;
  condition: string;
  description: string;
  iconUrl: string;
  humidity: number;
  windMph: number;
}

export interface FindSearchResponse {
  success: boolean;
  query: string;
  normalizedQuery: string;
  queryType: FindQueryType;
  handoff?: {
    route: string;
    query: string;
  } | null;
  answer?: FindAnswerBlock | null;
  weather?: FindWeatherResult | null;
  results: FindRankedResult[];
  selectedIndex: number;
  timings?: {
    totalMs: number;
    planMs: number;
    enrichMs: number;
    summarizeMs: number;
    candidateCount: number;
    enrichedCount: number;
  };
}

@Injectable( {
  providedIn: 'root'
} )
export class FindExperienceService {
  private readonly apiRoot = environment.backendURL;
  private readonly localApiRoot = this.buildLocalApiRoot();

  constructor ( private readonly http: HttpClient ) { }

  search ( payload: {
    query: string;
    context?: string | null;
    maxResults?: number;
  } ): Observable<FindSearchResponse> {
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${environment.apiKey}` );
    const body = {
      query: String( payload?.query || '' ).trim(),
      context: String( payload?.context || '' ).trim() || null,
      maxResults: Math.max( 1, Math.min( 10, Number( payload?.maxResults ) || 10 ) )
    };

    return this.postWithLocalFallback<FindSearchResponse>( '/find/search', body, { headers } );
  }

  summarize ( payload: { query: string; url: string; title: string } ): Observable<{ answer: string }> {
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${environment.apiKey}` );
    return this.postWithLocalFallback<{ answer: string }>( '/find/summarize', payload, { headers } );
  }

  private postWithLocalFallback<T> ( path: string, body: unknown, options: { headers: HttpHeaders; } ): Observable<T> {
    const hostedRequest = () => this.http.post<T>( `${this.apiRoot}${path}`, body, options );

    if ( !this.localApiRoot ) {
      return hostedRequest();
    }

    return this.http.post<T>( `${this.localApiRoot}${path}`, body, options )
      .pipe( catchError( () => hostedRequest() ) );
  }

  private buildLocalApiRoot (): string | null {
    if ( typeof window === 'undefined' ) return null;
    const host = String( window.location.hostname || '' ).toLowerCase();
    if ( host !== 'localhost' && host !== '127.0.0.1' ) return null;

    const projectId = String( environment.firebaseConfig?.projectId || 'taliferrotech' ).trim() || 'taliferrotech';
    return `http://127.0.0.1:5001/${projectId}/us-central1/api/api`;
  }
}
