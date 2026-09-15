import { Injectable, computed, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Polls public/assets/version.json (written at build time by
 * scripts/update-build-version.mjs) and compares it against the version
 * baked into this bundle via environment.VERSION. When they differ, a
 * newer build has been deployed since this tab loaded. Unlike a service
 * worker's own update check, this never reloads on its own - it only
 * flips `updateAvailable` so the UI can ask the user first.
 */
@Injectable( { providedIn: 'root' } )
export class VersionUpdateService {
  private static readonly POLL_INTERVAL_MS = 10 * 60 * 1000;

  private readonly updateAvailable = signal( false );
  private readonly dismissed = signal( false );
  readonly showBanner = computed( () => this.updateAvailable() && !this.dismissed() );

  private started = false;
  private pollTimer?: ReturnType<typeof setInterval>;

  start (): void {
    if ( this.started || typeof window === 'undefined' || typeof fetch === 'undefined' ) return;
    this.started = true;

    this.checkNow();
    this.pollTimer = setInterval( () => this.checkNow(), VersionUpdateService.POLL_INTERVAL_MS );
    document.addEventListener( 'visibilitychange', () => {
      if ( document.visibilityState === 'visible' ) this.checkNow();
    } );
  }

  refresh (): void {
    window.location.reload();
  }

  dismiss (): void {
    this.dismissed.set( true );
  }

  private async checkNow (): Promise<void> {
    try {
      const currentVersion = String( environment.VERSION || '' ).trim();
      if ( !currentVersion ) return;

      const response = await fetch( `assets/version.json?t=${Date.now()}`, { cache: 'no-store' } );
      if ( !response.ok ) return;

      const deployed = await response.json();
      const deployedVersion = String( deployed?.version || '' ).trim();
      if ( !deployedVersion || deployedVersion === currentVersion ) return;

      this.updateAvailable.set( true );
    } catch {
      // Network hiccup or version.json unavailable - not worth surfacing to the user.
    }
  }
}
