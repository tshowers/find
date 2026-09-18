import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FindExperienceService, FindFeedbackRating } from '../../services/find-experience.service';

type FindFeedbackStage = 'prompt' | 'detail' | 'submitting' | 'done';

@Component( {
  selector: 'app-find-feedback',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './find-feedback.component.html',
  styleUrl: './find-feedback.component.css'
} )
export class FindFeedbackComponent implements OnChanges {
  @Input() query = '';
  @Input() queryType = '';

  stage: FindFeedbackStage = 'prompt';
  selectedRating: FindFeedbackRating | null = null;
  comment = '';

  readonly ratings: Array<{ value: FindFeedbackRating; label: string; icon: string }> = [
    { value: 'excellent', label: 'Excellent', icon: 'fa-face-grin-stars' },
    { value: 'good', label: 'Good', icon: 'fa-face-smile' },
    { value: 'fair', label: 'Fair', icon: 'fa-face-meh' },
    { value: 'poor', label: 'Poor', icon: 'fa-face-frown' },
  ];

  private readonly DISMISSED_KEY = 'find-feedback-dismissed-queries';
  private dismissedQueries: string[] = [];
  dismissed = false;

  constructor ( private readonly findExperienceService: FindExperienceService ) {
    this.loadDismissed();
  }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( !changes['query'] ) return;
    // A fresh query gets a fresh prompt, even if a previous one was dismissed/submitted.
    this.stage = 'prompt';
    this.selectedRating = null;
    this.comment = '';
    this.dismissed = this.dismissedQueries.includes( this.normalizedQuery );
  }

  get normalizedQuery (): string {
    return String( this.query || '' ).trim().toLowerCase();
  }

  selectRating ( rating: FindFeedbackRating ): void {
    this.selectedRating = rating;
    this.stage = 'detail';
  }

  submit (): void {
    if ( !this.selectedRating || this.stage === 'submitting' ) return;
    this.stage = 'submitting';
    this.findExperienceService.submitFeedback( {
      rating: this.selectedRating,
      comment: this.comment.trim() || null,
      query: this.query || null,
      queryType: this.queryType || null,
    } ).subscribe( {
      next: () => { this.stage = 'done'; },
      error: () => { this.stage = 'done'; },
    } );
  }

  skipComment (): void {
    this.comment = '';
    this.submit();
  }

  dismiss (): void {
    this.dismissed = true;
    if ( !this.dismissedQueries.includes( this.normalizedQuery ) ) {
      this.dismissedQueries = [this.normalizedQuery, ...this.dismissedQueries].slice( 0, 50 );
      this.saveDismissed();
    }
  }

  private loadDismissed (): void {
    try {
      const raw = localStorage.getItem( this.DISMISSED_KEY );
      this.dismissedQueries = raw ? JSON.parse( raw ) : [];
    } catch {
      this.dismissedQueries = [];
    }
  }

  private saveDismissed (): void {
    try {
      localStorage.setItem( this.DISMISSED_KEY, JSON.stringify( this.dismissedQueries ) );
    } catch { /* ignore */ }
  }
}
