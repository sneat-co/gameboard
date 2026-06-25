---
format: https://specscore.md/plan-specification
status: Approved
---
# Plan: Gameboard Timekeeper Console

**Status:** Approved
**Source Feature:** sports/gameboard-live/timekeeper-console
**Date:** 2026-06-24
**Owner:** alex
**Supersedes:** —
**Parent:** gameboard-live

> **Status (gameboard repo, 2026-06-26):** Backend is **live in prod** (via sneat-go). This **frontend surface was part of the deleted 1st-gen app and was not ported** to the current Nx + Ionic app — it is **to be rebuilt** on the current scaffolding (Slice 2, console). See the master plan's [Frontend Reality & Rebuild](./gameboard-live.md) section; salvaged acceptance E2E: [`docs/legacy-mvp-frontend/e2e/full-game.spec.ts`](../../docs/legacy-mvp-frontend/e2e/full-game.spec.ts).

## Summary

Implements the [`timekeeper-console`](../features/sports/gameboard-live/timekeeper-console/README.md) Feature as **contract-first vertical slices**. `gameboard` is a **root/global extension**: each game lives at `/ext/gameboard/games/{gameID}` with an append-only event log at `/ext/gameboard/games/{gameID}/events/{eventID}`; teams are sneat spaces referenced by id. Every task freezes its **CONTRACT** first (TypeSpec `api4gameboard.tsp` + Go ext types in `gameboard-ext/backend` + TS `@sneat/extension-gameboard-contract`), then splits into a **backend subtask** (`gameboard/backend`, dalgo→Firestore appends over root `/ext/gameboard/...`) and a **frontend subtask** (`@sneat/extension-gameboard-internal`) that proceed in parallel against the frozen types. All 7 Feature ACs are covered; none deferred.

## Approach

This plan **depends on the frozen [`gameboard-event-timeline`](../features/sports/gameboard-live/event-timeline/README.md) append contract** — its event-envelope shape (`eventID`, dual-clock, `source-authority`) and its account + clock/board-runner role gate are the substrate every task here writes through. The timekeeper console adds clock, period, possession, timeout, and team-possession-time event kinds on top of that envelope; it does not redefine the envelope or the gate.

Each task is a thin slice shipped end-to-end (contract + append + projection + UI). Within a task the order is **contract-first**: (1) author/extend `api4gameboard.tsp` plus the Go/TS ext types and **freeze** them as the integration boundary, then (2) **backend subtask** and (3) **frontend subtask** proceed in parallel against the generated types.

Ordering is dependency-driven. Task 1 establishes the **authority gate** (account + clock/board-runner role) that authorizes every subsequent append, so it lands first. Clock+period (Task 2) and possession+timeouts (Task 3) are the two independent core control surfaces and depend only on the gate. Team ball-possession-time (Task 4) is the optional, near-free capture that builds on the possession control and the game clock, so it follows Task 3. The console-authority-and-sync AC spans gate + live reflection, so its append/reflect half is verified once the gate (Task 1) and at least one append surface exist — it is anchored to Task 1 and re-confirmed by the later slices' live-sync assertions.

## Tasks

### Task 1: Gate the console behind account + clock/board-runner role

**Verifies:** sports/gameboard-live/timekeeper-console#ac:console-requires-account-and-role
**Depends-On:** —
**Status:** pending

Establish the write-boundary gate: every timekeeper append requires a signed-in sneat account holding the clock/board-runner game-day role; unauthorized or anonymous callers are refused, and an authorized append reflects live on the scoreboard projection.
- **Contract (TypeSpec + ext types, first):** in `api4gameboard.tsp`, define the authenticated append envelope and the `source-authority` discriminator for the clock/board-runner role (reusing the frozen event-timeline envelope); emit the Go ext types in `gameboard-ext/backend` and `@sneat/extension-gameboard-contract`.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore appends): enforce account + clock/board-runner role at the append boundary over root `/ext/gameboard/games/{gameID}/events`; refuse writes lacking the role.
- **Frontend subtask** (`@sneat/extension-gameboard-internal`): gate the console UI on sign-in + role; surface the live scoreboard projection reflecting an authorized append.

### Task 2: Run the game clock and advance periods

**Verifies:** sports/gameboard-live/timekeeper-console#ac:start-stop-adjust-clock, sports/gameboard-live/timekeeper-console#ac:advance-period, sports/gameboard-live/timekeeper-console#ac:set-quarter-length-before-start
**Depends-On:** 1
**Status:** pending

The timekeeper starts/stops the clock and adjusts it (±5s, correct-to-value), advances the period/quarter into overtime, and sets a period's length in one-minute steps before its clock starts (locked once started, re-opened on advance).
- **Contract (TypeSpec + ext types, first):** define `clock` (start/stop/adjust), `period` (advance + length-config) event kinds with their payloads and the clock-projection model in `api4gameboard.tsp`; freeze Go + TS types.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore appends): append clock and period events over root `/ext/gameboard/...`; reconstruct the authoritative running clock from start/stop/adjust + wall-clock; enforce length editable only before period start and re-opened on advance.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): clock start/stop + ±5s/correct controls, period-advance control (incl. overtime), and the one-minute length stepper that locks once the clock starts.

### Task 3: Toggle possession and grant timeouts with countdown

**Verifies:** sports/gameboard-live/timekeeper-console#ac:toggle-possession, sports/gameboard-live/timekeeper-console#ac:timeout-decrements-and-counts-down
**Depends-On:** 1
**Status:** pending

The timekeeper toggles the possession arrow between the two team spaces and grants a team a timeout, which decrements that team's remaining-timeouts fold and starts a timeout countdown surfaced on the scoreboard.
- **Contract (TypeSpec + ext types, first):** define `possession` (toggle, team-space ref) and `timeout` (granted-to team-space ref, countdown duration) event kinds plus the possession-arrow and timeouts-remaining projection models; freeze Go + TS types.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore appends): append possession and timeout events; fold remaining-timeouts per team space from timeout events.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): possession toggle reflecting the projected arrow; timeout-grant control that decrements remaining and starts the countdown shown on the scoreboard.

### Task 4: Capture optional team ball-possession time

**Verifies:** sports/gameboard-live/timekeeper-console#ac:team-possession-timer
**Depends-On:** 3
**Status:** pending

The optional **Team A · dead-ball · Team B** control starts/switches a per-team possession timer (dead-ball pauses both) by appending possession-time events on the game clock; per-team totals fold deterministically for the recap chart, and its absence never blocks clock/score operation.
- **Contract (TypeSpec + ext types, first):** define the `possession-time` event kind (Team A / dead-ball / Team B selection, game-clock based) and the per-team possession-share projection consumed by `post-game-recap`; freeze Go + TS types.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore appends): append possession-time selection events; fold cumulative per-team possession time against the game clock, excluding dead-ball gaps; materialize the possession-share total.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): the optional 3-button toggle (selecting a team starts/switches its timer and disables its button, dead-ball pauses both), wired so it is fully skippable.

## Open Questions

None at this time.

---
*This document follows the https://specscore.md/plan-specification*
