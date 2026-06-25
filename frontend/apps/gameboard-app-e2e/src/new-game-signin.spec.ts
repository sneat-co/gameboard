import { test, expect } from '@playwright/test';

// anon-first-new-game#ac:signin-affordance-visible and
// #ac:roundtrip-preserves-draft. An anonymous user is offered a non-blocking
// sign-in affordance and can keep editing without it; triggering sign-in routes
// through /login and returning to /new-game preserves the in-progress draft
// (persisted to localStorage in Task 2). Real Firebase auth is out of scope for
// e2e, so we exercise the loss-free round-trip via the /login route itself.

test('sign-in affordance is shown and does not block editing', async ({
  page,
}) => {
  await page.goto('/app/new-game');
  await expect(page.locator('gameboard-new-game-page')).toBeVisible({
    timeout: 20_000,
  });

  // Affordance present for an anonymous user.
  const signIn = page.getByRole('button', { name: 'Sign in' });
  await expect(signIn).toBeVisible();

  // The form is still fully editable without signing in.
  const home = page.locator('ion-input[label="Home team"] input');
  await home.fill('Limerick Celtics');
  await expect(home).toHaveValue('Limerick Celtics');
});

test('signing in mid-form returns to /new-game with the draft intact', async ({
  page,
}) => {
  await page.goto('/app/new-game');
  await expect(page.locator('gameboard-new-game-page')).toBeVisible({
    timeout: 20_000,
  });

  await page.locator('ion-input[label="Home team"] input').fill('Limerick Celtics');
  await page.locator('ion-input[label="Away team"] input').fill('Ennis Tigers');

  // Trigger sign-in: navigates to the login route with /new-game as the
  // post-login return target (URL hash).
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/login/, { timeout: 20_000 });

  // Return to /new-game (what the login page does after auth) — the draft
  // survives because it lives in localStorage.
  await page.goto('/app/new-game');
  await expect(page.locator('gameboard-new-game-page')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator('ion-input[label="Home team"] input')).toHaveValue(
    'Limerick Celtics',
  );
  await expect(page.locator('ion-input[label="Away team"] input')).toHaveValue(
    'Ennis Tigers',
  );
});
