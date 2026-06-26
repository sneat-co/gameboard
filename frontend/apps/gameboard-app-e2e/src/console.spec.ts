import { expect, test } from '@playwright/test';
import {
  createGame,
  driveFullGameViaConsole,
  FULL_GAME_FOLD,
  getState,
} from './lifecycle';

// CHAIN GATE — Slice 3 (core drive): the full-game lifecycle, driven through the
// REAL operator console UI and reflected by the public scoreboard.
//
// This is the salvaged legacy `full-game.spec.ts` reborn on the rebuilt stack:
// browser UI (Ionic console) → api4gameboard HTTP → gameboardd → dalgo →
// event-timeline fold → public scoreboard read. NO `page.route` / api4gameboard
// mocking — every control click is a real append to the Firestore emulator.
//
// Assumptions logged (as required by the brief):
//   1. gameboardd's devIdentity authorizes all writes without a Firebase token,
//      so the console route — intentionally NOT auth-guarded (decision 5) — is
//      reachable and drivable by this anonymous E2E session.
//   2. The Angular app is served at baseHref `/app/`, so the console is at
//      `/app/g/<gameID>/console` and the public board at `/app/g/<gameID>`.
//   3. A playerOn-only substitution adds the id to onCourt (confirmed in
//      Slice 2 from the backend journey test).
//   4. Console controls append-then-refresh; Playwright's auto-retrying
//      assertions + the 2 s poll absorb any in-flight append ordering.
//
// Decision 1 (board == fold): the public scoreboard is asserted to equal exactly
// what `GET /state` reports — no drift between the console and the board.

test('real-stack: console drives a whole game and the public board reflects the fold', async ({
  page,
  request,
}) => {
  // 1. Create a game through the real chain.
  const { gameID } = await createGame(
    request,
    { name: 'Hawks', colour: '#ff0000' },
    { name: 'Bears', colour: '#0000ff' },
  );

  // 2. Drive the full lifecycle through the REAL console UI (asserts the
  //    on-surface scoreboard reflects each step as it goes).
  await driveFullGameViaConsole(page, gameID);

  // 3. Confirm the deterministic fold at the API layer (the board must equal it).
  const fold = await getState(request, gameID);
  expect(fold.scores['home'], 'fold home score').toBe(FULL_GAME_FOLD.scoreHome);
  expect(fold.scores['away'], 'fold away score').toBe(FULL_GAME_FOLD.scoreAway);
  expect(fold.teamFouls['away'], 'fold away fouls').toBe(
    FULL_GAME_FOLD.awayFouls,
  );
  expect(fold.possession, 'fold possession').toBe(FULL_GAME_FOLD.possession);
  expect(fold.status, 'fold status').toBe(FULL_GAME_FOLD.status);
  // attributed score: p1 scored (incl. its +2), p2 credited the assist.
  expect(fold.playerPoints['p1'], 'p1 points').toBeGreaterThanOrEqual(2);
  expect(fold.playerAssists['p2'], 'p2 assists').toBeGreaterThanOrEqual(1);
  expect(fold.onCourt['home'], 'fold oncourt home').toContain('p1');
  expect(fold.onCourt['home'], 'fold oncourt home').toContain('p2');

  // 4. The PUBLIC scoreboard equals the fold (decision 1). Navigate to the
  //    read-only board — NO mocking.
  await page.goto(`/app/g/${gameID}`);
  await expect(page.getByTestId('score-home')).toHaveText(
    String(FULL_GAME_FOLD.scoreHome),
  );
  await expect(page.getByTestId('score-away')).toHaveText(
    String(FULL_GAME_FOLD.scoreAway),
  );
  await expect(page.getByTestId('status')).toHaveText('final');
  await expect(page.getByTestId('home-bonus')).toBeVisible();
  await expect(page.getByTestId('possession')).toHaveText('away');

  // 5. board == fold survives a reload (fresh state from the API).
  await page.reload();
  await expect(page.getByTestId('score-home')).toHaveText(
    String(FULL_GAME_FOLD.scoreHome),
  );
  await expect(page.getByTestId('score-away')).toHaveText(
    String(FULL_GAME_FOLD.scoreAway),
  );
  await expect(page.getByTestId('status')).toHaveText('final');
  await expect(page.getByTestId('home-bonus')).toBeVisible();

  // 6. Minor-safe on-court labels on the public board (decision 7).
  const onCourt = page.getByTestId('oncourt-home');
  await expect(onCourt).toContainText('#23'); // p2 = no-consent minor → jersey
  await expect(onCourt).not.toContainText('Jordan Minor');
  await expect(onCourt).toContainText('Alex Adult'); // p1 = adult → name
});
