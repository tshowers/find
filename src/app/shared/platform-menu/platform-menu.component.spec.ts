import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PlatformMenuComponent } from './platform-menu.component';

describe('PlatformMenuComponent', () => {
  let fixture: ComponentFixture<PlatformMenuComponent>;
  let component: PlatformMenuComponent;

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.platform-menu-trigger');
  }

  function panel(): HTMLElement {
    return fixture.nativeElement.querySelector('.platform-menu-panel');
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PlatformMenuComponent],
      // The component now uses RouterModule for the Search/Help/About
      // links (routerLink), which needs a Router/ActivatedRoute available
      // in the injector — an empty route config is enough for these tests,
      // which never actually navigate.
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(PlatformMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens the product launcher panel when the menu button is clicked', () => {
    expect(component.isOpen).toBeFalse();
    expect(panel().classList).not.toContain('platform-menu-panel--open');

    trigger().click();
    fixture.detectChanges();

    expect(component.isOpen).toBeTrue();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(panel().classList).toContain('platform-menu-panel--open');
  });

  it('closes the panel when the menu button is clicked again', () => {
    trigger().click();
    fixture.detectChanges();
    trigger().click();
    fixture.detectChanges();

    expect(component.isOpen).toBeFalse();
    expect(panel().classList).not.toContain('platform-menu-panel--open');
  });

  it('closes the panel when the overlay behind it is clicked', () => {
    trigger().click();
    fixture.detectChanges();

    const overlay: HTMLElement = fixture.nativeElement.querySelector('.platform-menu-overlay');
    overlay.click();
    fixture.detectChanges();

    expect(component.isOpen).toBeFalse();
  });
});
