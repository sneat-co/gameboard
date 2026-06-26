import { expect, test } from '@playwright/test';
import { createGame } from './lifecycle';

// CHAIN GATE — Slice 5: follow control on the public scoreboard.
//
// Assumptions logged (as required by the brief):
//   1. The follow control is on the ScoreboardPageComponent (public spectator
//      surface `g/:gameID`), NOT the shared ScoreboardViewComponent, so it
//      does NOT appear on the operator console.
//   2. GameService.follow calls SneatApiService.post, which throws a CLIENT-SIDE
//      "not authenticated" guard (a string error) BEFORE any network call when
//      there is no Firebase session. The follow control catches ANY error and
//      shows 'account required'. This is the anonymous path asserted here.
//   3. The legacy account-id input/testid is OMITTED. Auth is Firebase-token
//      based (decision 2). The signed-in→following path is covered by a
//      component unit test that stubs GameService.follow (decision 10).
//   4. Real backend-401 fidelity (gameboardd returning 401 for anonymous) is
//      a PROD/sneat-go concern. gameboardd's devIdentity would otherwise
//      authorize the request; the rejection here is at the client-auth layer.
//      Deferred to a real Auth-emulator sign-in.
//
// Decision 10: E2E asserts only the anonymous→rejected path (real stack, no
// mocking). The signed-in→following path is covered by unit test.

test('real-stack: anonymous follow → "account required" (client-auth rejection)', async ({
  page,
  request,
}) => {
  // 1. Create a game through the real chain so the scoreboard route resolves.
  const game = await createGame(
    request,
    { name: 'Rockets', colour: '#ff0000' },
    { name: 'Comets', colour: '#0000ff' },
  );
  const { gameID } = game;

  // 2. Navigate the real browser to the public scoreboard (anonymous — no session).
  await page.goto(`/app/g/${gameID}`);

  // 3. The follow-home button must be visible on the spectator surface.
  const followBtn = page.getByTestId('follow-home');
  await expect(followBtn).toBeVisible();

  // 4. Follow-status starts empty before any interaction.
  await expect(page.getByTestId('follow-status')).toHaveText('');

  // 5. Click follow-home as an anonymous user (no Firebase session).
  //    SneatApiService.post throws a client-side "not authenticated" guard
  //    before any network call; followHome() catches it → 'account required'.
  //    This is a REAL rejection — no page.route / mocking.
  await followBtn.click();
  await expect(page.getByTestId('follow-status')).toHaveText(
    'account required',
  );
});
