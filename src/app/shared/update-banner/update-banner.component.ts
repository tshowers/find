import { NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { VersionUpdateService } from '../version-update/version-update.service';

@Component( {
  selector: 'app-update-banner',
  standalone: true,
  imports: [NgIf],
  templateUrl: './update-banner.component.html',
  styleUrl: './update-banner.component.css'
} )
export class UpdateBannerComponent {
  private readonly versionUpdateService = inject( VersionUpdateService );

  readonly showBanner = this.versionUpdateService.showBanner;

  refresh (): void {
    this.versionUpdateService.refresh();
  }

  dismiss (): void {
    this.versionUpdateService.dismiss();
  }
}
