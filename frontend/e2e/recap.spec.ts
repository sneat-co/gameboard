import { expect, test } from '@playwright/test';

// Master post-game-recap: the box score (points → assists) is the deterministic
// fold of attributed score events; p1 (adult #7) and p2 (no-consent minor #23)
// render minor-safe.
test('box score reflects attributed scoring, minor-safe', async ({ page }) => {
  const game = `e2e-recap-${Date.now()}`;
  await page.addInitScript((g) => {
    (window as unknown as { __GB_GAME__: string }).__GB_GAME__ = g;
  }, game);
  await page.goto('/');

  await page.getByTestId('go-live').click();
  await page.getByTestId('home-2-by-p1').click();
  await page.getByTestId('home-2-by-p1').click(); // p1: 4 pts, p2: 2 ast

  const recap = page.getByTestId('recap');
  await expect(recap).toContainText('Alex Adult: 4 pts'); // p1 (adult) by name
  await expect(recap).toContainText('#23: 0 pts, 2 ast'); // p2 (no-consent minor) by jersey
  await expect(recap).not.toContainText('Jordan Minor');
});
