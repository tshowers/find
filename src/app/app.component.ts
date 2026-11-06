import { NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { UpdateBannerComponent } from './shared/update-banner/update-banner.component';
import { VersionUpdateService } from './shared/version-update/version-update.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UpdateBannerComponent, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly versionUpdateService = inject( VersionUpdateService );
  private readonly router = inject( Router );

  title = 'find';
  showInstallBanner = false;
  readonly appStoreUrl = 'https://apps.apple.com/us/app/taliferro-find/id6806954591';

  ngOnInit (): void {
    this.showInstallBanner = this.shouldShowInstallBanner();
    if ( environment.production ) {
      this.versionUpdateService.start();
    }
    this.trackMetaPageViews();
  }

  // index.html fires the Meta Pixel PageView for the first page load; this
  // reports later in-app route changes (e.g. / -> /help) so Meta sees them too.
  private trackMetaPageViews (): void {
    if ( typeof window === 'undefined' ) return;
    let first = true;
    this.router.events.pipe( filter( ( e ) => e instanceof NavigationEnd ) ).subscribe( () => {
      if ( first ) { first = false; return; }
      const fbq = ( window as Window & { fbq?: ( ...args: unknown[] ) => void } ).fbq;
      if ( typeof fbq === 'function' ) fbq( 'track', 'PageView' );
    } );
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
}
