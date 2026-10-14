import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FindSwipeDirective } from './find-swipe.directive';

@Component( {
  standalone: true,
  imports: [FindSwipeDirective],
  template: `<div findSwipe (swipeLeft)="swipes.push('left')" (swipeRight)="swipes.push('right')" style="width: 600px; height: 200px">
    <p class="text">Russell plans to take grid penalty at Las Vegas GP</p>
    <input class="field" value="sports news">
  </div>`,
} )
class HostComponent {
  swipes: string[] = [];
}

describe('FindSwipeDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const el = (selector: string) => fixture.nativeElement.querySelector(selector) as HTMLElement;
  function drag (target: HTMLElement, fromX: number, toX: number): void {
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: fromX, clientY: 50 }));
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: toX, clientY: 50 }));
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    window.getSelection()?.removeAllRanges();
  });

  afterEach(() => window.getSelection()?.removeAllRanges());

  it('treats a mouse drag as a swipe', () => {
    drag(el('.text'), 300, 100);
    drag(el('.text'), 100, 300);
    expect(host.swipes).toEqual(['left', 'right']);
  });

  it('ignores a drag that selected text, so copying never navigates', () => {
    const text = el('.text');
    text.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 50 }));
    window.getSelection()!.selectAllChildren(text);
    text.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 400, clientY: 50 }));
    expect(host.swipes).toEqual([]);
  });

  it('ignores a drag that started in a text field', () => {
    drag(el('.field'), 100, 400);
    expect(host.swipes).toEqual([]);
  });

  it('ignores short movements', () => {
    drag(el('.text'), 100, 130);
    expect(host.swipes).toEqual([]);
  });
});
