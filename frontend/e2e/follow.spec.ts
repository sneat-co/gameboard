import { expect, test } from '@playwright/test';

// Master Task 4 (account-gated follow): an anonymous viewer can read/share but
// cannot follow; signing in writes a follow edge. Driven through the browser.
test('follow is account-gated: anonymous blocked, signed-in succeeds', async ({ page }) => {
  const game = `e2e-follow-${Date.now()}`;
  await page.addInitScript((g) => {
    (window as unknown as { __GB_GAME__: string }).__GB_GAME__ = g;
  }, game);
  await page.goto('/');

  // anonymous (no account id) → blocked
  await page.getByTestId('follow-home').click();
  await expect(page.getByTestId('follow-status')).toHaveText('account required');

  // sign in (provide an account id) → follow succeeds
  await page.getByTestId('account-id').fill('acc-42');
  await page.getByTestId('follow-home').click();
  await expect(page.getByTestId('follow-status')).toHaveText('following');
});
