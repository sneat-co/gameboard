import { expect, test } from '@playwright/test';
import { createGame, getState, seedScoredGame } from './lifecycle';

// CHAIN GATE — Slice 2: public scoreboard segment of the real-stack E2E chain.
//
// Assumptions logged (as required by the brief):
//   1. The devIdentity accepts all writes without a real Firebase token, so
//      `seedScoredGame` appends directly without Authorization headers.
//   2. The fold populates `onCourt[side]` by adding `playerOn` IDs from
//      substitution events (confirmed from journey_test.go in the backend).
//      A playerOn-only sub (no playerOff) simply adds the id to onCourt.
//   3. The Angular app is served at baseHref `/app/`, so scoreboard is at
//      `/app/g/<gameID>` (the `/app/` prefix is part of the Playwright
//      baseURL-relative path since gameboardd's FileServer maps `/app/*` →
//      the built SPA).
//   4. Polling interval is 2 s; Playwright's default assertion timeout (5 s)
//      covers the first poll cycle even if the initial navigate resolves
//      before the first poll fires.
//
// Decision 1 (board == fold): the rendered scores/possession/bonus/onCourt
// are asserted to equal exactly what `GET /state` reports — no drift.

test('real-stack: scoreboard renders the fold after seeding events', async ({
  page,
  request,
}) => {
  // 1. Create a game through the real chain.
  const game = await createGame(
    request,
    { name: 'Hawks', colour: '#ff0000' },
    { name: 'Bears', colour: '#0000ff' },
  );
  const { gameID } = game;

  // 2. Seed the canonical scored-game state through the real chain.
  //    No page.route / mocking — every append hits gameboardd → Firestore emulator.
  await seedScoredGame(request, gameID);

  // 3. Confirm the fold via GET /state before driving the browser
  //    (verifies the chain end-to-end at the API layer first).
  const fold = await getState(request, gameID);
  expect(fold.scores['home'], 'fold home score').toBe(6);
  expect(fold.scores['away'], 'fold away score').toBe(2);
  expect(fold.teamFouls['away'], 'fold away fouls').toBe(5);
  expect(fold.possession, 'fold possession').toBe('away');
  expect(fold.onCourt['home'], 'fold oncourt home').toContain('p1');
  expect(fold.onCourt['home'], 'fold oncourt home').toContain('p2');

  // 4. Navigate the browser to the public scoreboard — NO page.route mocking.
  await page.goto(`/app/g/${gameID}`);

  // 5. Assert board == fold (decision 1).
  await expect(page.getByTestId('score-home')).toHaveText('6');
  await expect(page.getByTestId('score-away')).toHaveText('2');
  await expect(page.getByTestId('status')).toHaveText('live');
  await expect(page.getByTestId('period')).toHaveText('1');
  await expect(page.getByTestId('clock')).toHaveText('9:00');
  // clock is stopped after the stop event
  await expect(page.getByTestId('clock-running')).toHaveText('⏸');
  await expect(page.getByTestId('home-bonus')).toBeVisible();
  await expect(page.getByTestId('possession')).toHaveText('away');

  // 6. Minor-safe on-court labels (decision 7).
  const onCourt = page.getByTestId('oncourt-home');
  await expect(onCourt).toContainText('#23'); // p2 = no-consent minor → jersey
  await expect(onCourt).not.toContainText('Jordan Minor'); // name must NOT appear
  await expect(onCourt).toContainText('Alex Adult'); // p1 = adult → name
});

test('real-stack: scoreboard big-screen layout renders when display=big', async ({
  page,
  request,
}) => {
  // Create a minimal game; no events needed — we just need the route to resolve.
  const game = await createGame(
    request,
    { name: 'Tigers', colour: '#ff6600' },
    { name: 'Lions', colour: '#0066ff' },
  );
  const { gameID } = game;

  await page.goto(`/app/g/${gameID}?display=big`);

  // The scoreboard container must exist and carry the .big CSS class.
  const scoreboard = page.getByTestId('scoreboard');
  await expect(scoreboard).toBeVisible();
  await expect(scoreboard).toHaveClass(/big/);
});
