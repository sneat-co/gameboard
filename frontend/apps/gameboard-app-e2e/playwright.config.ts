import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * REAL-STACK harness (no HTTP mocking): the webServer builds the SPA and serves
 * it SAME-ORIGIN from the real Go backend `gameboardd`, which persists to the
 * Firestore EMULATOR. So a game E2E drives the full span:
 *
 *   browser UI → GameService/SneatApiService → gameboardd → dalgo
 *              → Firestore emulator → fold → GET /state
 *
 * FIRESTORE_EMULATOR_HOST is injected into this process' env by
 * `firebase emulators:exec --only firestore --project demo-gameboard '…'`
 * (see .github/workflows/ci.yml and the local run command in the slice brief);
 * gameboardd's newStore() reads it and wires the Firestore-backed dalgo DB.
 *
 * Same-origin static mapping (replaces the old Caddy server): the app is built
 * with baseHref `/app/`, so it requests assets under `/app/…`. gameboardd's
 * FileServer serves GAMEBOARD_STATIC_DIR at `/` and history-falls-back unknown
 * non-API paths to `<root>/index.html`. We therefore lay out a small static
 * root:
 *
 *   <dist>/e2e-static/app   -> symlink to the built `browser/` dir  (/app/* assets)
 *   <dist>/e2e-static/index.html -> copy of browser/index.html      (deep-link SPA fallback)
 *
 * so `/app/`, `/app/<asset>` and deep links like `/app/g/<id>` all resolve to
 * the app shell with correct asset content-types, same-origin with the API.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  webServer: {
    command:
      'pnpm exec nx build gameboard-app' +
      ' && rm -rf dist/apps/gameboard-app/e2e-static' +
      ' && mkdir -p dist/apps/gameboard-app/e2e-static' +
      ' && ln -s ../browser dist/apps/gameboard-app/e2e-static/app' +
      ' && cp dist/apps/gameboard-app/browser/index.html dist/apps/gameboard-app/e2e-static/index.html' +
      ' && GAMEBOARD_ADDR=:4200' +
      ' GAMEBOARD_STATIC_DIR="$PWD/dist/apps/gameboard-app/e2e-static"' +
      ' go -C ../backend run ./cmd/gameboardd',
    // gameboardd answers /health as soon as it is listening.
    url: 'http://localhost:4200/health',
    reuseExistingServer: true,
    cwd: workspaceRoot,
    stdout: 'pipe',
    stderr: 'pipe',
    // Cold CI builds the SPA and compiles gameboardd (incl. Firestore deps) first.
    timeout: 240_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Uncomment for mobile browsers support
    /* {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    }, */

    // Uncomment for branded browsers
    /* {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    } */
  ],
});
