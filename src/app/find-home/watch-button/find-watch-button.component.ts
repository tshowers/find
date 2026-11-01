import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FindExperienceService, FindWatch } from '../../services/find-experience.service';

// "Watch" on one product or sale page inside a single-item card. Same watch
// as the result screen's Watch button (findWatch in the backend): Find checks
// the page a few times a day and History shows what changed. A page whose
// price Find can read gets a price watch; others get a page watch.
@Component( {
  selector: 'app-find-watch-button',
  standalone: true,
  imports: [ CommonModule ],
  template: `
    <button type="button" class="wb" [class.wb--on]="!!watch" [disabled]="busy" (click)="toggle(); $event.preventDefault(); $event.stopPropagation()" [attr.aria-pressed]="!!watch" [attr.aria-label]="(watch ? 'Stop watching ' : 'Watch ') + title" [attr.title]="message || null">
      <i class="fa-solid" [ngClass]="watch ? 'fa-eye' : 'fa-bell'" aria-hidden="true"></i>
      <span>{{ watch ? 'Watching' : 'Watch' }}</span>
    </button>
  `,
  styles: [ `
    :host { display: inline-flex; }
    .wb {
      display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px;
      border: 0; border-radius: 999px; background: var(--wb-bg, var(--surface)); color: var(--text);
      font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;
    }
    .wb:hover:not(:disabled) { filter: brightness(.94); }
    .wb:disabled { opacity: .6; cursor: default; }
    .wb--on { background: var(--t-blue); color: var(--t-blue-fg); }
  ` ],
} )
export class FindWatchButtonComponent {
  @Input( { required: true } ) url!: string;
  @Input( { required: true } ) title!: string;
  @Input() query = '';
  /** Lets the result screen add it to History's watch list. */
  @Output() watched = new EventEmitter<FindWatch>();
  @Output() unwatched = new EventEmitter<string>();

  watch: FindWatch | null = null;
  busy = false;
  message = '';

  constructor ( private readonly findExperienceService: FindExperienceService ) { }

  toggle (): void {
    if ( this.busy ) return;
    this.busy = true;
    this.message = '';
    const existing = this.watch;
    if ( existing ) {
      this.findExperienceService.removeWatch( existing.id ).subscribe( {
        next: () => { this.busy = false; this.watch = null; this.unwatched.emit( existing.id ); },
        error: () => { this.busy = false; this.message = 'Find couldn’t stop watching right now.'; },
      } );
      return;
    }
    this.findExperienceService.createWatch( { query: this.query, url: this.url, title: this.title } ).subscribe( {
      next: ( { watch } ) => { this.busy = false; this.watch = watch; this.watched.emit( watch ); },
      error: ( err ) => { this.busy = false; this.message = err?.error?.message || 'Find couldn’t start watching right now.'; },
    } );
  }
}
