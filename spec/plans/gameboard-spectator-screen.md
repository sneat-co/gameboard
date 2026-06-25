---
format: https://specscore.md/plan-specification
status: Approved
---
# Plan: Gameboard Spectator Screen

**Status:** Approved
**Source Feature:** sports/gameboard-live/spectator-screen
**Date:** 2026-06-24
**Owner:** alex
**Supersedes:** —
**Parent:** gameboard-live

> **Status (gameboard repo, 2026-06-26):** Backend (account-gated follow) is **live in prod** (via sneat-go). This **frontend surface was part of the deleted 1st-gen app and was not ported** to the current Nx + Ionic app — it is **to be rebuilt** on the current scaffolding (Slice 4). See the master plan's [Frontend Reality & Rebuild](./gameboard-live.md) section; salvaged acceptance E2E: [`docs/legacy-mvp-frontend/e2e/follow.spec.ts`](../../docs/legacy-mvp-frontend/e2e/follow.spec.ts).

## Summary

Implements the [`spectator-screen`](../features/sports/gameboard-live/spectator-screen/README.md) Feature — the primary spectator-facing live game page — as **contract-first vertical slices**. Each task first freezes its backend↔frontend API contract (**TypeSpec** `api4gameboard.tsp` + the `gameboard-ext/backend` Go types + the `@sneat/extension-gameboard-contract` TS package), then splits into a **backend subtask** (the `gameboard/backend` extension, dalgo→Firestore over the **root/global** `/ext/gameboard/...` tree) and a **frontend subtask** (`@sneat/extension-gameboard-internal`) implemented in parallel against the frozen contract.

Storage is canonical: the game lives at `/ext/gameboard/games/{gameID}` with its append-only event log at `/ext/gameboard/games/{gameID}/events/{eventID}`; teams are sneat spaces referenced by id. Follow edges are written through the [`linkage`](../research/core-modules-interface.md) facade behind the account-gate; scarce 🔥 reactions and MVP votes are light writes owned by this extension. All 8 Feature ACs are covered; none deferred.

## Approach

Each task is a thin slice that ships its ACs end-to-end (contract + persistence + read/write API + UI). Within a task the order is **contract-first**: (1) freeze the slice's TypeSpec + ext types — this frozen CONTRACT (`gameboard-ext/backend` Go + `@sneat/extension-gameboard-contract` TS + `api4gameboard.tsp`) is the integration boundary; then (2) the **backend subtask** (`gameboard/backend`, dalgo→Firestore) and (3) the **frontend subtask** (`@sneat/extension-gameboard-*`) proceed **in parallel**, each its own agent, against the generated types.

This screen **composes** rather than owns: it reads the [`scoreboard`](../features/sports/gameboard-live/scoreboard/README.md) board and [`players-list`](../features/sports/gameboard-live/players-list/README.md) (read composition, public mode) over the [`event-timeline`](../features/sports/gameboard-live/event-timeline/README.md) projection; routes mutations through [`account-gate`](../features/sports/account-gate/README.md) (follow / react / vote / predict / RSVP) and writes follow edges via [`linkage`](../research/core-modules-interface.md); and hosts share/QR via the **invitus link channel**. The reaction, prediction, MVP-voting, recap, and scoreboard mechanics are owned by their own Features — this plan embeds their UIs and surfaces them publicly.

Order is dependency-ordered into four slices: the public no-login live surface first (everything renders on it), then the public players-list composition, then the account-gated participation writes (follow + reactions), then the phase-adaptive engagement shell (pre-game / live / final routing, venue-awareness, and minor-safe consent that spans the surface).

## Tasks

### Task 1: Render the public no-login live surface (responsive, near-real-time)

**Verifies:** sports/gameboard-live/spectator-screen#ac:renders-live-no-login, sports/gameboard-live/spectator-screen#ac:single-surface-adapts
**Depends-On:** —
**Status:** pending

The base spectator page: a single responsive surface that renders the live scoreboard composition over the event-timeline projection, openable by anyone with no Sneat account, updating in near-real-time with a freshness indication, adapting layout courtside-vs-remote while sharing one behavior and data source.
- **Contract (TypeSpec + ext types, first):** in `api4gameboard.tsp`, the public read-only `LiveGameView` model (score, clock, period, phase, freshness) and a no-auth `getLiveGame(gameID)` + live-subscription operation; freeze the `gameboard-ext/backend` Go structs + `@sneat/extension-gameboard-contract` TS types.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore): read/project the game at `/ext/gameboard/games/{gameID}` and its event log at `/ext/gameboard/games/{gameID}/events/{eventID}` into `LiveGameView` over an unauthenticated read path.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): the responsive spectator surface in `-shared` consuming the live view with breakpoints (compact courtside vs lean-back remote) and a freshness indicator; no login to view.

