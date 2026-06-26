import { test, expect } from '@playwright/test';

// anon-first-new-game#ac:draft-saved-on-change and #ac:draft-restored-on-load.
// An anonymous user can fill the form, and their input survives a full reload
// (the closest e2e proxy for the full-page redirect sign-in round-trip) because
// it is auto-saved to a single most-recent localStorage draft.

const DRAFT_KEY = 'gameboard.new-game.draft';

test('new-game form auto-saves a draft and restores it after reload', async ({
  page,
}) => {
  await page.goto('/app/new-game');
  await expect(page.locator('gameboard-new-game-page')).toBeVisible({
    timeout: 20_000,
  });

  // Step 1 — pick a sport to reveal the form (the pick is part of the draft).
  await page.getByRole('button', { name: /Basketball/ }).click();

  const home = page.locator('ion-input[label="Home team"] input');
  const away = page.locator('ion-input[label="Away team"] input');

  await home.fill('Limerick Celtics');
  await away.fill('Ennis Tigers');
  await away.blur();

  // The draft is written to localStorage without any explicit save action.
  await expect
    .poll(() => page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY), {
      timeout: 10_000,
    })
    .toContain('Limerick Celtics');

  // Reloading the route rehydrates the form from the saved draft.
  await page.reload();
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
