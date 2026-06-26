import { test, expect } from '@playwright/test';

// anon-first-new-game#ac:anonymous-create-routes-through-signin: an anonymous
// user who triggers "Create game" is routed through sign-in first and NO game
// is written to the backend until they are authenticated.
//
// Note on #ac:authenticated-create-persists: persisting the game requires a real
// signed-in Firebase session, which the e2e harness deliberately does not set up
// (see smoke.spec.ts). That AC is exercised by the component's create() logic and
// verified manually / with a seeded session; here we assert the anonymous path
// makes no backend write.

test('anonymous "Create game" routes through sign-in and writes nothing', async ({
  page,
}) => {
  let gamesPosted = 0;
  await page.route('**/api4gameboard/games', (route) => {
    gamesPosted++;
    return route.abort();
  });

  await page.goto('/app/new-game');
  await expect(page.locator('gameboard-new-game-page')).toBeVisible({
    timeout: 20_000,
  });

  // Step 1 — pick a sport; the rest of the form stays hidden until one is chosen.
  await page.getByRole('button', { name: /Basketball/ }).click();

  // Fill the required fields (two team names + at least one self-declared role)
  // so the form is valid and create proceeds to the auth gate.
  await page
    .locator('ion-input[label="Home team"] input')
    .fill('Limerick Celtics');
  await page.locator('ion-input[label="Away team"] input').fill('Ennis Tigers');
  await page.getByText('Coach', { exact: true }).click();

  const create = page.getByRole('button', { name: /Create game/ });
  await expect(create).toBeEnabled();
  await create.click();

  // Routed to the login page instead of creating the game.
  await page.waitForURL(/\/login/, { timeout: 20_000 });

  // No backend write happened on the anonymous path.
  expect(gamesPosted).toBe(0);
});
