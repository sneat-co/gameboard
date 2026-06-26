// Main entry point for template.app
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import {
  getStandardSneatProviders,
  isLocalhost,
  provideAppInfo,
  provideRolesByType,
} from '@sneat/app';
import { SneatApiBaseUrl } from '@sneat/api';
import type { SneatApp } from '@sneat/core';
import { authRoutes } from '@sneat/auth-ui';
import { provideGameboardInternal } from '@sneat/extension-gameboard-internal';
import { App } from './app/app';
import { appRoutes } from './app/app.routes';
import { gameboardAppEnvironmentConfig } from './environments/environment';
import { registerIonicons } from './register-ionicons';

bootstrapApplication(App, {
  providers: [
    ...getStandardSneatProviders(gameboardAppEnvironmentConfig),
    // gameboardd serves both the SPA and the api4gameboard API from the same
    // origin. Override the API base URL to same-origin `/v0/` on localhost so
    // the E2E browser (and local dev) hits the running gameboardd instead of
    // the generic sneat emulator host (https://local-api.sneat.ws/v0/).
    // In production (non-localhost) getStandardSneatProviders wins with the
    // production URL — this provider only overrides on localhost.
    ...(isLocalhost() ? [{ provide: SneatApiBaseUrl, useValue: '/v0/' }] : []),
    // Bind the template contract token (GAMEBOARD_SERVICE) to its concrete
    // implementation. The app is the composition root and may wire -internal.
    ...provideGameboardInternal(),
    // `as SneatApp`: the template's placeholder appId isn't in @sneat/core's
    // SneatApp union yet. Remove the cast once @sneat/core allows any string
    // (or once the renamed app's id is registered).
    provideAppInfo({
      appId: 'gameboard' as SneatApp,
      appTitle: 'GameBoard.live',
    }),
    provideRouter([...appRoutes, ...authRoutes]),
    provideRolesByType(undefined),
  ],
}).catch((err) => console.error(err));

registerIonicons();
