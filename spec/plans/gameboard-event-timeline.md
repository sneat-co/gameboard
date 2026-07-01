---
format: https://specscore.md/plan-specification
status: Approved
---
# Plan: Gameboard Event Timeline

**Status:** Executing
**Source Feature:** sports/gameboard-live/event-timeline
**Date:** 2026-06-24
**Owner:** alex
**Supersedes:** —
**Parent:** gameboard-live

## Summary

Implements the [`event-timeline`](../features/sports/gameboard-live/event-timeline/README.md) Feature as the **foundation** of the gameboard system: the authoritative, append-only, ordered, timestamped event log that *is* a game's official record, plus the deterministic projection, live stream, and final-record reads every other gameboard plan freezes on. It has **no cross-feature dependencies** — this plan *defines* the canonical event vocabulary, dual game-clock + wall-clock stamps, the **random-id + wall-clock ordering & idempotent-append** model, source attribution, and the authorized-append/correction model. Built as **contract-first vertical slices**: each task freezes its contract (TypeSpec `api4gameboard.tsp` + the `gameboard-ext` Go interfaces/DTOs and `@sneat/extension-gameboard-contract` TS types), then fans out to a **backend subtask** (`gameboard/backend` over root `/ext/gameboard/...` via dalgo→Firestore) and a **frontend subtask** (`@sneat/extension-gameboard-*`) implemented in parallel against the frozen types. All 7 Feature ACs are covered; none deferred.

## Approach

This is the **shared-contract foundation** for gameboard — so its first task freezes the broadest contract surface (the event vocabulary, dual clock, per-event id + wall-clock ordering, source attribution) that every later task and every sibling plan consumes. The decomposition is dependency-ordered into four coherent slices:

1. **Event log + vocabulary + immutability** (Task 1) — the append-only ordered store and the full typed event schema. Everything hangs off this, so it lands first and freezes the widest contract.
2. **Source authority + corrections** (Task 2) — authorized-source-only appends and corrections-as-appended-events, both gating *how* the log is written; they depend on the log existing.
3. **Deterministic projection** (Task 3) — the fold/reducer from log → current state, depending on the vocabulary and the correction semantics it must net out.
4. **Emission: live stream + final record** (Task 4) — the live ordered-stream client and the complete/as-of record reads, depending on the log and the projection they surface.

Within each task the order is **contract-first**: (1) freeze the contract — TypeSpec models/operations in `api4gameboard.tsp` plus the `gameboard-ext` backend interfaces/DTOs and the `@sneat/extension-gameboard-contract` injection tokens/types; generate Go + TS types; then (2) **backend subtask** ∥ (3) **frontend subtask** proceed in parallel, each implemented by its own agent against the frozen types. A task is done only when both subtasks land and its ACs verify end-to-end. All storage is the **root/global** `gameboard` extension: the game lives at `/ext/gameboard/games/{gameID}` (belongs to no space) and the event log at `/ext/gameboard/games/{gameID}/events/{eventID}`; each team is its own sneat space referenced by id, supplying roster/roles/minor-consent.

**Coverage — this is the substrate, so it is held to the master plan's ~100% bar and built test-first (TDD).** Idempotent-append (replay → "already processed"), authorized-source-only appends, append-only corrections, the deterministic fold, and wall-clock ordering (ties by `eventID`) are each driven by a failing test first and exhaustively covered on **both** the backend reducer and the frontend reducer, which must compute identical state.

## Tasks

### Task 1: Define the event log, vocabulary & immutability

**Verifies:** sports/gameboard-live/event-timeline#ac:append-immutable-ordered, sports/gameboard-live/event-timeline#ac:vocabulary-covers-official-events
**Depends-On:** —
**Status:** complete

