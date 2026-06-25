import { test, expect } from '@playwright/test';

// Smoke scope (per decision): assert the app boots and routes resolve without
// crashing. Full "renders authenticated data" needs a signed-in session +
// seeded space (deferred), so an unauthenticated redirect to /login is the
// expected, asserted path.
//
// The app is served under the `/app` prefix (baseHref `/app/`) by Caddy with
// SPA history fallback — see apps/gameboard-app-e2e/Caddyfile and
// playwright.config.ts. That mirrors the production Cloudflare Worker, so deep
// links below get the app shell instead of a 404.

test('app boots at /app/ and redirects unauthenticated user to login', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/app/');

  // Angular bootstrapped and rendered the app shell.
  await expect(page.locator('gameboard-root')).toBeAttached();

  // Bootstrap + router + auth all work: root redirects to the login route.
  await page.waitForURL(/login/, { timeout: 20_000 });

  expect(pageErrors, `uncaught page errors:\n${pageErrors.join('\n')}`).toEqual(
    [],
  );
});

test('deep link /app/new-game renders the shell and redirects to login (SPA fallback)', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  // Navigate DIRECTLY to a sub-route (not via in-app navigation). This only
  // works if the server history-falls-back to index.html so Angular's router
  // can take over — the behaviour the Caddy webServer provides.
  await page.goto('/app/new-game');

  // The shell attached on a deep link → SPA fallback served index.html.
  await expect(page.locator('gameboard-root')).toBeAttached();

  // new-game is account-gated (AuthGuard), so an anonymous deep link redirects
  // to login — proving the route resolved client-side, not 404'd by the server.
  await page.waitForURL(/login/, { timeout: 20_000 });

  expect(pageErrors, `uncaught page errors:\n${pageErrors.join('\n')}`).toEqual(
    [],
  );
});
