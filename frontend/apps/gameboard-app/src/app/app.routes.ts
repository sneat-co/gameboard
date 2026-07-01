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
    // Organize a basketball game — `/game-invites/new` — the on-ramp to the
    // organize→invite-roster→parent-RSVP→roster-fill loop (basketball game
    // invites MVP). Anonymous-first like new-game/chess: no auth guard, the
    // whole feature is localStorage-backed today (game-invite-store.ts).
    // Declared before `game-invites/:gameId` below so this literal segment
    // isn't shadowed.
    path: 'game-invites/new',
    loadComponent: () =>
      import('./game-invites/organize-game-page.component').then(
        (m) => m.OrganizeGamePageComponent,
      ),
    data: { title: 'Organize a game' },
  },
  {
    // The anon-first parent-proxy RSVP page — `/game-invites/rsvp/:token`.
    // This is the invite link a coach copies from the roster console; it MUST
    // stay reachable and functional without a signed-in session (a parent
    // opening it cold is the whole point). Declared before
    // `game-invites/:gameId` so the literal `rsvp` segment isn't shadowed.
    path: 'game-invites/rsvp/:token',
    loadComponent: () =>
      import('./game-invites/rsvp-page.component').then(
        (m) => m.RsvpPageComponent,
      ),
    data: { title: 'Game invite' },
  },
  {
    // My organized games (game-invites feature) — `/game-invites`. Local-
    // storage-backed like the chess games list, so it needs no sign-in.
    path: 'game-invites',
    pathMatch: 'full',
    loadComponent: () =>
      import('./game-invites/game-invites-list-page.component').then(
        (m) => m.GameInvitesListPageComponent,
      ),
    data: { title: 'My rosters' },
  },
  {
    // Roster / coach console for one organized game — `/game-invites/:gameId`
    // — invite links, fill count, roster grouped by RSVP status.
    path: 'game-invites/:gameId',
    loadComponent: () =>
      import('./game-invites/roster-page.component').then(
        (m) => m.RosterPageComponent,
      ),
    data: { title: 'Roster' },
  },
  {
    // Chess hub — `/chess`. The chess MVP's on-ramp: pick pass-and-play,
    // vs-computer, or OTB clock+record, a time control, and start. Like
    // new-game, anonymous-friendly — no auth required to play; games are
    // saved locally regardless of sign-in (see chess-game-store.ts).
    path: 'chess',
    loadComponent: () =>
      import('./chess/chess-hub-page.component').then(
        (m) => m.ChessHubPageComponent,
      ),
    data: { title: 'Chess' },
  },
  {
    // Saved chess games list — `/chess/games`. Declared before the `:gameId`
    // route below so the literal `games` segment isn't shadowed.
    path: 'chess/games',
    loadComponent: () =>
      import('./chess/chess-games-list-page.component').then(
        (m) => m.ChessGamesListPageComponent,
      ),
    data: { title: 'Chess games' },
  },
  {
    // The live/recap play surface for one chess game — `/chess/play/:gameId`.
    path: 'chess/play/:gameId',
    loadComponent: () =>
      import('./chess/chess-play-page.component').then(
        (m) => m.ChessPlayPageComponent,
      ),
    data: { title: 'Chess' },
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
