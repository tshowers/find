import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

interface ProductLink {
  label: string;
  url: string;
  icon: string;
}

/**
 * Find's product launcher. Find is a focused search experience, so its
 * global menu intentionally contains only links to the other Taliferro apps.
 */
@Component( {
  selector: 'app-platform-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './platform-menu.component.html',
  styleUrl: './platform-menu.component.css',
} )
export class PlatformMenuComponent {
  isOpen = false;

  readonly productLinks: ProductLink[] = [
    { label: 'Ask TODD', url: 'https://ask.taliferro.tech', icon: 'assets/find/entities/todd/logo-bw-icon.png' },
    { label: 'Network', url: 'https://network.taliferro.tech', icon: 'assets/find/entities/network/logo-bw-icon.png' },
    { label: 'Docs', url: 'https://docs.taliferro.tech', icon: 'assets/find/entities/docs/logo-bw-icon.png' },
    { label: 'Moves', url: 'https://moves.taliferro.tech', icon: 'assets/find/entities/moves/logo-bw-icon.png' },
    { label: 'Pulse', url: 'https://pulse.taliferro.tech', icon: 'assets/find/entities/pulse/logo-bw-icon.png' },
    { label: 'Social', url: 'https://social.taliferro.tech', icon: 'assets/find/entities/social/logo-bw-icon.png' },
    { label: 'Lead Vault', url: 'https://lead-vault.taliferro.tech', icon: 'assets/find/entities/lead-vault/logo-bw-icon.png' },
    { label: 'Maya', url: 'https://maya.taliferro.tech', icon: 'assets/find/entities/maya/logo-bw.png' },
    { label: 'SayIt', url: 'https://sayit.taliferro.tech', icon: 'assets/find/entities/sayit/logo-bw-icon.png' },
    { label: 'Find', url: 'https://find.taliferro.tech', icon: 'assets/find/entities/find/logo-bw-icon.png' },
    { label: 'Email Signature', url: 'https://signature.taliferro.tech', icon: 'assets/find/entities/email-signature-builder/logo-bw-icon.png' },
    { label: 'Music', url: 'https://music.taliferro.com', icon: 'assets/find/entities/music/logo-bw-icon.png' },
  ];

  toggle (): void {
    this.isOpen = !this.isOpen;
  }

  close (): void {
    this.isOpen = false;
  }
}
