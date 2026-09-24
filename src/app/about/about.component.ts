import { DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, Renderer2 } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { PlatformMenuComponent } from '../shared/platform-menu/platform-menu.component';
import { SeoService } from '../shared/seo.service';

@Component({
  selector: 'app-find-about',
  standalone: true,
  imports: [RouterLink, PlatformMenuComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.css',
})
export class AboutComponent implements OnInit, OnDestroy {
  private schemaScript: HTMLScriptElement | null = null;

  constructor (
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly renderer: Renderer2,
    private readonly title: Title,
    private readonly meta: Meta,
    private readonly seo: SeoService,
  ) { }

  ngOnInit (): void {
    const pageTitle = 'About Find | Taliferro Tech';
    const description = 'Find is Taliferro Tech\'s search and answer application: the strongest result first, with context when you need it.';
    this.title.setTitle( pageTitle );
    this.meta.updateTag( { name: 'description', content: description } );
    this.meta.updateTag( { property: 'og:title', content: pageTitle } );
    this.meta.updateTag( { property: 'og:description', content: description } );
    this.meta.updateTag( { property: 'og:url', content: 'https://find.taliferro.tech/about' } );
    this.meta.updateTag( { name: 'twitter:title', content: pageTitle } );
    this.meta.updateTag( { name: 'twitter:description', content: description } );
    this.seo.setCanonical( 'https://find.taliferro.tech/about' );
    this.addStructuredData();
  }

  ngOnDestroy (): void {
    this.schemaScript?.remove();
  }

  private addStructuredData (): void {
    this.schemaScript = this.renderer.createElement( 'script' ) as HTMLScriptElement;
    this.schemaScript.type = 'application/ld+json';
    this.schemaScript.id = 'find-about-structured-data';
    this.schemaScript.text = JSON.stringify( {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': 'https://taliferro.com/#organization',
          name: 'Taliferro Tech, LLC',
          url: 'https://taliferro.com',
          logo: 'https://find.taliferro.tech/assets/find/entities/taliferro-tech/logo.png',
          description: 'Taliferro Tech creates software products that help people find information, build momentum, and act on useful context.',
        },
        {
          '@type': 'SoftwareApplication',
          '@id': 'https://find.taliferro.tech/#software',
          name: 'Find',
          url: 'https://find.taliferro.tech/',
          description: 'Find is a search and answer application that puts the strongest result first, with context, alternatives, and source material when you need it.',
          applicationCategory: 'SearchApplication',
          applicationSubCategory: 'Answer engine',
          operatingSystem: 'Web, iOS',
          isAccessibleForFree: true,
          image: 'https://find.taliferro.tech/assets/seo/find-card.webp',
          downloadUrl: 'https://apps.apple.com/us/app/taliferro-find/id6806954591',
          creator: { '@id': 'https://taliferro.com/#organization' },
          publisher: { '@id': 'https://taliferro.com/#organization' },
        },
      ],
    } );
    this.renderer.appendChild( this.document.head, this.schemaScript );
  }
}
