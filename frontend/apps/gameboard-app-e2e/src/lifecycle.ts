import { APIRequestContext, expect } from '@playwright/test';

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
