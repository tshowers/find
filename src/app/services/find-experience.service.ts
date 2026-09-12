import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type FindQueryType = 'entity' | 'question' | 'person' | 'weather' | 'conversion' | 'local';
export type FindSourceType = 'official' | 'publisher' | 'government' | 'academic' | 'medical' | 'encyclopedia';

export interface FindBusinessHoursPeriod {
  open: string;
  close: string;
}

export interface FindBusinessHoursDay {
  day: string;
  periods: FindBusinessHoursPeriod[];
  isClosed?: boolean;
  isTwentyFourHours?: boolean;
}

export interface FindBusinessHours {
  timezone?: string;
  isOpenNow?: boolean;
  statusText?: string;
  days: FindBusinessHoursDay[];
  holidayNotes?: string[];
  sourceUrl?: string;
}

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
  hours?: FindBusinessHours;
  address?: string;
  phone?: string;
}

export interface FindWeatherResult {
  location: string;
  postalCode?: string;
  timezone?: string;
  tempF: number;
  feelsLikeF: number;
  condition: string;
  description: string;
  iconUrl: string;
  humidity: number;
  windMph: number;
  highF?: number;
  lowF?: number;
  updatedAt?: string;
  forecast?: FindWeatherForecastDay[];
}

export interface FindWeatherForecastDay {
  date: string;
  label: string;
  condition: string;
  description?: string;
  iconUrl?: string;
  highF?: number;
  lowF?: number;
}

export type FindConversionCategory = 'currency' | 'temperature' | 'distance' | 'weight' | 'length' | 'volume';

