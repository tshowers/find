import { Directive, ElementRef, EventEmitter, NgZone, OnDestroy, OnInit, Output } from '@angular/core';

@Directive( {
  selector: '[findSwipe]',
  standalone: true
} )
export class FindSwipeDirective implements OnInit, OnDestroy {
  @Output() swipeLeft = new EventEmitter<void>();
  @Output() swipeRight = new EventEmitter<void>();
  @Output() swipeUp = new EventEmitter<void>();
  @Output() swipeDown = new EventEmitter<void>();

  private startX = 0;
  private startY = 0;
  private mouseDown = false;
  private readonly MIN_DISTANCE = 48;

  private readonly onTouchStart = ( e: TouchEvent ): void => {
    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;
  };

  private readonly onTouchEnd = ( e: TouchEvent ): void => {
    this.emit( e.changedTouches[0].clientX - this.startX, e.changedTouches[0].clientY - this.startY );
  };

  private readonly onMouseDown = ( e: MouseEvent ): void => {
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.mouseDown = true;
  };

  private readonly onMouseUp = ( e: MouseEvent ): void => {
    if ( !this.mouseDown ) return;
    this.mouseDown = false;
    this.emit( e.clientX - this.startX, e.clientY - this.startY );
  };

  private emit ( dx: number, dy: number ): void {
    const absDx = Math.abs( dx );
    const absDy = Math.abs( dy );
    if ( absDx < this.MIN_DISTANCE && absDy < this.MIN_DISTANCE ) return;
    this.zone.run( () => {
      if ( absDx >= absDy ) {
        dx < 0 ? this.swipeLeft.emit() : this.swipeRight.emit();
      } else {
        dy < 0 ? this.swipeUp.emit() : this.swipeDown.emit();
      }
    } );
  }

  constructor ( private readonly el: ElementRef<HTMLElement>, private readonly zone: NgZone ) { }

  ngOnInit (): void {
    this.zone.runOutsideAngular( () => {
      this.el.nativeElement.addEventListener( 'touchstart', this.onTouchStart, { passive: true } );
      this.el.nativeElement.addEventListener( 'touchend', this.onTouchEnd, { passive: true } );
      this.el.nativeElement.addEventListener( 'mousedown', this.onMouseDown );
      this.el.nativeElement.addEventListener( 'mouseup', this.onMouseUp );
    } );
  }

  ngOnDestroy (): void {
    this.el.nativeElement.removeEventListener( 'touchstart', this.onTouchStart );
    this.el.nativeElement.removeEventListener( 'touchend', this.onTouchEnd );
    this.el.nativeElement.removeEventListener( 'mousedown', this.onMouseDown );
    this.el.nativeElement.removeEventListener( 'mouseup', this.onMouseUp );
  }
}
