import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';

// Angular's own Title/Meta services cover <title> and <meta> tags, but not
// <link rel="canonical">, which every route also needs its own value for
// (index.html ships one hardcoded to the homepage). This updates the same
// canonical element index.html already has, rather than inserting a
// duplicate — works identically during prerendering (DOCUMENT is Angular's
// SSR-safe DOM abstraction) and in the live client-side SPA.
@Injectable({ providedIn: 'root' })
export class SeoService {
  constructor(@Inject(DOCUMENT) private readonly document: Document) {}

  setCanonical(url: string): void {
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