export interface FindConversionResult {
  category: FindConversionCategory;
  inputAmount: number;
  inputUnit: string;
  inputUnitLabel?: string;
  outputAmount: number;
  outputUnit: string;
  outputUnitLabel?: string;
  rate?: number;
  rateUpdatedAt?: string;
  source?: string;
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
  conversion?: FindConversionResult | null;
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
    latitude?: number | null;
    longitude?: number | null;
  } ): Observable<FindSearchResponse> {
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${environment.apiKey}` );
    const postalCode = this.extractPostalCode( payload?.query );
    const hasCoordinates = Number.isFinite( payload?.latitude ) && Number.isFinite( payload?.longitude );
    const body = {
      query: String( payload?.query || '' ).trim(),
      context: String( payload?.context || '' ).trim() || null,
      ...( postalCode ? { postalCode } : {} ),
      ...( hasCoordinates ? { latitude: payload!.latitude, longitude: payload!.longitude } : {} ),
      maxResults: Math.max( 1, Math.min( 20, Number( payload?.maxResults ) || 20 ) )
    };

    return this.postWithLocalFallback<FindSearchResponse>( '/find/search', body, { headers } )
      .pipe( map( response => this.applyLocalConversionFallback( response, body.query ) ) );
  }

  summarize ( payload: { query: string; url: string; title: string } ): Observable<{ answer: string; hours?: FindBusinessHours | null }> {
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${environment.apiKey}` );
    return this.postWithLocalFallback<{ answer: string; hours?: FindBusinessHours | null }>( '/find/summarize', payload, { headers } );
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

  private extractPostalCode ( value: string | null | undefined ): string | null {
    const match = String( value || '' ).match( /(?:^|\s)(\d{5})(?:-\d{4})?(?=\s|$)/ );
    return match?.[1] || null;
  }

  private applyLocalConversionFallback ( response: FindSearchResponse, query: string ): FindSearchResponse {
    if ( response?.queryType === 'conversion' || response?.conversion ) return response;

    const conversion = this.parseLocalConversion( query, response?.answer?.text || '' );
    if ( !conversion ) return response;

    return {
      ...response,
      query,
      normalizedQuery: query,
      queryType: 'conversion',
      conversion,
      results: [],
      selectedIndex: 0
    };
  }

  private parseLocalConversion ( query: string, answerText = '' ): FindConversionResult | null {
    const tokens = String( query || '' ).trim().toLowerCase().split( /\s+(?:to|in|into)\s+/ );
    if ( tokens.length !== 2 ) return null;

    const left = tokens[0].trim().match( /^(-?\d+(?:\.\d+)?)?\s*([a-z]+)$/i );
    const right = tokens[1].trim().match( /^([a-z]+)$/i );
    if ( !left || !right ) return null;

    const input = this.localConversionUnit( left[2] );
    const output = this.localConversionUnit( right[1] );
    if ( !input || !output || input.category !== output.category ) return null;

    const inputAmount = left[1] === undefined ? 1 : Number( left[1] );
    if ( !Number.isFinite( inputAmount ) ) return null;

    let outputAmount: number;
    let rate: number | undefined;
    if ( input.category === 'temperature' ) {
      outputAmount = input.unit === output.unit
        ? inputAmount
        : input.unit === 'fahrenheit'
          ? ( inputAmount - 32 ) * 5 / 9
          : inputAmount * 9 / 5 + 32;
    } else if ( input.category === 'currency' ) {
      const answerAmount = this.extractCurrencyAnswerAmount( answerText, inputAmount, output.unit );
      if ( answerAmount === null ) return null;
      outputAmount = answerAmount;
      rate = outputAmount / inputAmount;
    } else {
      outputAmount = inputAmount * ( input.factor || 1 ) / ( output.factor || 1 );
    }

    return {
      category: input.category,
      inputAmount,
      inputUnit: input.unit,
      inputUnitLabel: input.label,
      outputAmount,
      outputUnit: output.unit,
      outputUnitLabel: output.label,
      rate,
      source: input.category === 'currency' ? 'Find answer' : 'Find local conversion'
    };
  }

  private extractCurrencyAnswerAmount ( answerText: string, inputAmount: number, outputUnit: string ): number | null {
    const targetTerms: Record<string, string> = {
      USD: '(?:us\\s*)?dollars?|usd', CAD: 'canadian\\s*dollars?|cad',
      EUR: 'euros?|eur', GBP: 'pounds?|gbp', JPY: '(?:japanese\\s*)?yen|jpy',
      AUD: 'australian\\s*dollars?|aud', CNY: '(?:chinese\\s*)?(?:yuan|renminbi)|cny',
      CHF: 'swiss\\s*francs?|chf', MXN: 'mexican\\s*pesos?|mxn'
    };
    const target = targetTerms[outputUnit];
    if ( target ) {
      const match = String( answerText || '' ).match( new RegExp( `([-+]?\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:${target})`, 'i' ) );
      const targeted = match ? Number( match[1].replace( /,/g, '' ) ) : NaN;
      if ( Number.isFinite( targeted ) && Math.abs( targeted - inputAmount ) > Number.EPSILON ) return targeted;
    }

    const matches = String( answerText || '' ).match( /[-+]?\d[\d,]*(?:\.\d+)?/g ) || [];
    const values = matches
      .map( value => Number( value.replace( /,/g, '' ) ) )
      .filter( value => Number.isFinite( value ) );
    const output = values.reverse().find( value => Math.abs( value - inputAmount ) > Number.EPSILON );
    return output === undefined ? null : output;
  }

  private localConversionUnit ( value: string ): { category: FindConversionCategory; unit: string; label: string; factor?: number } | null {
    const units: Record<string, { category: FindConversionCategory; unit: string; label: string; factor?: number }> = {
      f: { category: 'temperature', unit: 'fahrenheit', label: 'Fahrenheit' },
      fahrenheit: { category: 'temperature', unit: 'fahrenheit', label: 'Fahrenheit' },
      c: { category: 'temperature', unit: 'celsius', label: 'Celsius' },
      celsius: { category: 'temperature', unit: 'celsius', label: 'Celsius' },
      usd: { category: 'currency', unit: 'USD', label: 'US Dollar (USD)' },
      dollar: { category: 'currency', unit: 'USD', label: 'US Dollar (USD)' },
      dollars: { category: 'currency', unit: 'USD', label: 'US Dollar (USD)' },
      cad: { category: 'currency', unit: 'CAD', label: 'Canadian Dollar (CAD)' },
      eur: { category: 'currency', unit: 'EUR', label: 'Euro (EUR)' },
      euro: { category: 'currency', unit: 'EUR', label: 'Euro (EUR)' },
      euros: { category: 'currency', unit: 'EUR', label: 'Euro (EUR)' },
      gbp: { category: 'currency', unit: 'GBP', label: 'British Pound (GBP)' },
      jpy: { category: 'currency', unit: 'JPY', label: 'Japanese Yen (JPY)' },
      yen: { category: 'currency', unit: 'JPY', label: 'Japanese Yen (JPY)' },
      aud: { category: 'currency', unit: 'AUD', label: 'Australian Dollar (AUD)' },
      cny: { category: 'currency', unit: 'CNY', label: 'Chinese Yuan (CNY)' },
      yuan: { category: 'currency', unit: 'CNY', label: 'Chinese Yuan (CNY)' },
      chf: { category: 'currency', unit: 'CHF', label: 'Swiss Franc (CHF)' },
      mxn: { category: 'currency', unit: 'MXN', label: 'Mexican Peso (MXN)' },
      mi: { category: 'distance', unit: 'miles', label: 'Miles', factor: 1.609344 },
      mile: { category: 'distance', unit: 'miles', label: 'Miles', factor: 1.609344 },
      miles: { category: 'distance', unit: 'miles', label: 'Miles', factor: 1.609344 },
      km: { category: 'distance', unit: 'kilometers', label: 'Kilometers', factor: 1 },
      kilometer: { category: 'distance', unit: 'kilometers', label: 'Kilometers', factor: 1 },
      kilometers: { category: 'distance', unit: 'kilometers', label: 'Kilometers', factor: 1 },
      lb: { category: 'weight', unit: 'pounds', label: 'Pounds', factor: 0.45359237 },
      lbs: { category: 'weight', unit: 'pounds', label: 'Pounds', factor: 0.45359237 },
      pound: { category: 'weight', unit: 'pounds', label: 'Pounds', factor: 0.45359237 },
      pounds: { category: 'weight', unit: 'pounds', label: 'Pounds', factor: 0.45359237 },
      kg: { category: 'weight', unit: 'kilograms', label: 'Kilograms', factor: 1 },
      kilogram: { category: 'weight', unit: 'kilograms', label: 'Kilograms', factor: 1 },
      kilograms: { category: 'weight', unit: 'kilograms', label: 'Kilograms', factor: 1 },
      in: { category: 'length', unit: 'inches', label: 'Inches', factor: 0.0254 },
      inch: { category: 'length', unit: 'inches', label: 'Inches', factor: 0.0254 },
      inches: { category: 'length', unit: 'inches', label: 'Inches', factor: 0.0254 },
      ft: { category: 'length', unit: 'feet', label: 'Feet', factor: 0.3048 },
      foot: { category: 'length', unit: 'feet', label: 'Feet', factor: 0.3048 },
      feet: { category: 'length', unit: 'feet', label: 'Feet', factor: 0.3048 },
      m: { category: 'length', unit: 'meters', label: 'Meters', factor: 1 },
      meter: { category: 'length', unit: 'meters', label: 'Meters', factor: 1 },
      meters: { category: 'length', unit: 'meters', label: 'Meters', factor: 1 },
      l: { category: 'volume', unit: 'liters', label: 'Liters', factor: 1 },
      liter: { category: 'volume', unit: 'liters', label: 'Liters', factor: 1 },
      liters: { category: 'volume', unit: 'liters', label: 'Liters', factor: 1 },
      gal: { category: 'volume', unit: 'gallons', label: 'Gallons', factor: 3.785411784 },
      gallon: { category: 'volume', unit: 'gallons', label: 'Gallons', factor: 3.785411784 },
      gallons: { category: 'volume', unit: 'gallons', label: 'Gallons', factor: 3.785411784 }
    };
    return units[value] || null;
  }
}
