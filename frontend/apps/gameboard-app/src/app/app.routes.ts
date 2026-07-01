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
    // Public scoreboard — the read-only game display for spectators and display
    // boards. Intentionally NOT auth-guarded (decision 5: public/no-login).
    // `?display=big` enables the dark "scoreboard moment" layout (tokens
    // --gb-score-bg / --gb-clock / --gb-font-score).
    path: 'g/:gameID',
    loadComponent: () =>
      import('./game/scoreboard/scoreboard-page.component').then(
        (m) => m.ScoreboardPageComponent,
      ),
    data: { title: 'Scoreboard' },
  },
  {
    // Public post-game recap — `g/:gameID/recap`.
    // Intentionally NOT auth-guarded (decision 5: public/no-login).
    // Renders the final score + minor-safe box score (points → assists) from
    // the deterministic fold. Score-by-period and per-player minutes are
    // deferred — those fields do not exist in the current GameState contract.
    path: 'g/:gameID/recap',
    loadComponent: () =>
      import('./game/recap/recap-page.component').then(
        (m) => m.RecapPageComponent,
      ),
    data: { title: 'Recap' },
  },
  {
    // Operator console (timekeeper + scorekeeper) — `g/:gameID/console`.
    // Intentionally NOT auth-guarded (decision 5): gameboardd's devIdentity
    // authorizes writes, so the console must be reachable and functional
    // WITHOUT a real signed-in session for the real-stack E2E to drive the full
    // lifecycle (an AuthGuard redirecting anonymous users to /login would break
    // the chain). No role-gating UI; any future sign-in affordance stays
    // non-blocking like new-game. Authenticated-write fidelity is a
    // prod/sneat-go concern.
    path: 'g/:gameID/console',
    loadComponent: () =>
      import('./game/console/console-page.component').then(
        (m) => m.ConsolePageComponent,
      ),
    data: { title: 'Console' },
  },
  {
    // Game settings — `g/:gameID/settings`. The organizer lands here after
    // creating a game to finish setup (schedule, venue; crew later).
    // Auth-guarded (sign-in required); write authorization is backend-enforced
    // (creator-only, 403 otherwise).
    path: 'g/:gameID/settings',
    loadComponent: () =>
      import('./game/settings/game-settings-page.component').then(
        (m) => m.GameSettingsPageComponent,
      ),
    canActivate: [AuthGuard],
    data: {
      title: 'Game settings',
      authGuardPipe: () => redirectToLoginIfNotSignedIn,
    },
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
      import('./space/gameboard-space.routes').then(
        (m) => m.templateSpaceRoutes,
      ),
  },
  {
    // sneat-auth-menu-item navigates here on sign-out; mirror sneat-app and
    // redirect to the login page (where the sign-in form is shown).
    path: 'signed-out',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    // My games — `my/games`. The signed-in user's list of games they created,
    // read directly from Firestore (createdBy == uid; the backend has no list
    // endpoint). The landing "Sign in" link returns here after login, and it
    // links onward to new-game (create) and each game's settings (manage).
    // Auth-guarded; declared before `my` so it isn't shadowed.
    path: 'my/games',
    loadComponent: () =>
      import('./my/games/my-games-page.component').then(
        (m) => m.MyGamesPageComponent,
      ),
    canActivate: [AuthGuard],
    data: {
      title: 'My games',
      authGuardPipe: () => redirectToLoginIfNotSignedIn,
    },
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
    data: {
      title: 'My profile',
      authGuardPipe: () => redirectToLoginIfNotSignedIn,
    },
  },
];
