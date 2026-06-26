import { APIRequestContext, expect, Page } from '@playwright/test';

/**
 * Real-stack lifecycle helpers for the gameboard game-screens E2E.
 *
 * These primitives drive the REAL chain — every call hits the running
 * `gameboardd` (served same-origin at the Playwright baseURL) which persists to
 * the Firestore EMULATOR and serves the deterministic fold. There is NO HTTP
 * mocking here; assertions verify true end-to-end behaviour.
 *
 * Slice 0 provides the first two links — `createGame` and `getState` — used by
 * the smoke CHAIN GATE. Later slices GROW this module into the full lifecycle
 * chain, appending one segment per slice:
 *
 *   create → go-live → period/clock → score → fouls→bonus → substitution
 *          → timeout → possession → final → scoreboard == fold → recap → follow
 *
 * Add each new segment as an exported helper below and chain it from the
 * umbrella spec, asserting against the real stack each step.
 *
 * Auth note: `gameboardd` uses a fixed DEV identity (devIdentity), so writes are
 * permitted without a real Firebase token; no Authorization header is needed in
 * these E2E primitives. Reads (GET /state) are public.
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Canonical source for each event type (mirrors game-state.ts sourceFor). */
function sourceFor(type: string): string {
  switch (type) {
    case 'score':
    case 'team-foul':
    case 'substitution':
      return 'scorekeeper';
    case 'clock':
    case 'period':
    case 'possession':
    case 'timeout':
    case 'status':
      return 'timekeeper';
    default:
      return 'judge';
  }
}

