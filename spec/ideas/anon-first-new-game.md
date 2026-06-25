---
format: https://specscore.md/idea-specification
status: Specified
---

# Idea: Anonymous-first new game with sign-in at any moment

**Status:** Specified
**Date:** 2026-06-25
**Owner:** alex
**Promotes To:** anon-first-new-game
**Supersedes:** —
**Related Ideas:** —

## Problem Statement

How might we let a first-time, unauthenticated user start and fill the new-game form with zero auth friction, while letting them sign in at any moment — for example to pick an already-registered team from sneat.team — without losing what they have entered?

## Context

Today /new-game is hard-gated by AuthGuard (app.routes.ts:20-29, redirectToLoginIfNotSignedIn): an unauthenticated user is bounced to /login and the form component never renders. The form (new-game-page.component.ts) is entirely in-memory Angular signals with NO persistence — any navigation (e.g. to /login) destroys the draft. The Side model already carries an optional spaceID linking a team to a registered sneat space (game-contract.ts), but the UI exposes no team picker; users only type ad-hoc name+colour. Goal: reduce drop-off at the auth wall for first-time / anonymous users so MORE GAMES get created, while keeping anonymous game data local-only until the user chooses to sign in.

## Recommended Direction

Ungate /new-game into a public route and move any auth check inside the component. Auto-persist the form draft to localStorage on every change so it survives a full-page login redirect round-trip. Surface an always-available, non-blocking 'Sign in' affordance in the form; on auth return, rehydrate the draft from localStorage and unlock a registered-team picker that populates Side.spaceID from the user's sneat spaces. Anonymous games stay local-only until the user signs in, at which point the draft (and any local game) can be persisted to the backend.

## Alternatives Considered

- **Firebase anonymous auth.** Sign every visitor in anonymously so they get a real `uid` and the game persists to the backend immediately; later link the anon account to a real one. Rejected for this Idea because the user explicitly chose *local-only until login* — anonymous persistence is a different data model with its own backend, quota, and account-linking complexity, and it isn't required to kill the auth-wall drop-off.
- **Two-route split (`/create-game` public → `/new-game` authed).** A public sibling route collects the draft, then redirects to the guarded route on sign-in. Rejected as redundant: it duplicates guard logic and form wiring across two routes to achieve what one ungated route plus draft persistence does more simply.
- **Modal login overlay without persistence.** Keep the guard but let the user fill an in-page modal that defers the real `/new-game` until login. Rejected because it still walls the form behind a modal and, without draft persistence, a full-page redirect sign-in (the configured method) still loses state.

## MVP Scope

A thin vertical slice: (1) make /new-game reachable while unauthenticated (remove the route guard, no immediate redirect); (2) persist the form draft to localStorage and rehydrate it after the login redirect so nothing is lost; (3) a non-blocking 'Sign in to use your registered team' affordance the user can trigger at any moment. The registered-team picker (spaceID population) can be a fast-follow once the round-trip is proven loss-free.

## Not Doing (and Why)

- Firebase anonymous auth — user explicitly chose local-only-until-login; a real anon uid is a different model and out of scope.
- Backend acceptance of venue/competition/role fields — separate backend contract work, unrelated to the auth/persistence funnel.
- Managing sneat.team teams (create/edit spaces) — we only consume existing spaces to populate spaceID, not author them.
- A separate /create-game public route mirrored to /new-game — rejected as redundant guard duplication.

## Key Assumptions to Validate

| Tier | Assumption | How to validate |
|------|------------|-----------------|
| Must-be-true | A game is useful client-side without a backend write — i.e. "local-only until login" genuinely removes the wall rather than moving it later. If starting/scoring a game requires an authenticated backend call, anonymous-first delivers little. | Trace `GameService.create` and the live-game/scoreboard flow: confirm a game can be started and scored entirely in-memory/localStorage with no auth-required network call. |
| Must-be-true | The configured full-page redirect sign-in returns the user to `/new-game` (not a default landing route), so a rehydrate-on-return flow has somewhere to hook. | Test the redirect sign-in round-trip and inspect where `BaseAppComponent` lands the user post-auth; confirm return URL is preserved or can be set. |
| Should-be-true | localStorage is an acceptable place to hold an anonymous draft (no sensitive data, single-device is fine for the QR-at-the-match user). | Review the form fields for anything sensitive; confirm single-device drafting meets the first-time-user journey. |
| Should-be-true | The user's sneat spaces can be fetched client-side right after auth to populate the team picker without a heavy load. | Check whether a spaces/teams list endpoint or service is available to the gameboard app post-auth. |
| Might-be-true | Users will actually want to log in mid-form (vs. just finishing anonymously). | Observe post-launch conversion: anonymous-complete vs. sign-in-mid-form rates. |


## SpecScore Integration

- **New Features this would create:** (1) Public/ungated new-game route with in-component auth handling; (2) New-game draft persistence (localStorage save + rehydrate-on-login-return); (3) Sign-in-at-any-moment affordance; (4) Registered-team picker that populates `Side.spaceID` from the user's sneat spaces (fast-follow).
- **Existing Features affected:** the `/new-game` route + `AuthGuard` wiring (`app.routes.ts`), `NewGamePageComponent`, and the post-redirect-auth landing flow (`BaseAppComponent`).
- **Dependencies:** access to the user's sneat spaces post-auth (for the team picker); the configured redirect sign-in flow returning to `/new-game`.

## Open Questions

- If an anonymous user fills the form, signs in, and *already* has the team they typed registered in sneat.team, do we offer to reconcile the ad-hoc name with the registered space (populate `spaceID`), or keep them separate?
- When does a local-only anonymous game get persisted to the backend — automatically on first sign-in, or only on an explicit "save"?
- Should the localStorage draft expire/clear (e.g. after the game is created or after N days), and is a single most-recent draft enough or do we need multiple?
