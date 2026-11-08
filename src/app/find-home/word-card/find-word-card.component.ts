import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { FindEntity, FindExperienceService, FindWordSection } from '../../services/find-experience.service';

// A dictionary card for "define <word>": the word, how to say it, and its
// meanings, straight from the dictionary (the backend's findDictionary
// service), so the same word reads the same every time. A synonym is a
// new "define" search.
@Component( {
  selector: 'app-find-word-card',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './find-word-card.component.html',
  styleUrls: [ '../entity-card/find-entity-card.component.css', './find-word-card.component.css' ],
} )
export class FindWordCardComponent implements OnChanges, OnDestroy {
  @Input( { required: true } ) entity!: FindEntity;
  @Input() query = '';
  @Input() moreCount: number | null = null;
  @Output() moreResults = new EventEmitter<void>();
  @Output() search = new EventEmitter<string>();

  word?: FindWordSection | null;
  playing = false;

  private sub?: Subscription;
  private audio?: HTMLAudioElement;

  constructor ( private readonly findExperienceService: FindExperienceService ) { }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( !changes[ 'entity' ] || !this.entity ) return;
    this.sub?.unsubscribe();
    this.stopAudio();
    this.word = undefined;
    this.sub = this.findExperienceService.entitySection<FindWordSection>( this.entity, 'word' ).subscribe( {
      next: response => this.word = response?.data ?? null,
      error: () => this.word = null,
    } );
  }

  ngOnDestroy (): void {
    this.sub?.unsubscribe();
    this.stopAudio();
  }

  trackByIndex ( index: number ): number {
    return index;
  }

  /** Plays the dictionary's recording of the word. */
  playAudio (): void {
    const url = this.word?.audioUrl;
    if ( !url ) return;
    this.stopAudio();
    this.audio = new Audio( url );
    this.playing = true;
    this.audio.onended = () => this.playing = false;
    this.audio.onerror = () => this.playing = false;
    this.audio.play().catch( () => this.playing = false );
  }

  /** "an adjective", "a noun". */
  article ( word: string ): string {
    return /^[aeiou]/i.test( word ) ? 'an' : 'a';
  }

  defineWord ( synonym: string ): void {
    this.search.emit( `define ${ synonym }` );
  }

  private stopAudio (): void {
    this.audio?.pause();
    this.audio = undefined;
    this.playing = false;
  }
}
