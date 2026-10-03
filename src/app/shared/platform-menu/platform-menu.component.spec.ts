import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PlatformMenuComponent } from './platform-menu.component';

describe('PlatformMenuComponent', () => {
  let fixture: ComponentFixture<PlatformMenuComponent>;
  let component: PlatformMenuComponent;

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.um-trigger');
  }

  // While open, the overlay is moved to <body> so nothing on the page can cover it.
  function panel(): HTMLElement | null {
    return document.body.querySelector('.um-panel');
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PlatformMenuComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(PlatformMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    component?.close();
    fixture?.detectChanges();
  });

  it('opens the menu when the Menu button is clicked', () => {
    expect(component.isOpen).toBeFalse();
    expect(panel()).toBeNull();

    trigger().click();
    fixture.detectChanges();

    expect(component.isOpen).toBeTrue();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(panel()).not.toBeNull();
  });

  it('closes when the backdrop behind the panel is clicked', () => {
    component.open();
    fixture.detectChanges();

    (document.body.querySelector('.um-backdrop') as HTMLElement).click();
    fixture.detectChanges();

    expect(component.isOpen).toBeFalse();
    expect(panel()).toBeNull();
  });

  it('toggles with Command-K and closes with Escape', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    fixture.detectChanges();
    expect(component.isOpen).toBeTrue();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(component.isOpen).toBeFalse();
  });

  it('lists the other products but not Find itself', () => {
    const labels = component.products.map((product) => product.label);
    expect(labels).toContain('Outreach');
    expect(labels).not.toContain('Find');
  });

  it('filters products by the search query', () => {
    component.query = 'pul';
    expect(component.visibleProducts.map((product) => product.label)).toEqual(['Pulse']);
  });
});