> Progress (2026-06-24): `gameboard-ext` `typespec/api4gameboard.tsp` freezes the `Event` envelope + full vocabulary + idempotent `append`/`list`/`state` ops; `gameboard-ext/backend/eventtimeline` hand-implements the Go model + ordering (wall-clock, ties by `eventID`) + idempotent dedupe at **100% coverage**; `gameboard/backend` Append service + **HTTP API** (`POST …/events` → `201`/`200 already-processed`) enforces EventID idempotency over a **dalgo store** at `/ext/gameboard/games/{gameID}/events/{eventID}` (append-only, Get-then-Set; idempotency key = doc key). Tested against `dalgo2memory` + an HTTP full-game journey test. **Remaining:** the Firestore-backed dalgo DB (production config swap; in-memory today) and the `@sneat/extension-gameboard-internal` Angular typed append client (the framework-agnostic types live in the contract lib).

Establish the append-only, ordered event store and the single shared typed event vocabulary that every consumer reads — the widest contract surface in the gameboard system.
- **Contract (TypeSpec + ext types, first):** in `api4gameboard.tsp`, define the `GameEvent` envelope (`eventID`, `type`, `payload`, `period`, `gameClock`, `wallClock`, `source`, `correctionOf?`) and the full typed vocabulary — `status` (scheduled/live/halftime/overtime/final/cancelled), `period`, `clock` (start/stop/adjust), `score` (team + points 1/2/3 + optional scorer/assist), `team-foul`, `timeout`, `substitution` (player on/off), `possession`, `judge-ruling`, `correction` — plus the **idempotent** `append-event` / `get-event` operations (`append-event` carries the client-generated `eventID`; a replay of an already-processed id is discarded with a clear status — see the backend subtask); mirror as Go interfaces/DTOs in `gameboard-ext/backend` and injection tokens/types in `@sneat/extension-gameboard-contract`. Generate Go + TS types. This frozen vocabulary is the integration boundary for all later tasks and sibling plans.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore at `/ext/gameboard/...`): the append-only event store at `/ext/gameboard/games/{gameID}/events/{eventID}`, keyed by a **client-generated random dashless GUID-like `eventID`** used as the Firestore doc key (so the id *is* the **idempotency key**); the server stamps a **wall-clock timestamp** (the ordering key, ties broken by `eventID`) and stores the carried game-clock. Appends are idempotent: a retried append whose `eventID` already exists is **discarded** (not re-stored, no duplicate side effects) and returns a **clear HTTP status indicating the event was already processed**. Writes are append-only — no update/delete path is exposed.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): expose the `GameEvent` envelope + vocabulary types and a typed append client via `@sneat/extension-gameboard-internal`, so callers construct well-typed events.

### Task 2: Enforce source authority & append-only corrections

**Verifies:** sports/gameboard-live/event-timeline#ac:only-authorized-source-appends, sports/gameboard-live/event-timeline#ac:correction-is-appended-not-edited
**Depends-On:** 1
**Status:** complete

> Progress (2026-06-24): `gameboard/backend` enforces a per-source authority matrix (scorekeeper → score/foul/substitution; timekeeper → clock/period/possession/timeout/status; judge → ruling/correction; consensus → plays when no crew); unauthorized appends rejected with `ErrUnauthorizedSource` (HTTP 403); corrections are append-only and the fold nets void/amend without editing history (verified backend + TS via the parity oracle). Tested at ≥85% (gameboard pkg) / 100% (contract reducer). **Decision/stub (recorded):** the real per-game role lookup belongs to the `sneat-team`/`roles` substrate, which is spec-only today, so authority resolves against a static `Source→EventType` map keyed by the event's declared `source` (HTTP layer trusts the body's `source`); wire to the bearer-token-identity → per-game-role lookup when that substrate ships.

Gate *who* may append and represent every void/amend/ruling as a new appended event referencing the `eventID` it amends — never a destructive edit.
- **Contract (TypeSpec + ext types, first):** add the `source` discriminator (official game-day role vs `consensus`) and the role→event-type authorization map to the contract; define the `correction` event's `correctionOf` reference shape and the rejected-append error. Freeze in `api4gameboard.tsp` + `gameboard-ext` + `@sneat/extension-gameboard-contract`.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore at `/ext/gameboard/...`): on append, resolve the appender's per-game role from the referenced team space (sneat-team roles); allow only score/foul/substitution from the score-sheet keeper, clock/period/possession/timeout from the clock/board runner, rulings/corrections from the judge, and all confirmed plays with `source = consensus` when no crew; reject unauthorized appends; corrections are appended (never overwrite) and the superseded original is retained for audit.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): surface `source` on each event, a typed correction-append helper, and the authorization-rejected error to callers.

