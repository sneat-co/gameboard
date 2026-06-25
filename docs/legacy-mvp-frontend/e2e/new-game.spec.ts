import { expect, test } from '@playwright/test';

// Master Task 1 (scorer-creates-game): a volunteer organizer creates a game with
// two sides, then the table crew drives it — all through the real browser stack.
test('creates a game from the new-game form, then scores', async ({ page }) => {
  await page.goto('/'); // no __GB_GAME__ injected → the new-game form is shown
  await expect(page.getByTestId('new-game')).toBeVisible();

  await page.getByTestId('home-name').fill('Hawks');
  await page.getByTestId('away-name').fill('Foxes');
  await page.getByTestId('create-game').click();

  // the console + scoreboard replace the form once a game exists
  await expect(page.getByTestId('new-game')).toHaveCount(0);
  await expect(page.getByTestId('scoreboard')).toBeVisible();

  await page.getByTestId('go-live').click();
  await page.getByTestId('home-2').click();
  await expect(page.getByTestId('score-home')).toHaveText('2');
  await expect(page.getByTestId('status')).toHaveText('live');
});

// Master Task 3 (big-screen-mode): the TV/projector layout is selected by
// ?display=big and renders the same fold.
test('big-screen mode renders the scoreboard with the big layout', async ({ page }) => {
  const game = `e2e-big-${Date.now()}`;
  await page.addInitScript((g) => {
    (window as unknown as { __GB_GAME__: string }).__GB_GAME__ = g;
  }, game);
  await page.goto('/?display=big');
  await expect(page.getByTestId('scoreboard')).toHaveClass(/big/);
});
