// SYNCED FROM taliferro-ui/sound - edit it there, then run
// taliferro-ui/sound/sync.sh.
import { Injectable, NgZone } from '@angular/core';

/** The TODD sound set (Ty, 2026-11-11). Same names as before, so existing calls keep working. */
const SOUNDS: Record<string, string> = {
  click: 'assets/sounds/button.wav',          // any button press
  select: 'assets/sounds/select.wav',         // a choice pill, tab, radio, checkbox or dropdown pick
  alert: 'assets/sounds/alert.mp3',           // any popup or dialog
  error: 'assets/sounds/error.mp3',           // any error message
  finished: 'assets/sounds/finished.wav',     // long work done: a Catalyst run, a Mission
  notification: 'assets/sounds/notification.wav', // any notification or toast
  toggleOn: 'assets/sounds/toggle_on.wav',    // the menu opens
  toggleOff: 'assets/sounds/toggle_off.wav',  // the menu closes
  tap: 'assets/sounds/tap_01.wav',
  open: 'assets/sounds/transition_up.wav',
  close: 'assets/sounds/transition_down.wav',
};

/** What counts as "a button was pushed". */
const PRESS_SELECTOR = 'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"], a.btn, a.button';
/** Buttons that pick something rather than do something. */
const SELECT_SELECTOR = '[role="radio"], [role="tab"], [role="option"], [role="switch"], [role="menuitemradio"], [role="menuitemcheckbox"], [aria-pressed], .choice-pill, [data-sound="select"]';
/** A popup appearing. */
const POPUP_SELECTOR = 'dialog, [role="dialog"], [role="alertdialog"]';
/** An error message appearing. */
const ERROR_SELECTOR = '[role="alert"]';
/** A sound played by code within this window covers the automatic popup/error sound. */
const AUTO_QUIET_MS = 400;

/**
 * The app's sounds. One document listener plays them the moment it happens:
 * - a button press plays `click` on pointerdown (not on release, not after the
 *   work it starts), Enter/Space on a focused button too;
 * - a pill, tab, radio, checkbox or dropdown pick plays `select` instead;
 * - a dialog appearing plays `alert` (also window.alert/confirm/prompt);
 * - an error message (role="alert") appearing plays `error`.
 * The menu plays toggleOn/toggleOff, notification services play
 * `notification` (or `error` for error toasts), and long jobs play `finished`.
 * Mark an element (or a wrapper) `data-sound="off"` to keep it quiet.
 *
 * Sounds are fetched and decoded into Web Audio buffers when the app starts,
 * so they play with no delay. Browsers keep audio suspended until the first
 * tap or key; that same press resumes it and plays.
 */
@Injectable( { providedIn: 'root' } )
export class SoundService {
  private ctx: AudioContext | null = null;
  private readonly buffers: Record<string, AudioBuffer> = {};
  private readonly fallback: Record<string, HTMLAudioElement> = {};
  private lastPlayedAt = 0;

  constructor ( private readonly zone: NgZone ) {
    if ( typeof window === 'undefined' || typeof document === 'undefined' ) return;
    this.preload();

    const wake = () => { if ( this.ctx && this.ctx.state === 'suspended' ) void this.ctx.resume().catch( () => undefined ); };
    document.addEventListener( 'pointerdown', ( event ) => { wake(); this.onPress( event as PointerEvent ); }, { passive: true, capture: true } );
    document.addEventListener( 'keydown', ( event ) => { wake(); this.onKey( event as KeyboardEvent ); }, { passive: true, capture: true } );
    document.addEventListener( 'change', ( event ) => this.onChange( event ), { passive: true, capture: true } );
    this.watchForPopupsAndErrors();
    this.wrapNativeDialogs();
  }

  playSound ( name: string ): void {
    // Button presses are played by the document listener at press time; the
    // old per-component playSound('click') calls ran after the work and
    // sounded late, so they're quiet now.
    if ( name === 'click' ) return;
    this.play( name );
  }