### Task 2: Surface the public players-list with minor consent-gating

**Verifies:** sports/gameboard-live/spectator-screen#ac:player-stats-list
**Depends-On:** 1
**Status:** pending

From the live surface a viewer opens the players-list in public mode — per-player jersey #, name, points, personal fouls (+ foul-trouble), and minutes on court for both teams — with a minor without publish-consent shown by jersey number only.
- **Contract (TypeSpec + ext types, first):** the public `PlayerStatsView` model (jersey #, name, points, personalFouls, foulTrouble, minutes) and a no-auth `getPlayersList(gameID)`; encode the consent-redaction shape (consent-permitted fields only) in the contract.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore): assemble the public players-list from the game's team spaces (referenced by id) and project per-player stats, applying minor publish-consent (read from `sneat-team`/`roles`) before returning — jersey-number-only for unconsented minors.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): the public players-list panel for both teams, rendering the consent-redacted view as delivered.

### Task 3: Account-gated participation — follow via profiles/QR and scarce 🔥 reactions

**Verifies:** sports/gameboard-live/spectator-screen#ac:follow-via-profile, sports/gameboard-live/spectator-screen#ac:react-with-budget
**Depends-On:** 1
**Status:** pending

Turn watching into participation: tappable team/player names open their profile pages (where one-tap follow lives — no follow buttons on the live screen), and a 🔥 control attached to the last scoring play sends a scarce reaction that decrements the viewer's budget and appears on the live feed without altering the authoritative score.
- **Contract (TypeSpec + ext types, first):** the `sendReaction(gameID, scoringPlayRef)` write returning remaining budget + feed delta, and the follow-edge write shape; both marked account-gated. Reactions and follow are light writes owned here.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore): behind the account-gate, append 🔥 reactions as light writes under `/ext/gameboard/games/{gameID}/...` with per-account budget enforcement (no change to the authoritative score/event log), and write follow edges via the `linkage` facade; reject anonymous mutations.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): tappable team/player names linking to profile pages (no live-screen follow buttons), the scan-to-follow QR, and the 🔥 send control on the last scoring play showing remaining budget + the live reaction feed, with a one-tap sign-in prompt on act.

### Task 4: Phase-adaptive engagement shell, venue-awareness, and minor-safe public surface

**Verifies:** sports/gameboard-live/spectator-screen#ac:surface-follows-phase, sports/gameboard-live/spectator-screen#ac:venue-extras-on-site-only, sports/gameboard-live/spectator-screen#ac:minor-safe-public
**Depends-On:** 1, 2, 3
**Status:** pending

The surface adapts to the event-timeline phase and routes to the right engagement loop (pre-game: fixture info + venue/directions + predictions entry + per-team RSVP + Share game; live: scoreboard + reactions + follow-via-names; final: MVP-voting entry + recap link); lights up venue extras only for on-site viewers; and keeps the whole surface public/no-login for viewing while gating every mutation, honouring minor consent everywhere.
- **Contract (TypeSpec + ext types, first):** the `phase` enum mapping (`scheduled`→pre-game; `live`/`halftime`/`overtime`→live; `final`→final; `cancelled`→terminal) on `LiveGameView`, a `venueContext` field (resolved from QR/deep-link origin or explicit "I'm here", NOT geolocation), and the phase-gated entry-point descriptors (predictions / RSVP / share / MVP-voting / recap links) — all viewable anonymously, each act account-gated.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore): derive phase from the authoritative event-timeline status; record the "I'm here" venue presence as a light write behind the account-gate with minor-safety applied; own MVP-vote light writes; expose the per-team RSVP / predictions / recap link descriptors. No mutation succeeds without an account.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): phase-adaptive layout (pre-game fixture/venue-map/predictions/RSVP/Share via the invitus link channel; live board+reactions; final MVP-voting + recap link), venue-extras (prominent reaction pad, "I'm here", follow QR) shown on-site only and omitted/relabeled online, and consent-redacted minor display with sign-in prompted only on act.

## Open Questions

None at this time.

---
*This document follows the https://specscore.md/plan-specification*
