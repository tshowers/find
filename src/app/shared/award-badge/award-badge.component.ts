import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FindAwardIcon, FindAwardState } from '../../services/find-awards.service';

@Component( {
  selector: 'app-award-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './award-badge.component.html',
  styleUrl: './award-badge.component.css'
} )
export class AwardBadgeComponent {
  @Input( { required: true } ) icon!: FindAwardIcon;
  @Input() state: FindAwardState = 'locked';
  @Input() size = 76;

  get svgSize (): number {
    return Math.round( this.size * 0.62 );
  }

  get radius (): number {
    return Math.round( this.size * 0.25 );
  }

  get mysteryFontSize (): number {
    return Math.round( this.size * 0.27 );
  }
}
