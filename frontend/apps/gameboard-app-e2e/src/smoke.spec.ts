import { test, expect } from '@playwright/test';

// Smoke scope (per decision): assert the app boots and routes resolve without
// crashing. Full "renders lists data" needs an authenticated session + seeded
// space (deferred), so an unauthenticated login redirect is the expected path.

test('app boots and redirects unauthenticated user to login', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/');

  // Angular bootstrapped and rendered the app shell.
  await expect(page.locator('gameboard-root')).toBeAttached();

  // Bootstrap + router + auth all work: root redirects to the login route.
  await page.waitForURL(/login/, { timeout: 20_000 });

  expect(pageErrors, `uncaught page errors:\n${pageErrors.join('\n')}`).toEqual(
    [],
  );
});

test('new-game route resolves and is account-gated (redirects to login)', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  // /new-game is the gameboard on-ramp; it is account-gated (AuthGuard +
  // redirectToLoginIfNotSignedIn). Unauthenticated, it must resolve and redirect
  // to login without throwing — the smoke for a real gameboard route.
  await page.goto('/new-game');

  await expect(page.locator('gameboard-root')).toBeAttached();
  await page.waitForURL(/login/, { timeout: 20_000 });

  expect(pageErrors, `uncaught page errors:\n${pageErrors.join('\n')}`).toEqual(
    [],
  );
});
