import { expect, test } from '@playwright/test';
import {
  createGame,
  driveFullGameViaConsole,
  FULL_GAME_FOLD,
  getGame,
  getState,
} from './lifecycle';

// ===========================================================================
// UMBRELLA — the full-game lifecycle E2E (MVP release gate).
// ===========================================================================
//
// The salvaged legacy `full-game.spec.ts` reborn on the rebuilt stack as the
// SINGLE canonical journey that replays the COMPLETE chain across EVERY screen,
// end-to-end, on the REAL stack:
//
//   browser UI (Ionic) → GameService/SneatApiService → api4gameboard HTTP →
//   gameboardd → dalgo → Firestore EMULATOR → deterministic event-fold →
//   read-side render
//
// ONE gameID flows through all five phases — create → console drive → public
// scoreboard → recap → follow — so this truly replays one lifecycle. There is
// NO `page.route` / api4gameboard mocking anywhere: every control click and
// read is a real round-trip through gameboardd to the Firestore emulator, and
// every public read is asserted to equal the deterministic fold (no drift).
//
// Reuse: this umbrella composes the existing lifecycle-helper segments
// (`createGame`, `getGame`, `getState`, `driveFullGameViaConsole`,
// `FULL_GAME_FOLD`) rather than duplicating any seeding logic. The console
// drive is the exact canonical journey ported from the legacy spec.
//
// Assumptions logged (per the brief):
//   1. gameboardd's devIdentity authorizes writes without a Firebase token, so
//      the console route (intentionally NOT auth-guarded — decision 5) is
//      reachable and drivable by this anonymous E2E session. The CREATE link is
//      driven via the lifecycle helper (real HTTP → gameboardd → emulator), not
//      the auth-gated new-game UI form (UI authenticated-create is deferred to
//      the Auth-emulator slice — see new-game-chain.spec.ts).
//   2. The Angular app is served at baseHref `/app/`: console at
//      `/app/g/<id>/console`, public board at `/app/g/<id>`, recap at
//      `/app/g/<id>/recap`.
//   3. Polling is 2 s; Playwright's auto-retrying assertions (5 s default)
//      absorb the first poll cycle and any in-flight append ordering.
//   4. Minor-safety (decision 7): the no-consent minor p2 renders as `#23`,
//      NEVER as "Jordan Minor"; the adult p1 ("Alex Adult") and consented minor
//      p3 ("Sam Consented") render by name.
//
// DEVIATION from the legacy 6–2 score (documented per brief): the rebuilt
// console adds an attributed `home-2-by-p1` control (points + assist), which the
// brief mandates including so the recap box score is populated. The canonical
// `driveFullGameViaConsole` helper (green since slice 3) therefore folds to
// home = +2 +3 +1(FT) +2(p1, assist p2) = 8, away = +2 = 2 (`FULL_GAME_FOLD`).
// Reusing the helper as-is (rather than regressing slice 3 to drop the
// attributed control) yields 8–2. All other salvaged assertions are preserved
// exactly: status final, home-bonus, possession away, and minor-safe #23.

