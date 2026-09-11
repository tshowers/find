import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommandPaletteEntry } from './command-palette-entries';
import { navigateToEntry, searchEntries } from './command-palette-match';

/**
 * Global ⌘K / Ctrl+K search: jump to any route in this app or to any of the
 * other Taliferro apps. Self-contained (own keybinding, overlay, and result
 * list) so it can just be dropped into an app's root component.
 */
@Component( {
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './command-palette.component.html',
  styleUrl: './command-palette.component.css'
} )
export class CommandPaletteComponent {
  isOpen = false;
  query = '';
  results: CommandPaletteEntry[] = [];
  activeIndex = 0;

  @ViewChild( 'paletteInput' ) private inputRef?: ElementRef<HTMLInputElement>;

  constructor ( private router: Router ) {
    this.results = searchEntries( '' );
  }

  @HostListener( 'document:keydown', ['$event'] )
  onKeydown ( event: KeyboardEvent ): void {
    const key = event.key.toLowerCase();

    if ( ( event.metaKey || event.ctrlKey ) && key === 'k' ) {
      event.preventDefault();
      this.isOpen ? this.close() : this.open();
      return;
    }

    if ( !this.isOpen ) return;

    if ( key === 'escape' ) {
      event.preventDefault();
      this.close();
    } else if ( key === 'arrowdown' ) {
      event.preventDefault();
      this.activeIndex = Math.min( this.activeIndex + 1, this.results.length - 1 );
    } else if ( key === 'arrowup' ) {
      event.preventDefault();
      this.activeIndex = Math.max( this.activeIndex - 1, 0 );
    } else if ( key === 'enter' ) {
      event.preventDefault();
      this.selectActive();
    }
  }

  open (): void {
    this.isOpen = true;
    this.query = '';
    this.activeIndex = 0;
    this.results = searchEntries( '' );
    setTimeout( () => this.inputRef?.nativeElement.focus(), 0 );
  }

  close (): void {
    this.isOpen = false;
  }

  onQueryChange (): void {
    this.activeIndex = 0;
    this.results = searchEntries( this.query );
  }

  selectActive (): void {
    const entry = this.results[this.activeIndex];
    if ( entry ) this.select( entry );
  }

  select ( entry: CommandPaletteEntry ): void {
    this.close();
    navigateToEntry( this.router, entry );
  }
}