  private play ( name: string ): void {
    this.lastPlayedAt = Date.now();
    const buffer = this.buffers[name];
    if ( this.ctx && buffer ) {
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect( this.ctx.destination );
        source.start();
        return;
      } catch { /* fall through to the element */ }
    }
    const src = SOUNDS[name];
    if ( !src ) return;
    const audio = this.fallback[name] || ( this.fallback[name] = Object.assign( new Audio( src ), { preload: 'auto' } ) );
    audio.currentTime = 0;
    audio.play().catch( ( error ) => {
      // Autoplay still blocked (no real interaction yet): stay quiet.
      if ( String( error?.name ) !== 'NotAllowedError' ) console.warn( `Sound ${ name } failed:`, error );
    } );
  }

  private preload (): void {
    const Ctx = ( window as any ).AudioContext || ( window as any ).webkitAudioContext;
    if ( !Ctx || typeof fetch === 'undefined' ) return;
    try {
      this.ctx = new Ctx() as AudioContext;
    } catch {
      this.ctx = null;
      return;
    }
    for ( const [name, src] of Object.entries( SOUNDS ) ) {
      fetch( src )
        .then( ( response ) => response.ok ? response.arrayBuffer() : Promise.reject( response.status ) )
        .then( ( data ) => this.ctx!.decodeAudioData( data ) )
        .then( ( buffer ) => { this.buffers[name] = buffer; } )
        .catch( () => undefined );
    }
  }

  private quiet ( el: Element | null ): boolean {
    return !el || !!el.closest( '[data-sound="off"]' );
  }

  private disabled ( el: Element ): boolean {
    return ( el as HTMLButtonElement ).disabled === true || el.getAttribute( 'aria-disabled' ) === 'true';
  }

  /** The sound a pressed element should make, or '' for none. */
  private soundFor ( target: Element | null ): string {
    const pick = target?.closest?.( SELECT_SELECTOR );
    if ( pick && !this.quiet( pick ) && !this.disabled( pick ) ) return 'select';
    const button = target?.closest?.( PRESS_SELECTOR );
    if ( !button || this.quiet( button ) || this.disabled( button ) ) return '';
    return 'click';
  }

  private onPress ( event: PointerEvent ): void {
    if ( event.button !== undefined && event.button !== 0 ) return;
    const sound = this.soundFor( event.target as Element | null );
    if ( sound ) this.play( sound );
  }

  private onKey ( event: KeyboardEvent ): void {
    if ( event.repeat || ( event.key !== 'Enter' && event.key !== ' ' ) ) return;
    const target = event.target as Element | null;
    // Enter in a text field submits a form; that isn't a button press.
    if ( !target || target.matches( 'input:not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select, [contenteditable="true"]' ) ) return;
    const sound = this.soundFor( target );
    if ( sound ) this.play( sound );
  }

  /** Dropdowns, radios and checkboxes change without a button press. */
  private onChange ( event: Event ): void {
    const target = event.target as Element | null;
    if ( !target || this.quiet( target ) ) return;
    if ( target.matches( 'select, input[type="radio"], input[type="checkbox"]' ) ) this.play( 'select' );
  }

  private watchForPopupsAndErrors (): void {
    if ( typeof MutationObserver === 'undefined' ) return;
    const check = ( el: Element ): string => {
      if ( this.quiet( el ) ) return '';
      if ( el.matches( POPUP_SELECTOR ) || el.querySelector( POPUP_SELECTOR ) ) return 'alert';
      const err = el.matches( ERROR_SELECTOR ) ? el : el.querySelector( ERROR_SELECTOR );
      if ( err && !this.quiet( err ) && String( err.textContent || '' ).trim() ) return 'error';
      return '';
    };
    // Outside Angular: the callback only plays a sound, and running it inside
    // the zone triggers change detection, whose DOM updates (e.g. an *ngFor
    // over a getter re-rendering its <option>s) fire the observer again,
    // forever. That froze the conversion card.
    const start = () => this.zone.runOutsideAngular( () => {
      new MutationObserver( ( mutations ) => {
        let sound = '';
        for ( const m of mutations ) {
          if ( m.type === 'attributes' ) {
            const el = m.target as Element;
            if ( el instanceof HTMLDialogElement && el.open && !this.quiet( el ) ) sound = 'alert';
            continue;
          }
          m.addedNodes.forEach( ( node ) => {
            if ( !sound && node.nodeType === 1 ) sound = check( node as Element );
          } );
          if ( sound ) break;
        }
        // A toast or a component that already played its own sound covers it.
        if ( sound && Date.now() - this.lastPlayedAt > AUTO_QUIET_MS ) this.play( sound );
      } ).observe( document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] } );
    } );
    if ( document.body ) start();
    else document.addEventListener( 'DOMContentLoaded', start, { once: true } );
  }

  private wrapNativeDialogs (): void {
    for ( const name of ['alert', 'confirm', 'prompt'] as const ) {
      const original = ( window as any )[name];
      if ( typeof original !== 'function' || original.__sound ) continue;
      const wrapped = ( ...args: unknown[] ) => { this.play( 'alert' ); return original.apply( window, args ); };
      ( wrapped as any ).__sound = true;
      ( window as any )[name] = wrapped;
    }
  }
}
