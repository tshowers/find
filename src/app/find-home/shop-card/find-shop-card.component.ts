import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { FindEntity, FindExperienceService, FindShopSection, FindWatch } from '../../services/find-experience.service';
import { FindWatchButtonComponent } from '../watch-button/find-watch-button.component';

// One card for a 16Ahead Store shop ("todd office"): the store layout from
// design_handoff_find_single_results, filled from the shop itself: its logo,
// colors, description and products, each product with Watch (the store's
// product pages carry their price, so it's a real price watch).
@Component( {
  selector: 'app-find-shop-card',
  standalone: true,
  imports: [ CommonModule, FindWatchButtonComponent ],
  templateUrl: './find-shop-card.component.html',
  styleUrls: [ '../entity-card/find-entity-card.component.css', './find-shop-card.component.css' ],
} )
export class FindShopCardComponent implements OnChanges, OnDestroy {
  @Input( { required: true } ) entity!: FindEntity;
  @Input() query = '';
  @Input() moreCount: number | null = null;
  @Output() moreResults = new EventEmitter<void>();
  @Output() watched = new EventEmitter<FindWatch>();

  shop?: FindShopSection | null;
  logoFailed = false;

  private sub?: Subscription;

  constructor ( private readonly findExperienceService: FindExperienceService ) { }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( !changes[ 'entity' ] || !this.entity ) return;
    this.sub?.unsubscribe();
    this.shop = undefined;
    this.logoFailed = false;
    this.sub = this.findExperienceService.entitySection<FindShopSection>( this.entity, 'shop' ).subscribe( {
      next: response => this.shop = response?.data ?? null,
      error: () => this.shop = null,
    } );
  }

  ngOnDestroy (): void {
    this.sub?.unsubscribe();
  }

  /** The shop's own colors, light and dark, as CSS variables for the tinted tile. */
  get tintStyle (): Record<string, string> {
    const style: Record<string, string> = {};
    if ( this.entity.tint ) style[ '--shop-tint' ] = this.entity.tint;
    if ( this.entity.tintFg ) style[ '--shop-tint-fg' ] = this.entity.tintFg;
    if ( this.entity.tintDark ) style[ '--shop-tint-dark' ] = this.entity.tintDark;
    if ( this.entity.tintFgDark ) style[ '--shop-tint-fg-dark' ] = this.entity.tintFgDark;
    return style;
  }

  get storeUrl (): string {
    return this.shop?.url || this.entity.website || 'https://16ahead.store';
  }

  get facts (): Array<{ value: string; label: string }> {
    const shop = this.shop;
    if ( !shop ) return [];
    return [
      shop.productCount ? { value: String( shop.productCount ), label: shop.productCount === 1 ? 'product' : 'products' } : null,
      ...shop.features.map( feature => ( { value: feature, label: '' } ) ),
      shop.returns ? { value: shop.returns, label: '' } : null,
      shop.freeShippingOver ? { value: `Free shipping over ${ shop.freeShippingOver }`, label: '' } : null,
    ].filter( ( fact ): fact is { value: string; label: string } => !!fact );
  }
}
