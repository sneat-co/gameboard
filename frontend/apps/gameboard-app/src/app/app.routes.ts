import { Route } from '@angular/router';
import { AuthGuard } from '@angular/fire/auth-guard';
import { redirectToLoginIfNotSignedIn } from '@sneat/auth-core';

export const appRoutes: Route[] = [
  {
    // Public landing. Anonymous-friendly: shows a New game CTA and cross-promo
    // cards to the wider Sneat ecosystem; signed-in users additionally see their
    // spaces. NOT auth-guarded so a first-time visitor lands here with zero
    // friction (mirrors the anon-first new-game flow).
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./home/gameboard-home-page.component').then(
        (m) => m.GameboardHomePageComponent,
      ),
  },
  {
    // New game — the on-ramp to a GameBoard.live game.
    // Anonymous-first (anon-first-new-game Feature): intentionally NOT
    // auth-guarded so a first-time/anonymous visitor can fill the form with zero
    // friction. Sign-in is offered in-page at any moment, and persisting the
    // game to the backend still requires an explicit authenticated action
    // (handled inside NewGamePageComponent).
    path: 'new-game',
    loadComponent: () =>
      import('./new-game/new-game-page.component').then(
        (m) => m.NewGamePageComponent,
      ),
    data: { title: 'New game' },
  },
  {
    // Space-scoped routes host the template pages, mirroring sneat-app's
    // space/:spaceType/:spaceID mount point.
    path: 'space/:spaceType/:spaceID',
    loadChildren: () =>
      import('./space/gameboard-space.routes').then((m) => m.templateSpaceRoutes),
  },
  {
    // sneat-auth-menu-item navigates here on sign-out; mirror sneat-app and
    // redirect to the login page (where the sign-in form is shown).
    path: 'signed-out',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    // User profile (linked auth accounts, country). Linked from the side menu's
    // sneat-auth-menu-item "signed in as" row. Guarded like the home page.
    path: 'my',
    loadComponent: () =>
      import('./my/my-profile-page.component').then(
        (m) => m.MyProfilePageComponent,
      ),
    canActivate: [AuthGuard],
    data: { title: 'My profile', authGuardPipe: () => redirectToLoginIfNotSignedIn },
  },
];