test('UMBRELLA: full-game lifecycle across every screen on the real stack', async ({
  page,
  request,
}) => {
  // -------------------------------------------------------------------------
  // PHASE 1 — CREATE: a single game through the real chain → persisted in the
  // Firestore emulator. Its gameID keys every later screen (one lifecycle).
  // -------------------------------------------------------------------------
  const home = { name: 'Hawks', colour: '#ff0000' };
  const away = { name: 'Bears', colour: '#0000ff' };
  const { gameID } = await createGame(request, home, away);
  expect(gameID, 'created game must have a gameID').toBeTruthy();

  // Confirm the record round-trips from the emulator (no drift on persist).
  const record = await getGame(request, gameID);
  expect(record.gameID).toBe(gameID);
  expect(record.home.name).toBe(home.name);
  expect(record.away.name).toBe(away.name);
  expect(record.status).toBe('scheduled');

  // -------------------------------------------------------------------------
  // PHASE 2 — CONSOLE DRIVE (`/app/g/<id>/console`): drive the full lifecycle
  // through the REAL Ionic console UI — go-live → period 1 → clock start
  // (→ 10:00, running) → score home +2/+3/FT + attributed +2(p1) and away +2
  // → 5 away fouls (→ home bonus) → subs p1(adult)/p2(no-consent minor)/
  // p3(consented) → timeout → possession away → final. The helper asserts the
  // on-surface scoreboard reflects each key step (board == fold as it goes).
  // -------------------------------------------------------------------------
  await driveFullGameViaConsole(page, gameID);

  // -------------------------------------------------------------------------
  // PHASE 3 — PUBLIC SCOREBOARD (`/app/g/<id>`): assert board == fold.
  // -------------------------------------------------------------------------
  // First confirm the deterministic fold at the API layer; the public board
  // must equal exactly this.
  const fold = await getState(request, gameID);
  expect(fold.scores['home'], 'fold home score').toBe(FULL_GAME_FOLD.scoreHome);
  expect(fold.scores['away'], 'fold away score').toBe(FULL_GAME_FOLD.scoreAway);
  expect(fold.teamFouls['away'], 'fold away fouls → home bonus').toBe(
    FULL_GAME_FOLD.awayFouls,
  );
  expect(fold.possession, 'fold possession').toBe(FULL_GAME_FOLD.possession);
  expect(fold.status, 'fold status').toBe(FULL_GAME_FOLD.status);
  // Attributed scoring populated by the `home-2-by-p1` control.
  expect(fold.playerPoints['p1'], 'p1 attributed points').toBe(2);
  expect(fold.playerAssists['p2'], 'p2 attributed assist').toBe(1);
  expect(fold.onCourt['home'], 'fold oncourt home').toContain('p1');
  expect(fold.onCourt['home'], 'fold oncourt home').toContain('p2');

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

  // Minor-safe on-court labels on the public board (decision 7).
  const onCourt = page.getByTestId('oncourt-home');
  await expect(onCourt).toContainText('#23'); // p2 = no-consent minor → jersey
  await expect(onCourt).not.toContainText('Jordan Minor'); // name must NEVER appear
  await expect(onCourt).toContainText('Alex Adult'); // p1 = adult → name
  await expect(onCourt).toContainText('Sam Consented'); // p3 = consented minor → name

  // Public read equals the persisted fold after a reload (fresh API state, no drift).
  await page.reload();
  await expect(page.getByTestId('score-home')).toHaveText(
    String(FULL_GAME_FOLD.scoreHome),
  );
  await expect(page.getByTestId('score-away')).toHaveText(
    String(FULL_GAME_FOLD.scoreAway),
  );
  await expect(page.getByTestId('status')).toHaveText('final');
  await expect(page.getByTestId('home-bonus')).toBeVisible();
  await expect(page.getByTestId('possession')).toHaveText('away');

  // -------------------------------------------------------------------------
  // PHASE 4 — RECAP (`/app/g/<id>/recap`): box score reflects the attributed
  // scoring and is minor-safe — the adult by name with points; the no-consent
  // minor by `#23`, never the name.
  // -------------------------------------------------------------------------
  await page.goto(`/app/g/${gameID}/recap`);
  const recap = page.getByTestId('recap');
  await expect(recap).toBeVisible();

  // p1 = adult "Alex Adult" — shown by name with the attributed 2 pts.
  await expect(recap).toContainText('Alex Adult: 2 pts');
  // p2 = no-consent minor — shown by jersey #23 with the assist, never by name.
  await expect(recap).toContainText('#23: 0 pts, 1 ast');
  await expect(recap).not.toContainText('Jordan Minor');

  // Only p1 (points) and p2 (assist) appear in the fold's attribution.
  await expect(page.getByTestId('recap-line')).toHaveCount(2);

  // The final score is rendered on the recap too (board == fold).
  await expect(page.getByTestId('score-home')).toHaveText(
    String(FULL_GAME_FOLD.scoreHome),
  );
  await expect(page.getByTestId('score-away')).toHaveText(
    String(FULL_GAME_FOLD.scoreAway),
  );
  await expect(page.getByTestId('status')).toHaveText('final');

  // -------------------------------------------------------------------------
  // PHASE 5 — FOLLOW (on the public scoreboard): an anonymous follow is
  // rejected with 'account required' (real client-auth rejection — no mocking).
  // -------------------------------------------------------------------------
  await page.goto(`/app/g/${gameID}`);
  const followBtn = page.getByTestId('follow-home');
  await expect(followBtn).toBeVisible();
  await expect(page.getByTestId('follow-status')).toHaveText('');

  // SneatApiService.post throws a client-side "not authenticated" guard before
  // any network call when there is no Firebase session; followHome() catches it
  // → 'account required'. A REAL rejection, not a mocked response.
  await followBtn.click();
  await expect(page.getByTestId('follow-status')).toHaveText(
    'account required',
  );
});
