---
format: https://specscore.md/plan-specification
status: Implemented
---
# Plan: Anon First New Game

**Status:** Implemented
**Source Feature:** anon-first-new-game
**Date:** 2026-06-25
**Owner:** alexandertrakhimenok
**Supersedes:** —

## Summary

Implements the anonymous-first new-game flow in the gameboard Angular app: ungate `/new-game`, persist the form draft in `localStorage`, add a non-blocking sign-in affordance that survives the full-page redirect round-trip, and gate backend game creation behind an explicit authenticated action. Touches the route config (`app.routes.ts`), `NewGamePageComponent`, a small draft-persistence helper, and the `gameboard-app-e2e` Playwright suite.

## Approach

Linear sequence chosen to de-risk in dependency order. Task 1 ungates the route so the form can render and be tested signed-out. Task 2 adds draft persistence, which is the prerequisite for surviving any navigation. Task 3 builds the sign-in affordance and the loss-free redirect round-trip — it depends on Task 2's persistence to preserve the draft across the full-page redirect. Task 4 wires the explicit authenticated create, which depends on both the ungated route (Task 1) and the working sign-in round-trip (Task 3). Each task lands its own Playwright e2e coverage in the existing `gameboard-app-e2e` project rather than deferring tests to a separate task.

## Tasks

### Task 1: Ungate the /new-game route

**Verifies:** anon-first-new-game#ac:renders-while-signed-out
**Depends-On:** —
**Status:** complete

Remove `canActivate: [AuthGuard]` (and the `redirectToLoginIfNotSignedIn` `authGuardPipe`) from the `/new-game` route in `app.routes.ts` so the form renders for unauthenticated users instead of redirecting to `/login`. Add a Playwright e2e asserting a signed-out visit to `/new-game` shows the form and does not redirect.

### Task 2: Persist and restore the form draft in localStorage

**Verifies:** anon-first-new-game#ac:draft-saved-on-change, anon-first-new-game#ac:draft-restored-on-load
**Depends-On:** 1
**Status:** complete

Add a small draft-persistence helper that serializes the form's signal values to a single `localStorage` key on change (e.g. via an `effect`) and rehydrates them in `NewGamePageComponent` on init when a draft exists. Cover with e2e: typing values writes the draft key; reloading the route restores the field values.

### Task 3: Sign-in-anytime affordance with loss-free redirect round-trip

**Verifies:** anon-first-new-game#ac:signin-affordance-visible, anon-first-new-game#ac:roundtrip-preserves-draft
**Depends-On:** 2
**Status:** complete

Add a non-blocking sign-in affordance to the form (visible while signed-out, never blocking editing) that triggers the app's configured full-page redirect sign-in with a return URL back to `/new-game`. Relying on Task 2's persistence, ensure the draft is intact after the round-trip. Cover with e2e: the affordance is visible and the form remains editable without signing in, and (where the harness allows simulating the auth return) the draft values survive a return to `/new-game`.

### Task 4: Explicit authenticated game creation

**Verifies:** anon-first-new-game#ac:anonymous-create-routes-through-signin, anon-first-new-game#ac:authenticated-create-persists
**Depends-On:** 3
**Status:** complete

Gate the "create game" action on authentication: when signed-out, route the user through sign-in first (draft preserved per Task 3) and do not persist to the backend until authenticated; when signed-in, an explicit create call persists the game via `GameService`. Cover with e2e: triggering create while signed-out routes through sign-in without a backend write, and an explicit create while signed-in persists the game.

## Open Questions

- Should Task 4 clear the `localStorage` draft after a game is successfully created (vs. leaving it for a follow-up game)? Carried from the source Feature; resolve during Task 4 implementation.

---
*This document follows the https://specscore.md/plan-specification*
