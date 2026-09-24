import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // withFetch(): Angular's own recommendation once SSR/prerendering is
    // enabled (NG02801) — the fetch-based backend performs better and is
    // more compatible with the Node runtime prerendering runs under than
    // the default XHR-based one.
    provideHttpClient(withFetch()), provideClientHydration(withEventReplay()),
  ]
};
