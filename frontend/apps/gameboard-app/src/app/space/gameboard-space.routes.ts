import { Route } from '@angular/router';
import {
  templateRoutes,
  GameboardSpaceMenuComponent,
} from '@sneat/extension-gameboard-shared';
import { SpaceComponentBaseParams } from '@sneat/space-components';

// Thin, gameboard-only space shell. It provides SpaceComponentBaseParams (which
// resolves the active space from the :spaceType/:spaceID route params) to all
// children, then mounts ONLY the template routes — unlike sneat-app's
// @sneat/space-pages, which bundles every extension. This keeps template.app
// decoupled while reusing the published @sneat/space-components context wiring.
export const templateSpaceRoutes: Route[] = [
  {
    path: '',
    providers: [SpaceComponentBaseParams],
    children: [
      {
        // gameboard-specific side menu (space selector + the space's lists) instead
        // of the generic SpaceMenuComponent, which hardcodes every sneat-app
        // extension (Assets, Budget, Contacts, …) — none of which exist here.
        path: '',
        component: GameboardSpaceMenuComponent,
        outlet: 'menu',
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'lists',
      },
      ...templateRoutes,
    ],
  },
];
