import { expect, test } from '@playwright/test';

// The umbrella full-lifecycle journey, driven through the real browser stack:
// UI → api4gameboard HTTP → gameboard/backend → dalgo → event-timeline fold →
// scoreboard read. Asserts the public scoreboard equals the deterministic fold
// of the appended events (no drift between the operator consoles and the board).
test('drives a whole game and the scoreboard reflects the fold', async ({ page }) => {
  const game = `e2e-${Date.now()}`;
  await page.addInitScript((g) => {
    (window as unknown as { __GB_GAME__: string }).__GB_GAME__ = g;
    (window as unknown as { __GB_API__: string }).__GB_API__ = '';
  }, game);
  await page.goto('/');

  // 1–2. tip-off: go live, period 1, start the clock
  await page.getByTestId('go-live').click();
  await expect(page.getByTestId('status')).toHaveText('live');
  await page.getByTestId('period-1').click();
  await expect(page.getByTestId('period')).toHaveText('1');
  await page.getByTestId('clock-start').click();
  await expect(page.getByTestId('clock-running')).toHaveText('▶');
  await expect(page.getByTestId('clock')).toHaveText('10:00');

  // 3. scoring: home +2, +3, FT (=6); away +2
  await page.getByTestId('home-2').click();
  await page.getByTestId('home-3').click();
  await page.getByTestId('home-ft').click();
  await page.getByTestId('away-2').click();
  await expect(page.getByTestId('score-home')).toHaveText('6');
  await expect(page.getByTestId('score-away')).toHaveText('2');

  // 4. fouls: away commits 5 → home bonus flips
  for (let i = 0; i < 5; i++) {
    await page.getByTestId('away-foul').click();
  }
  await expect(page.getByTestId('home-bonus')).toBeVisible();

  // 5–7. substitutions (p1 adult, p2 no-consent minor, p3 consented minor),
  // timeout, possession
  await page.getByTestId('sub-home').click();
  await page.getByTestId('sub-home').click();
  await page.getByTestId('sub-home').click();
  await page.getByTestId('timeout-home').click();
  await page.getByTestId('possession-away').click();
  await expect(page.getByTestId('possession')).toHaveText('away');

  // minor-safe public rendering: the no-consent minor (p2) shows by jersey only.
  const onCourt = page.getByTestId('oncourt-home');
  await expect(onCourt).toContainText('#23'); // Jordan Minor → jersey only
  await expect(onCourt).not.toContainText('Jordan Minor');
  await expect(onCourt).toContainText('Alex Adult'); // adult shows name
  await expect(onCourt).toContainText('Sam Consented'); // consented minor shows name

  // 8. final
  await page.getByTestId('final').click();
  await expect(page.getByTestId('status')).toHaveText('final');

  // The public read equals the fold: reload (fresh state from the API) and
  // confirm the board still shows the same totals.
  await page.reload();
  await expect(page.getByTestId('score-home')).toHaveText('6');
  await expect(page.getByTestId('score-away')).toHaveText('2');
  await expect(page.getByTestId('status')).toHaveText('final');
  await expect(page.getByTestId('home-bonus')).toBeVisible();
});
