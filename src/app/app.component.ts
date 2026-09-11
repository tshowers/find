import { NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { CommandPaletteComponent } from './shared/page/command-palette/command-palette.component';
import { PlatformMenuComponent } from './shared/platform-menu/platform-menu.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommandPaletteComponent, PlatformMenuComponent, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'find';
  showInstallBanner = false;
  readonly appStoreUrl = 'https://apps.apple.com/us/app/taliferro-find/id6806954591';

  ngOnInit (): void {
    this.showInstallBanner = this.shouldShowInstallBanner();
    if ( environment.production ) {
      this.checkDeployedVersion();
    }
  }

  dismissInstallBanner (): void {
    this.showInstallBanner = false;
    try { window.localStorage.setItem( 'find-install-banner-dismissed', '1' ); } catch { /* storage may be unavailable */ }
  }

  private shouldShowInstallBanner (): boolean {
    if ( typeof window === 'undefined' || typeof navigator === 'undefined' ) return false;
    const userAgent = navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test( userAgent ) || ( navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 );
    const isStandalone = window.matchMedia?.( '(display-mode: standalone)' ).matches || ( navigator as Navigator & { standalone?: boolean } ).standalone === true;
    if ( !isIos || isStandalone ) return false;
    try { return window.localStorage.getItem( 'find-install-banner-dismissed' ) !== '1'; } catch { return true; }
  }

  // Same mechanism as the main TODD app: package.json's version is baked
  // into environment.VERSION at build time (see prebuild script), while
  // public/assets/version.json always reflects whatever's actually live on
  // the server (fetched no-store, cache-busted). If they differ, a newer
  // build has been deployed since this tab loaded, so force a reload to
  // pick it up rather than leaving the user on stale code indefinitely.
  private async checkDeployedVersion (): Promise<void> {
    try {
      if ( typeof window === 'undefined' || typeof fetch === 'undefined' ) return;

      const currentVersion = String( environment.VERSION || '' ).trim();
      if ( !currentVersion ) return;

      const response = await fetch( `assets/version.json?t=${Date.now()}`, {
        cache: 'no-store'
      } );

      if ( !response.ok ) return;

      const deployed = await response.json();
      const deployedVersion = String( deployed?.version || '' ).trim();
      if ( !deployedVersion || deployedVersion === currentVersion ) return;

      window.location.reload();
    } catch {
      // Network hiccup or version.json unavailable - not worth surfacing to the user.
    }
  }
}
