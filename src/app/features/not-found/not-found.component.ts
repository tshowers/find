import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

/**
 * Target of the wildcard route. Firebase Hosting answers every unknown URL
 * with 200 and the app shell, so this page is what Google sees there. It
 * marks itself noindex (restoring index.html's robots tag on the way out) so
 * unknown URLs are dropped as "Excluded by noindex" instead of being reported
 * as soft 404s or duplicates of the home page.
 */
@Component( {
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.css',
} )
export class NotFoundComponent implements OnInit, OnDestroy {
  private readonly meta = inject( Meta );
  private readonly title = inject( Title );
  private previousRobots: string | null = null;
  private previousTitle = '';

  ngOnInit (): void {
    this.previousRobots = this.meta.getTag( 'name="robots"' )?.content ?? null;
    this.previousTitle = this.title.getTitle();
    this.meta.updateTag( { name: 'robots', content: 'noindex' } );
    this.title.setTitle( 'Page not found | Find' );
  }

  ngOnDestroy (): void {
    if ( this.previousRobots === null ) {
      this.meta.removeTag( 'name="robots"' );
    } else {
      this.meta.updateTag( { name: 'robots', content: this.previousRobots } );
    }
    this.title.setTitle( this.previousTitle );
  }
}
