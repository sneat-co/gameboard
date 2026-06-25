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

test('space-scoped lists route loads without crashing', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  // Lazy-loads the template space shell + lists route. Unauthenticated, this
  // redirects to login; the assertion is that the app handles it without throwing.
  await page.goto('/space/family/smoke-test-space/lists');

  await expect(page.locator('gameboard-root')).toBeAttached();

  expect(pageErrors, `uncaught page errors:\n${pageErrors.join('\n')}`).toEqual(
    [],
  );
});
