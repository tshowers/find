import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'find';

  ngOnInit (): void {
    if ( environment.production ) {
      this.checkDeployedVersion();
    }
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