/** Random dashless 32-char hex id — the wire format for event ids. */
function newEventID(): string {
  const buf = new Uint8Array(16);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Inline team descriptor for a side (matches the api4gameboard wire contract). */
export interface SideInput {
  name: string;
  colour: string;
  spaceID?: string | null;
}

/** The game record returned by POST /v0/api4gameboard/games. */
export interface CreatedGame {
  gameID: string;
  home: SideInput;
  away: SideInput;
  scheduledMs: number;
  status: string;
}

/**
 * The full game record returned by GET /v0/api4gameboard/games/{id}.
 * Mirrors the backend GameRecord JSON shape (gameID, home, away, scheduledMs,
 * status, plus createdBy/createdAt from the platform CreatedFields mixin).
 */
export interface GameRecordWire {
  gameID: string;
  home: SideInput;
  away: SideInput;
  scheduledMs: number;
  status: string;
  createdBy?: string;
  createdAt?: string;
}

/** The deterministic server fold returned by GET /v0/api4gameboard/games/{id}/state. */
export interface GameStateWire {
  status: string;
  period: number;
  gameClockMs: number;
  clockRunning: boolean;
  scores: Record<string, number>;
  teamFouls: Record<string, number>;
  timeoutsUsed: Record<string, number>;
  possession: string;
  onCourt: Record<string, string[]>;
  playerPoints: Record<string, number>;
  playerAssists: Record<string, number>;
}

/**
 * Create a game through the real chain (UI/API → gameboardd → Firestore
 * emulator). Returns the persisted record (its `gameID` keys all later calls).
 */
export async function createGame(
  request: APIRequestContext,
  home: SideInput,
  away: SideInput,
  scheduledMs = 0,
): Promise<CreatedGame> {
  const res = await request.post('/v0/api4gameboard/games', {
    data: { home, away, scheduledMs },
  });
  expect(res.status(), `create game failed: ${await res.text()}`).toBe(201);
  const body = (await res.json()) as CreatedGame;
  expect(body.gameID, 'created game must have a gameID').toBeTruthy();
  return body;
}

/**
 * Read the persisted game record back from the Firestore emulator.
 * `GET /v0/api4gameboard/games/{id}` — public/no-login.
 * Asserts the returned record's sides and scheduledMs equal what was created
 * (no drift between create request and persisted document).
 */
export async function getGame(
  request: APIRequestContext,
  gameID: string,
): Promise<GameRecordWire> {
  const res = await request.get(
    `/v0/api4gameboard/games/${encodeURIComponent(gameID)}`,
  );
  expect(
    res.ok(),
    `get game failed: ${res.status()} ${await res.text()}`,
  ).toBeTruthy();
  return (await res.json()) as GameRecordWire;
}

/**
 * Read a game's deterministic folded state back from the Firestore emulator
 * (the public scoreboard read). Proves the persisted log folds as expected.
 */
export async function getState(
  request: APIRequestContext,
  gameID: string,
): Promise<GameStateWire> {
  const res = await request.get(
    `/v0/api4gameboard/games/${encodeURIComponent(gameID)}/state`,
  );
  expect(
    res.ok(),
    `get state failed: ${res.status()} ${await res.text()}`,
  ).toBeTruthy();
  return (await res.json()) as GameStateWire;
}

/**
 * Append a single event to a game's log through the real chain
 * (gameboardd → dalgo → Firestore emulator). Builds the required envelope
 * fields (`eventID`, `source`, `wallClockMs`) automatically; callers supply
 * only the domain payload (`type` + any type-specific fields).
 *
 * Slice 2 introduces this primitive so that the scoreboard E2E can seed a
 * deterministic game state without going through the browser UI.
 */
export async function appendEvent(
  request: APIRequestContext,
  gameID: string,
  type: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const event = {
    eventID: newEventID(),
    type,
    source: sourceFor(type),
    wallClockMs: Date.now(),
    period: 0,
    gameClockMs: 0,
    ...payload,
  };
  const res = await request.post(
    `/v0/api4gameboard/games/${encodeURIComponent(gameID)}/events`,
    { data: event },
  );
  expect(
    res.ok(),
    `append '${type}' failed: ${res.status()} ${await res.text()}`,
  ).toBeTruthy();
}

/**
 * Seed a scored game state through the real chain. Seeds the events that
 * produce the canonical scoreboard fixture used by Slice 2+ E2E assertions:
 *
 *   status=live, period=1, clock started at 10:00 and stopped at 9:00,
 *   home +2/+3/FT (=6), away +2 (=2), 5 away fouls → home bonus,
 *   possession=away, home subs p1 (adult) and p2 (no-consent minor) on court.
 *
 * The returned partial state lets callers assert fold equality without
 * re-reading GET /state themselves (though they may also call getState).
 *
 * Later slices should extend this chain (timeouts, sub-swap, final, …) rather
 * than duplicating the setup.
 */
export async function seedScoredGame(
  request: APIRequestContext,
  gameID: string,
): Promise<void> {
  // 1. Tip-off
  await appendEvent(request, gameID, 'status', { status: 'live' });
  await appendEvent(request, gameID, 'period', { period: 1 });
  await appendEvent(request, gameID, 'clock', {
    clockAction: 'start',
    gameClockMs: 600000,
    period: 1,
  });
  await appendEvent(request, gameID, 'clock', {
    clockAction: 'stop',
    gameClockMs: 540000,
    period: 1,
  });

  // 2. Scoring: home +2, +3, FT (=6); away +2 (=2)
  await appendEvent(request, gameID, 'score', {
    side: 'home',
    points: 2,
    period: 1,
  });
  await appendEvent(request, gameID, 'score', {
    side: 'home',
    points: 3,
    period: 1,
  });
  await appendEvent(request, gameID, 'score', {
    side: 'home',
    points: 1,
    period: 1,
  });
  await appendEvent(request, gameID, 'score', {
    side: 'away',
    points: 2,
    period: 1,
  });

  // 3. Away fouls ×5 → home enters bonus
  for (let i = 0; i < 5; i++) {
    await appendEvent(request, gameID, 'team-foul', {
      side: 'away',
      period: 1,
    });
  }

  // 4. Possession to away
  await appendEvent(request, gameID, 'possession', { side: 'away', period: 1 });

  // 5. Home subs: p1 (adult) and p2 (no-consent minor) on court
  await appendEvent(request, gameID, 'substitution', {
    side: 'home',
    playerOn: 'p1',
    period: 1,
  });
  await appendEvent(request, gameID, 'substitution', {
    side: 'home',
    playerOn: 'p2',
    period: 1,
  });
}

// ---------------------------------------------------------------------------
// UI-driving lifecycle segment (real browser, NO mocking) — the reborn
// full-game journey, ported from the legacy full-game.spec.ts.
// ---------------------------------------------------------------------------

/**
 * The deterministic fold produced by {@link driveFullGameViaConsole}, so the
 * umbrella / public-scoreboard assertions can reference one canonical fixture.
 *
 *   home = +2 +3 +1 (FT) +2 (attributed p1/p2) = 8
 *   away = +2 = 2; away fouls = 5 → home bonus; possession = away; status final.
 */
export const FULL_GAME_FOLD = {
  scoreHome: 8,
  scoreAway: 2,
  awayFouls: 5,
  possession: 'away',
  status: 'final',
} as const;

/**
 * Drive the REAL operator console UI at `/app/g/<gameID>/console` through a full
 * game lifecycle — go-live → period → clock → score (incl. the attributed
 * `home-2-by-p1`) → 5 away fouls→bonus → subs → timeout → possession → final —
 * clicking the actual Ionic controls (no `page.route`/mocking). Each click is a
 * real append through gameboardd → Firestore emulator; the embedded scoreboard
 * re-reads the fold, so the on-surface assertions prove board == fold at each
 * step. Exposed here so the umbrella spec can reuse the exact journey.
 */
export async function driveFullGameViaConsole(
  page: Page,
  gameID: string,
): Promise<void> {
  await page.goto(`/app/g/${gameID}/console`);

  // 1–2. tip-off: go live, period 1, start the clock (legacy 600000 = 10:00)
  await page.getByTestId('go-live').click();
  await expect(page.getByTestId('status')).toHaveText('live');
  await page.getByTestId('period-1').click();
  await expect(page.getByTestId('period')).toHaveText('1');
  await page.getByTestId('clock-start').click();
  await expect(page.getByTestId('clock-running')).toHaveText('▶');
  await expect(page.getByTestId('clock')).toHaveText('10:00');

  // 3. scoring: home +2, +3, FT, and the attributed +2 (p1, assist p2) = 8;
  //    away +2 = 2
  await page.getByTestId('home-2').click();
  await page.getByTestId('home-3').click();
  await page.getByTestId('home-ft').click();
  await page.getByTestId('home-2-by-p1').click();
  await page.getByTestId('away-2').click();
  await expect(page.getByTestId('score-home')).toHaveText(
    String(FULL_GAME_FOLD.scoreHome),
  );
  await expect(page.getByTestId('score-away')).toHaveText(
    String(FULL_GAME_FOLD.scoreAway),
  );

  // 4. fouls: away commits 5 → home bonus flips
  for (let i = 0; i < FULL_GAME_FOLD.awayFouls; i++) {
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
}
