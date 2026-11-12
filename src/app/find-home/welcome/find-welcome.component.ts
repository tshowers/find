import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { environment } from '../../../environments/environment';
import { FIND_WELCOME_CUES, FindWelcomeCue, fillCaptions, timeVars } from './find-welcome-captions';

const STORE_KEY = 'find.welcome';
/** Tracking params our email click tracker adds; removed from the address bar once read. */
const LINK_PARAMS = [ 'emailId', 'tenantId', 'u', 'campaignId' ];

/**
 * The personal welcome (Ty, 2026-11-11). Someone who clicks a Find link in
 * one of our emails lands with ?emailId=&tenantId=. After the page is up we
 * ask the backend who that was; if it knows (and they haven't had their two
 * days yet), a "A special message for Booker" button appears. It plays the
 * welcome video with captions filled with their name, time of day and
 * weekday. Anyone we don't know never sees anything.
 */
@Component( {
  selector: 'app-find-welcome',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if ( firstName() && !dismissed() ) {
      <div class="fw-pill">
        <button type="button" class="fw-pill__open" (click)="open()">
          <i class="fa-solid fa-play" aria-hidden="true"></i>
          <span>A special message for {{ firstName() }}</span>
        </button>
        <button type="button" class="fw-pill__close" aria-label="Hide the message" (click)="dismissed.set( true )">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
    }
    @if ( playing() ) {
      <div class="fw-backdrop" (click)="close()">
        <div class="fw-dialog" role="dialog" aria-modal="true" [attr.aria-label]="'A message for ' + firstName()" (click)="$event.stopPropagation()">
          <button type="button" class="fw-dialog__close" aria-label="Close" (click)="close()">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
          <div class="fw-frame">
            <video #video src="assets/video/find-welcome.mp4" autoplay playsinline controls preload="auto"
                   (loadedmetadata)="addTrack()" (timeupdate)="onTime()" (seeked)="onTime()" (ended)="caption.set( '' )"></video>
            @if ( caption() ) { <p class="fw-caption" aria-live="polite">{{ caption() }}</p> }
          </div>
        </div>
      </div>
    }
  `,
  styles: [ `
    .fw-pill {
      position: fixed; left: 50%; bottom: max(20px, env(safe-area-inset-bottom)); transform: translateX(-50%);
      z-index: 900; display: flex; align-items: center; gap: 4px; max-width: calc(100vw - 32px);
      padding: 4px; border-radius: 999px; background: var(--blue, #2f6bff); color: #fff;
      box-shadow: 0 10px 30px rgba(0, 0, 0, .25); animation: fw-rise .35s ease-out;
    }
    .fw-pill button { border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }
    .fw-pill__open {
      display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 14px 0 18px;
      font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .fw-pill__open span { overflow: hidden; text-overflow: ellipsis; }
    .fw-pill__close { width: 36px; height: 36px; border-radius: 50%; opacity: .8; }
    .fw-pill__close:hover, .fw-pill__close:focus-visible { opacity: 1; background: rgba(255, 255, 255, .15); }
    @keyframes fw-rise { from { opacity: 0; transform: translate(-50%, 12px); } }

    .fw-backdrop {
      position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center;
      padding: 16px; background: rgba(8, 10, 14, .82);
    }
    .fw-dialog { position: relative; width: min(100%, 1100px); }
    .fw-dialog__close {
      position: absolute; top: -48px; right: 0; width: 40px; height: 40px; border: 0; border-radius: 50%;
      background: rgba(255, 255, 255, .12); color: #fff; font-size: 18px; cursor: pointer;
    }
    .fw-frame { position: relative; border-radius: 16px; overflow: hidden; background: #000; container-type: inline-size; }
    .fw-frame video { display: block; width: 100%; aspect-ratio: 16 / 9; }
    /* The handoff keeps the bottom 22% of the frame clear for captions. */
    .fw-caption {
      position: absolute; left: 50%; bottom: 9%; transform: translateX(-50%); margin: 0;
      max-width: 86%; padding: .4em .8em; border-radius: 16px; background: rgba(15, 17, 21, .85);
      color: #fff; font: 600 clamp(14px, 2.6cqw, 30px)/1.3 'Helvetica Neue', Helvetica, Arial, sans-serif;
      text-align: center; pointer-events: none; animation: fw-fade .2s ease-out;
    }
    @keyframes fw-fade { from { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .fw-pill, .fw-caption { animation: none; } }
  ` ],
} )
export class FindWelcomeComponent implements OnDestroy {
  readonly firstName = signal( '' );
  readonly dismissed = signal( false );
  readonly playing = signal( false );
  readonly caption = signal( '' );
  trackUrl: string | null = null;

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>( 'video' );
  private readonly http = inject( HttpClient );
  private cues: FindWelcomeCue[] = [];

  constructor () {
    // Browser only, after the page is on screen: nothing here delays it.
    afterNextRender( () => this.lookUp() );
  }

  ngOnDestroy (): void {
    if ( this.trackUrl ) URL.revokeObjectURL( this.trackUrl );
  }

  @HostListener( 'document:keydown.escape' )
  close (): void {
    if ( !this.playing() ) return;
    this.video()?.nativeElement.pause();
    this.playing.set( false );
    this.caption.set( '' );
  }

  open (): void {
    // Filled now, so "Good evening" and the weekday match the moment they press play.
    this.cues = fillCaptions( FIND_WELCOME_CUES, { firstName: this.firstName(), ...timeVars() } );
    if ( this.trackUrl ) URL.revokeObjectURL( this.trackUrl );
    this.trackUrl = URL.createObjectURL( new Blob( [ toVtt( this.cues ) ], { type: 'text/vtt' } ) );
    this.caption.set( '' );
    this.playing.set( true );
  }

  /** The player's CC track and screen readers, built from the same filled cues. Added by hand: Angular won't bind a blob URL to <track src>. */
  addTrack (): void {
    const video = this.video()?.nativeElement;
    if ( !video || !this.trackUrl || video.querySelector( 'track' ) ) return;
    const track = Object.assign( document.createElement( 'track' ), { kind: 'captions', srclang: 'en', label: 'English', src: this.trackUrl } );
    video.appendChild( track );
  }

  onTime (): void {
    const t = this.video()?.nativeElement.currentTime ?? 0;
    const cue = this.cues.find( ( c ) => t >= c.from && t < c.to );
    const text = cue?.text || '';
    if ( text !== this.caption() ) this.caption.set( text );
  }

  private lookUp (): void {
    const link = this.readLink();
    if ( !link ) return;
    const headers = new HttpHeaders().set( 'Authorization', `Bearer ${ environment.apiKey }` );
    this.http.post<{ firstName?: string }>( `${ environment.backendURL }/find/welcome`, { ...link, today: localDay() }, { headers } )
      .subscribe( {
        next: ( res ) => {
          const name = String( res?.firstName || '' ).trim();
          if ( name ) this.firstName.set( name );
          // Their two days are used up (or we don't know them): stop asking.
          else this.forget();
        },
        error: () => undefined,
      } );
  }

  /** The email this visit came from: today's link, else the one remembered from last time. */
  private readLink (): { emailId: string; tenantId: string } | null {
    try {
      const url = new URL( window.location.href );
      const emailId = url.searchParams.get( 'emailId' ) || '';
      const tenantId = url.searchParams.get( 'tenantId' ) || '';
      if ( emailId && tenantId ) {
        try { localStorage.setItem( STORE_KEY, JSON.stringify( { emailId, tenantId } ) ); } catch { /* private mode */ }
        // A copied or shared address shouldn't greet someone else by name.
        LINK_PARAMS.forEach( ( p ) => url.searchParams.delete( p ) );
        history.replaceState( history.state, '', url.pathname + url.search + url.hash );
        return { emailId, tenantId };
      }
      const saved = JSON.parse( localStorage.getItem( STORE_KEY ) || 'null' );
      return saved?.emailId && saved?.tenantId ? { emailId: String( saved.emailId ), tenantId: String( saved.tenantId ) } : null;
    } catch {
      return null;
    }
  }

  private forget (): void {
    try { localStorage.removeItem( STORE_KEY ); } catch { /* private mode */ }
  }
}

function localDay ( date = new Date() ): string {
  const pad = ( n: number ) => String( n ).padStart( 2, '0' );
  return `${ date.getFullYear() }-${ pad( date.getMonth() + 1 ) }-${ pad( date.getDate() ) }`;
}

function toVtt ( cues: FindWelcomeCue[] ): string {
  const stamp = ( s: number ) => {
    const ms = Math.round( s * 1000 );
    const pad = ( n: number, w = 2 ) => String( n ).padStart( w, '0' );
    return `${ pad( Math.floor( ms / 3600000 ) ) }:${ pad( Math.floor( ms / 60000 ) % 60 ) }:${ pad( Math.floor( ms / 1000 ) % 60 ) }.${ pad( ms % 1000, 3 ) }`;
  };
  return 'WEBVTT\n\n' + cues.map( ( c ) => `${ stamp( c.from ) } --> ${ stamp( c.to ) }\n${ c.text }` ).join( '\n\n' ) + '\n';
}