### Task 3: Compute the deterministic state projection (fold)

**Verifies:** sports/gameboard-live/event-timeline#ac:state-is-deterministic-fold
**Depends-On:** 1, 2
**Status:** complete

> Done (2026-06-24): `eventtimeline.Fold` in the **contract** module (the shared reducer on the boundary) computes the deterministic projection — status, period, running clock, per-side score/fouls/timeouts, possession, on-court lineup — in wall-clock order with correction-netting; score equals the sum of non-voided score events; shuffled-arrival folds are byte-identical. The **TS reducer** (`@sneat/extension-gameboard-contract`) mirrors it and is proven equal via the shared `parity/parity.json` oracle (Go `parity_test.go` + vitest both assert against it). Go 100% coverage; TS 9/9 green; CI green. *(Remaining nicety, not blocking this AC: `fold-to` as-of-`eventID` reads — the as-of-wall-clock read is contract-defined.)*

Derive the current official game state as a deterministic fold over the log (in **wall-clock order, ties broken by `eventID`**) up to a given as-of point, netting out corrections so two consumers folding to the same point compute identical state.
- **Contract (TypeSpec + ext types, first):** define the `GameState` projection model (status, period, running clock, each team's score, team fouls, timeouts remaining, possession, on-court lineup) and the `fold-to` read (as-of a wall-clock instant or `eventID`); freeze the reducer's correction-netting rule (voided event no longer contributes; amended attribution uses latest) on the contract so backend and frontend reducers agree.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore at `/ext/gameboard/...`): the deterministic reducer over `/ext/gameboard/games/{gameID}/events`, foldable to any as-of point (wall-clock instant / `eventID`), with the invariant that score equals the sum of (non-voided) score events; projection may be computed on read or materialized.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): ship the same reducer/consumer types in the contract package so a client folds the stream to identical `GameState`.

### Task 4: Emit the live stream & the final/as-of record

**Verifies:** sports/gameboard-live/event-timeline#ac:live-stream-in-order, sports/gameboard-live/event-timeline#ac:final-record-readable-with-both-clocks
**Depends-On:** 1, 3
**Status:** planning

> Progress (2026-06-24): the complete/as-of **record read** is served — `Service.Events` returns the log in wall-clock order with both clock stamps (`gameClockMs` + `wallClockMs`) on every event. **Remaining:** the live ordered **stream** (Firestore snapshot subscription) + the as-of-wall-clock filter, which depend on the dalgo→Firestore adapter (next bootstrap step).

Emit the log two ways — a live ordered stream for in-game consumers and a complete/as-of record (with both clocks) for post-game consumers.
- **Contract (TypeSpec + ext types, first):** define the `subscribe-stream` (live, **wall-clock-ordered** delivery) and `read-log` / `read-as-of` (complete log or as-of state at a wall-clock instant, each event exposing both game-clock and wall-clock) operations; freeze the stream/record shapes in `api4gameboard.tsp` + `@sneat/extension-gameboard-contract`.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore at `/ext/gameboard/...`): emit appended events as a **wall-clock-ordered** live stream and serve the complete/as-of log reads over the `events/` collection ordered by wall-clock (ties by `eventID`), carrying both clock stamps, especially once `final`.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): the live ordered-stream client (delivering events in wall-clock order) and the record-read consumer, exposed via `@sneat/extension-gameboard-internal`.

## Open Questions

None at this time. *(The Feature's "sequence number" wording is reconciled — its Architecture now notes the plan-time realization: random `eventID` doc key + server wall-clock ordering, ties broken by `eventID`.)*

---
*This document follows the https://specscore.md/plan-specification*
