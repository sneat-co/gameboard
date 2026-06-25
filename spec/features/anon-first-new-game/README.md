---
format: https://specscore.md/feature-specification
status: Approved
---

# Feature: Anonymous-first new game with sign-in at any moment

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/anon-first-new-game?op=explore) | [Edit](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/anon-first-new-game?op=edit) | [Ask question](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/anon-first-new-game?op=ask) | [Request change](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/anon-first-new-game?op=request-change) |
**Status:** Approved
**Source Ideas:** anon-first-new-game

## Summary

Make /new-game usable while unauthenticated, persist the form draft across the login redirect, and let the user sign in at any moment — all without losing what they typed.

## Problem

Today `/new-game` is hard-gated by `AuthGuard` (`app.routes.ts`, `redirectToLoginIfNotSignedIn`): an unauthenticated user is bounced to `/login` and the new-game form never renders. This walls first-time and anonymous users (e.g. someone who scanned a QR code at a match or followed a shared link) out of the primary action — creating a game — and depresses the form-started → game-created conversion. Even if the guard were removed, the form is built from in-memory Angular signals with no persistence, so any navigation away (such as the full-page redirect sign-in the app uses) destroys the draft. The result: a user cannot start filling the form before deciding to log in, and cannot log in mid-form without losing their work.

This Feature delivers the MVP slice: an ungated form, a draft that survives the login round-trip, and a non-blocking way to sign in at any moment. The registered-team picker (populating `Side.spaceID` from the user's sneat spaces) is explicitly a separate follow-up Feature.

## Behavior

### Unauthenticated access

#### REQ: ungated-route

`/new-game` renders the new-game form for an unauthenticated user. The route is no longer protected by `AuthGuard`; visiting it while signed out shows the form rather than redirecting to `/login`.

### Draft persistence

#### REQ: draft-autosave

While the form is open, changes to its fields are persisted to `localStorage` as a single most-recent draft. Persistence is automatic — the user takes no explicit save action for the draft to be retained.

#### REQ: draft-restore

When the new-game form loads and a saved draft exists in `localStorage`, the form is rehydrated from that draft so the user resumes where they left off.

### Sign-in at any moment

#### REQ: signin-affordance

While unauthenticated, the form shows a non-blocking sign-in affordance the user can trigger at any moment. Triggering it starts the app's configured full-page redirect sign-in and returns the user to `/new-game` afterward. The affordance never blocks the user from continuing to fill the form anonymously.

#### REQ: lossfree-roundtrip

Initiating sign-in from the form (a full-page redirect) and returning to `/new-game` preserves the in-progress draft. After the round-trip the form shows exactly the field values the user had entered before sign-in.

### Game creation

#### REQ: explicit-authed-create

Persisting the game to the backend requires authentication and an explicit user action. An anonymous game stays local-only (the `localStorage` draft) until the user is signed in and explicitly creates it. If the user triggers create while unauthenticated, the app routes them through sign-in first; the draft survives per `lossfree-roundtrip`, and on return the explicit create persists the game.

## Acceptance Criteria

### AC: renders-while-signed-out

Validates `ungated-route`.

Scenario: Anonymous user opens the new-game route
Given a user who is not signed in
When they navigate to `/new-game`
Then the new-game form is displayed and they are not redirected to `/login`.

### AC: draft-saved-on-change

Validates `draft-autosave`.

Scenario: Typing into the form saves a draft
Given an unauthenticated user on `/new-game`
When they enter values into the form fields (e.g. home and away team names)
Then those values are written to a new-game draft in `localStorage` without any explicit save action.

### AC: draft-restored-on-load

Validates `draft-restore`.

Scenario: Returning to the form restores prior input
Given a previously saved new-game draft exists in `localStorage`
When the new-game form loads
Then the form fields are populated from the saved draft.

### AC: signin-affordance-visible

Validates `signin-affordance`.

Scenario: Sign-in is offered without blocking
Given an unauthenticated user filling the new-game form
When they view the form
Then a sign-in affordance is visible and the user can keep editing the form without signing in.

### AC: roundtrip-preserves-draft

Validates `lossfree-roundtrip`.

Scenario: Signing in mid-form loses nothing
Given an unauthenticated user who has entered values into the new-game form
When they trigger sign-in, complete the full-page redirect flow, and return to `/new-game`
Then the form shows the same field values they had entered before signing in.

### AC: anonymous-create-routes-through-signin

Validates `explicit-authed-create`.

Scenario: Creating while signed out prompts sign-in first
Given an unauthenticated user who has filled the new-game form
When they trigger "create game"
Then they are routed through sign-in, the draft is preserved across the round-trip, and the game is not persisted to the backend until they are authenticated.

### AC: authenticated-create-persists

Validates `explicit-authed-create`.

Scenario: Explicit create after sign-in persists the game
Given a signed-in user with a filled new-game form
When they explicitly trigger "create game"
Then the game is persisted to the backend.

## Rehearse Integration

Each AC above is UI/route observable (DOM selectors, route state, `localStorage` contents) and is therefore testable via the existing Playwright e2e suite (`apps/gameboard-app-e2e`). Rehearse stubs are deferred to the Plan/Implement phase rather than scaffolded here, to keep the test surface aligned with the actual selectors chosen during implementation.

## Out of Scope

- Registered-team picker — fetching the user's sneat spaces and populating `Side.spaceID`. Separate follow-up Feature.
- Firebase anonymous auth — a real anonymous `uid` is a different data model; this Feature keeps anonymous games local-only.
- Backend acceptance of `venue`/`competition`/`role` fields — unrelated backend contract work.
- Auto-persisting the local draft to the backend on sign-in — persistence is explicit per `explicit-authed-create`.
- Multiple concurrent drafts or draft expiry policy — a single most-recent draft is sufficient for the MVP.

## Assumption Carryover

From the source Idea, the following must-validate assumptions remain in force and are exercised by this Feature:

- A game is useful client-side without a backend write — the form and draft function fully while unauthenticated (`ungated-route`, `draft-autosave`). If starting/scoring a game in fact requires an authenticated backend call, the anonymous-first value is reduced; this Feature still removes the form-entry wall regardless.
- The configured full-page redirect sign-in returns the user to `/new-game` — required for `lossfree-roundtrip`. Implementation must set/preserve the return URL.

## Open Questions

- Should the `localStorage` draft be cleared after a game is successfully created, and is single-device drafting acceptable for the target user?

---
*This document follows the https://specscore.md/feature-specification*
