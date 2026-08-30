import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

export type GyroTilt = 'left' | 'right' | 'up' | 'down' | 'center';

@Injectable( { providedIn: 'root' } )
export class FindGyroscopeService implements OnDestroy {
  private readonly _tilt = new BehaviorSubject<GyroTilt>( 'center' );
  readonly tilt$: Observable<GyroTilt> = this._tilt.asObservable().pipe( distinctUntilChanged() );

  private listening = false;

  constructor ( private readonly zone: NgZone ) { }

  get isSupported (): boolean {
    return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
  }

  async enable (): Promise<boolean> {
    if ( !this.isSupported ) return false;
    if ( this.listening ) return true;

    // iOS 13+ requires explicit permission triggered by a user gesture
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<PermissionState> };
    if ( typeof DOE.requestPermission === 'function' ) {
      try {
        const state = await DOE.requestPermission();
        if ( state !== 'granted' ) return false;
      } catch {
        return false;
      }
    }

    this.zone.runOutsideAngular( () => {
      window.addEventListener( 'deviceorientation', this.handleOrientation, { passive: true } );
    } );
    this.listening = true;
    return true;
  }

  disable (): void {
    if ( !this.listening ) return;
    window.removeEventListener( 'deviceorientation', this.handleOrientation );
    this.listening = false;
    this._tilt.next( 'center' );
  }

  ngOnDestroy (): void {
    this.disable();
  }

  private readonly handleOrientation = ( e: DeviceOrientationEvent ): void => {
    // gamma: left/right tilt, -90 to 90. beta: forward/back, ~45 = phone held upright.
    const gamma = e.gamma ?? 0;
    const beta  = e.beta  ?? 45;

    const THRESHOLD = 18;
    let tilt: GyroTilt = 'center';

    if ( Math.abs( gamma ) > Math.abs( beta - 45 ) ) {
      if ( gamma < -THRESHOLD ) tilt = 'left';
      else if ( gamma > THRESHOLD ) tilt = 'right';
    } else {
      if ( beta < 45 - THRESHOLD ) tilt = 'up';
      else if ( beta > 45 + THRESHOLD ) tilt = 'down';
    }

    this.zone.run( () => this._tilt.next( tilt ) );
  };
}
