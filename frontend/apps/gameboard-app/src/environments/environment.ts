import { appEnvironmentConfig } from '@sneat/app';
import { IEnvironmentConfig } from '@sneat/core';

// Single environment for template — fail-safe by construction. appEnvironmentConfig
// returns this production config on every deployed domain and the Firebase
// emulator config only on localhost (decided at runtime from the hostname). No
// environment.prod.ts / fileReplacements: a mis-built or mis-deployed bundle can
// never point real users at the emulator.
//
// Reuses the shared sneat production Firebase project (sneat-eur3-1) — template
// shares auth, spaces and Firestore with the rest of the sneat ecosystem.
export const gameboardAppEnvironmentConfig: IEnvironmentConfig =
  appEnvironmentConfig({
    production: true,
    agents: {},
    firebaseConfig: {
      projectId: 'sneat-eur3-1',
      appId: '1:588648831063:web:303af7e0c5f8a7b10d6b12',
      apiKey: 'AIzaSyCeQu1WC182yD0VHrRm4nHUxVf27fY-MLQ',
      // authDomain intentionally omitted: appEnvironmentConfig defaults it to the
      // current origin, so sign-in stays same-origin whether the app is served at
      // template.app, gameboard-app.web.app, or a preview channel. (template.app is a
      // Firebase Auth authorized domain serving /__/auth/handler.)
      messagingSenderId: '588648831063',
      measurementId: 'G-TYBDTV738R',
    },
    // Full-page redirect sign-in is the robust default for a freshly-deployed
    // domain. BaseAppComponent completes it via getRedirectResult().
    signInMethod: 'redirect',
  });
