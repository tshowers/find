import { Routes } from '@angular/router';
import { FindHomeComponent } from './find-home/find-home.component';

export const routes: Routes = [
  { path: '', component: FindHomeComponent },
  {
    path: 'help',
    loadComponent: () =>
      import( './help/help.component' ).then( ( m ) => m.HelpComponent ),
  },
  {
    path: 'about',
    loadComponent: () =>
      import( './about/about.component' ).then( ( m ) => m.AboutComponent ),
  },
];
