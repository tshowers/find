import { NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { CommandPaletteComponent } from './shared/page/command-palette/command-palette.component';
import { UpdateBannerComponent } from './shared/update-banner/update-banner.component';
import { VersionUpdateService } from './shared/version-update/version-update.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommandPaletteComponent, UpdateBannerComponent, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly versionUpdateService = inject( VersionUpdateService );

  title = 'find';
  showInstallBanner = false;
  readonly appStoreUrl = 'https://apps.apple.com/us/app/taliferro-find/id6806954591';

  ngOnInit (): void {
    this.showInstallBanner = this.shouldShowInstallBanner();
    if ( environment.production ) {
      this.versionUpdateService.start();
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
}
