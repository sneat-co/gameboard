import { expect, test } from '@playwright/test';
import { createGame, getState } from './lifecycle';

// CHAIN GATE (real stack, NO mocking): this is the first link of the growing
// full-game lifecycle chain. It proves the UI→API→gameboardd→Firestore
// emulator→fold span end-to-end:
//
//   1. create a game through the REAL chain (HTTP → gameboardd → dalgo →
//      Firestore emulator), then
//   2. read GET /state back from the emulator and assert the created game's
//      folded state (status `scheduled`, scores 0-0).
//
// There is deliberately NO page.route / HTTP mocking here — the request fixture
// talks to the real same-origin gameboardd backed by the Firestore emulator
// (started by `firebase emulators:exec` around `nx e2e`).

test('real stack: create a game and read its folded state from the emulator', async ({
  request,
}) => {
  const created = await createGame(
    request,
    { name: 'Hawks', colour: '#ff0000' },
    { name: 'Bears', colour: '#0000ff' },
  );

  // The create round-tripped through Firestore and came back scheduled.
  expect(created.status).toBe('scheduled');

  // Read-side: the deterministic fold of the (empty) log from the emulator.
  const state = await getState(request, created.gameID);

  expect(state.status).toBe('scheduled');
  expect(state.scores.home).toBe(0);
  expect(state.scores.away).toBe(0);
  expect(state.period).toBe(0);
  expect(state.clockRunning).toBe(false);
});
