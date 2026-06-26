import { expect, test } from '@playwright/test';
import { createGame, getState, seedRecapGame } from './lifecycle';

// CHAIN GATE — Slice 4: post-game recap segment of the real-stack E2E chain.
//
// Drives the REAL stack — no page.route / api4gameboard mocking. Seeds a game
// with attributed score events (scorerID=p1, assistID=p2) through gameboardd →
// Firestore emulator, takes it to final, then navigates the browser to
// `/app/g/<gameID>/recap` and asserts the rendered box score equals the fold.
//
// Assumptions logged (as required by the brief):
//   1. Attributed `score` events with `scorerID` and `assistID` populate
//      `playerPoints` and `playerAssists` in the server fold (confirmed
//      empirically: the backend's scoreboard.go foldEvent adds scorerID to
//      playerPoints and assistID to playerAssists on each score event).
//   2. The `recap` route is at `/app/g/<gameID>/recap` (public, no guard —
//      decision 5). The Angular app baseHref is `/app/`.
//   3. The poll interval is 2 s; Playwright's default assertion timeout (5 s)
//      covers the first refresh cycle even if navigate resolves before the first
//      poll fires.
//   4. p1 is an adult (Alex Adult) — shown by name. p2 is a no-consent minor
//      (#23 Jordan Minor) — shown by jersey only, NEVER by name (decision 7).
//   5. Box-score sort: points desc, then label asc (mirrors legacy boxScore()).
//   6. Score-by-period and per-player minutes are omitted from the recap page
//      because they do not exist in the current GameState contract.
//
// Decision 1 (board == fold): the recap box-score text equals the fold's
// playerPoints/playerAssists — no drift.

test('real-stack: recap renders box score from attributed scoring, minor-safe', async ({
  page,
  request,
}) => {
  // 1. Create a fresh game through the real chain.
  const { gameID } = await createGame(
    request,
    { name: 'Hawks', colour: '#ff0000' },
    { name: 'Bears', colour: '#0000ff' },
  );

  // 2. Seed attributed scoring and take the game to final — all real appends,
  //    no mocking. Two home +2 events (scorerID=p1, assistID=p2) → p1=4pts, p2=2ast.
  await seedRecapGame(request, gameID);

  // 3. Confirm the fold at the API layer before driving the browser.
  //    Proves the chain: append → fold → GET /state reflects attributed scoring.
  const fold = await getState(request, gameID);
  expect(fold.status, 'fold status').toBe('final');
  expect(fold.playerPoints['p1'], 'fold p1 points (4 = 2×+2 attributed)').toBe(
    4,
  );
  expect(fold.playerAssists['p2'], 'fold p2 assists (2 = 2×assist)').toBe(2);

  // 4. Navigate the browser to the public recap page — NO page.route mocking.
  await page.goto(`/app/g/${gameID}/recap`);

  // 5. Assert box-score == fold (decision 1, minor-safe — decision 7).
  const recap = page.getByTestId('recap');
  await expect(recap).toBeVisible();

  // p1 = adult "Alex Adult" — shown by name with 4 pts.
  await expect(recap).toContainText('Alex Adult: 4 pts');

  // p2 = no-consent minor — shown by jersey #23, never by name.
  await expect(recap).toContainText('#23: 0 pts, 2 ast');
  await expect(recap).not.toContainText('Jordan Minor');

  // 6. Verify the individual recap-line testids are present.
  const lines = page.getByTestId('recap-line');
  await expect(lines).toHaveCount(2); // only p1 and p2 in the fold

  // 7. Final score is rendered.
  await expect(page.getByTestId('score-home')).toHaveText('4');
  await expect(page.getByTestId('score-away')).toHaveText('0');
  await expect(page.getByTestId('status')).toHaveText('final');
});
