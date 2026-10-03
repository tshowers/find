import { MenuAppConfig } from '@taliferro/ui/platform/universal-menu.model';

/** Find's part of the universal menu. */
export const PLATFORM_MENU_CONFIG: MenuAppConfig = {
  app: 'find',
  name: 'Find',
  logo: 'assets/find/entities/find/logo.png',
  items: [
    { label: 'Search', icon: 'search', route: '/' },
  ],
  secondaryItems: [
    { label: 'Help', icon: 'help', route: '/help' },
    { label: 'About', icon: 'info', route: '/about' },
  ],
};
