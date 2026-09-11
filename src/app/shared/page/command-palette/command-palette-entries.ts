export interface CommandPaletteEntry {
  id: string;
  label: string;
  group: string;
  /** Internal route (starts with '/') or a full https:// URL to another app. */
  path: string;
  queryParams?: Record<string, string>;
  keywords: string[];
  /** Path to an icon image, relative to /assets. Omit for a label-only row. */
  icon?: string;
  /** True when `path` is a full URL to another app rather than an internal route. */
  external?: boolean;
  /** External entries only: open in a new tab instead of the current one. */
  newTab?: boolean;
}

export const COMMAND_PALETTE_ENTRIES: CommandPaletteEntry[] = [
  // --- Find (this app) -----------------------------------------------------
  { id: 'find-home', label: 'Find', group: 'Find', path: '/', keywords: ['find', 'home', 'ask a question'] },

  // --- Other Apps -----------------------------------------------------------
  { id: 'app-maya', label: 'Maya', group: 'Other Apps', path: 'https://maya.taliferro.tech', icon: 'assets/find/entities/maya/logo-bw.png', external: true, keywords: ['maya', 'marketing director'] },
  { id: 'app-todd', label: 'Ask TODD', group: 'Other Apps', path: 'https://ask.taliferro.tech', icon: 'assets/find/entities/todd/logo-bw-icon.png', external: true, keywords: ['todd', 'ask todd', 'assistant', 'chat'] },
  { id: 'app-docs', label: 'Docs', group: 'Other Apps', path: 'https://docs.taliferro.tech', icon: 'assets/find/entities/docs/logo-bw-icon.png', external: true, keywords: ['docs', 'documents', 'proposals', 'contracts'] },
  { id: 'app-signature', label: 'Email Signature Builder', group: 'Other Apps', path: 'https://signature.taliferro.tech', icon: 'assets/find/entities/email-signature-builder/logo-bw-icon.png', external: true, keywords: ['email signature', 'signature builder'] },
  { id: 'app-lead-vault', label: 'Lead Vault', group: 'Other Apps', path: 'https://lead-vault.taliferro.tech', icon: 'assets/find/entities/lead-vault/logo-bw-icon.png', external: true, keywords: ['lead vault', 'leads', 'purchased leads'] },
  { id: 'app-moves', label: 'Moves', group: 'Other Apps', path: 'https://moves.taliferro.tech', icon: 'assets/find/entities/moves/logo-bw-icon.png', external: true, keywords: ['moves', 'tasks', 'projects', 'to-dos'] },
  { id: 'app-network', label: 'Network', group: 'Other Apps', path: 'https://network.taliferro.tech', icon: 'assets/find/entities/network/logo-bw-icon.png', external: true, keywords: ['network', 'contacts', 'crm', 'relationships'] },
  { id: 'app-outreach', label: 'Outreach', group: 'Other Apps', path: 'https://outreach.taliferro.tech', icon: 'assets/find/entities/outreach/logo-bw-icon.png', external: true, keywords: ['outreach', 'campaigns', 'sequences', 'email marketing'] },
  { id: 'app-pulse', label: 'Pulse', group: 'Other Apps', path: 'https://pulse.taliferro.tech', icon: 'assets/find/entities/pulse/logo-bw-icon.png', external: true, keywords: ['pulse', 'surveys', 'feedback', 'nps'] },
  { id: 'app-sayit', label: 'SayIt', group: 'Other Apps', path: 'https://sayit.taliferro.tech', icon: 'assets/find/entities/sayit/logo-bw-icon.png', external: true, keywords: ['sayit', 'say it'] },
  { id: 'app-social', label: 'Social', group: 'Other Apps', path: 'https://social.taliferro.tech', icon: 'assets/find/entities/social/logo-bw-icon.png', external: true, keywords: ['social', 'social media'] },
  { id: 'app-music', label: 'Taliferro Music', group: 'Other Apps', path: 'https://music.taliferro.com', icon: 'assets/find/entities/music/logo-bw-icon.png', external: true, newTab: true, keywords: ['music', 'stream music'] },
];
