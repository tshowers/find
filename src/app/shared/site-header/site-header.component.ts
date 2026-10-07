import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlatformMenuComponent } from '../platform-menu/platform-menu.component';

/**
 * Top bar for the About and Help pages (design_handoff_find_grid_about_help
 * 4e/4f): logo + "Find" on the left, Search / Help / About pills and the
 * platform menu on the right. The current page gets a filled pill.
 */
@Component( {
  selector: 'app-site-header',
  standalone: true,
  imports: [RouterLink, PlatformMenuComponent],
  template: `
    <header class="site-header">
      <a class="site-header__brand" routerLink="/" aria-label="Find home">
        <img src="assets/find-logo.png" alt="" />
        <span>Find</span>
      </a>
      <nav class="site-header__nav" aria-label="Find pages">
        <a routerLink="/">Search</a>
        <a routerLink="/help" [class.is-current]="current === 'help'" [attr.aria-current]="current === 'help' ? 'page' : null">Help</a>
        <a routerLink="/about" [class.is-current]="current === 'about'" [attr.aria-current]="current === 'about' ? 'page' : null">About</a>
        <app-platform-menu />
      </nav>
    </header>
  `,
  styles: [ `
    :host { display: block; }
    .site-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 40px; }
    .site-header__brand { display: flex; align-items: center; gap: 10px; color: var(--text); text-decoration: none; }
    .site-header__brand img { height: 30px; width: auto; }
    .site-header__brand span { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
    .site-header__nav { display: flex; align-items: center; gap: 4px; }
    .site-header__nav a { padding: 8px 14px; border-radius: 999px; color: var(--text); font-size: 14px; font-weight: 600; text-decoration: none; transition: background .16s ease; }
    .site-header__nav a:hover, .site-header__nav a.is-current { background: var(--surface); }
    .site-header__nav app-platform-menu { margin-left: 8px; }
    @media (max-width: 700px) {
      .site-header { padding: 14px 16px; gap: 8px; }
      .site-header__brand span { display: none; }
      .site-header__nav { gap: 0; }
      .site-header__nav a { padding: 8px 10px; }
      .site-header__nav app-platform-menu { margin-left: 4px; }
    }
  ` ],
} )
export class SiteHeaderComponent {
  @Input() current: 'help' | 'about' | '' = '';
}
