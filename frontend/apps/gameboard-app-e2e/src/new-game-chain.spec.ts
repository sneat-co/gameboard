import { expect, test } from '@playwright/test';
import { createGame, getGame, getState } from './lifecycle';

// CHAIN GATE — Slice 1: new-game segment of the real-stack E2E chain.
//
// Logged assumption (per brief):
//   UI authenticated-create fidelity is DEFERRED to the Auth emulator slice.
//   The new-game form gates authenticated create behind sign-in (anonymous →
//   /login), and real Firebase-auth E2E is out of scope here. The CREATE link
//   of the chain is therefore driven through the lifecycle helper — real HTTP
//   → gameboardd → dalgo → Firestore emulator; gameboardd's devIdentity
//   authorises the write — NOT through the auth-gated UI form. The existing
//   new-game-create.spec.ts already covers the anonymous UI path (no write).
//
// This spec asserts the persisted record equals what was created (no drift):
//   1. POST /v0/api4gameboard/games   → game created, status 'scheduled'
//   2. GET  /v0/api4gameboard/games/{id} → home/away names+colours round-trip
//   3. GET  /v0/api4gameboard/games/{id}/state → fold: status 'scheduled',
//      scores 0-0, period 0, clock not running.
//
// There is NO page.route / HTTP mocking here — the request fixture talks to
// the real same-origin gameboardd backed by the Firestore emulator (started by
// `firebase emulators:exec` wrapping `nx e2e`).

test('real stack: create game, read record back, verify folded state', async ({
  request,
}) => {
  const scheduledMs = Date.now() + 3_600_000; // 1 h from now
  const home = { name: 'Hawks', colour: '#c00' };
  const away = { name: 'Foxes', colour: '#00c' };

  // 1. CREATE — drives the real chain; gameboardd devIdentity authorises the write.
  const created = await createGame(request, home, away, scheduledMs);
  expect(created.gameID, 'created game must have a gameID').toBeTruthy();
  expect(created.status).toBe('scheduled');

  // 2. READ RECORD — GET /v0/api4gameboard/games/{id}: assert full fidelity.
  const record = await getGame(request, created.gameID);
  expect(record.gameID).toBe(created.gameID);
  expect(record.home.name).toBe(home.name);
  expect(record.home.colour).toBe(home.colour);
  expect(record.away.name).toBe(away.name);
  expect(record.away.colour).toBe(away.colour);
  expect(record.scheduledMs).toBe(scheduledMs);
  expect(record.status).toBe('scheduled');

  // 3. READ STATE — GET /v0/api4gameboard/games/{id}/state: deterministic fold.
  const state = await getState(request, created.gameID);
  expect(state.status).toBe('scheduled');
  expect(state.scores.home).toBe(0);
  expect(state.scores.away).toBe(0);
  expect(state.period).toBe(0);
  expect(state.clockRunning).toBe(false);
});
