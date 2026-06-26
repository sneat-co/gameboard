import { test, expect } from '@playwright/test';

// Smoke scope (per decision): assert the app boots and routes resolve without
// crashing.
//
// The app is served under the `/app` prefix (baseHref `/app/`) same-origin by
// gameboardd with SPA history fallback — see playwright.config.ts. That mirrors
// the production Cloudflare Worker, so deep links below get the app shell
// instead of a 404.

test('app boots at /app/ and renders the public home for an anonymous user', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/app/');

  // Angular bootstrapped and rendered the app shell.
  await expect(page.locator('gameboard-root')).toBeAttached();

  // The home route '' is intentionally PUBLIC (anon-first): an anonymous visitor
  // lands on the home page with a New game CTA — NOT redirected to /login.
  // (The CTA is an <ion-button routerLink="/new-game">, which Ionic renders as a
  // link, so match it by element + text rather than the button role.)
  await expect(page.locator('gameboard-home-page')).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.locator('ion-button', { hasText: 'New game' }),
  ).toBeVisible();

  expect(pageErrors, `uncaught page errors:\n${pageErrors.join('\n')}`).toEqual(
    [],
  );
});

test('deep link /app/new-game renders the form for an anonymous user (no login redirect)', async ({
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

  // Anonymous-first (anon-first-new-game#ac:renders-while-signed-out): the route
  // is no longer auth-guarded, so an anonymous visitor sees the new-game form
  // itself rather than being redirected to /login.
  await expect(page.locator('gameboard-new-game-page')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page).toHaveURL(/\/new-game/);

  expect(pageErrors, `uncaught page errors:\n${pageErrors.join('\n')}`).toEqual(
    [],
  );
});
