---
format: https://specscore.md/plan-specification
status: Approved
---
# Plan: Gameboard Scorekeeper Console

**Status:** Approved
**Source Feature:** sports/gameboard-live/scorekeeper-console
**Date:** 2026-06-24
**Owner:** alex
**Supersedes:** —
**Parent:** gameboard-live

> **Status (gameboard repo, 2026-06-26):** Backend is **live in prod** (via sneat-go). This **frontend surface was part of the deleted 1st-gen app and was not ported** to the current Nx + Ionic app — it is **to be rebuilt** on the current scaffolding (Slice 2, console). See the master plan's [Frontend Reality & Rebuild](./gameboard-live.md) section; verified by a **real-stack full-cycle E2E** (UI → API → `gameboardd` → Firestore emulator → fold) that extends the full-game lifecycle chain (see the master plan's Testing strategy); reference spec: [`docs/legacy-mvp-frontend/e2e/full-game.spec.ts`](../../docs/legacy-mvp-frontend/e2e/full-game.spec.ts).

## Summary

Implements the [`scorekeeper-console`](../features/sports/gameboard-live/scorekeeper-console/README.md) Feature as **contract-first full-stack vertical slices**. Each task first freezes its API contract — TypeSpec (`api4gameboard.tsp`) plus the shared `gameboard-ext` extension types (`gameboard-ext/backend` Go + `@sneat/extension-gameboard-contract` TS) — then splits into a **backend subtask** (`gameboard/backend`, appending authoritative score/foul/substitution events to the event log at `/ext/gameboard/games/{gameID}/events/{eventID}` via dalgo→Firestore) and a **frontend subtask** (`@sneat/extension-gameboard-internal`) implemented in parallel against the frozen types. All 7 Feature ACs are covered; none deferred.

## Approach

Each task is a thin vertical slice shipping its ACs end-to-end. The **cross-plan dependency** is load-bearing: this console does not own the log primitive — it consumes the already-**frozen `gameboard-event-timeline` append contract** (the authoritative event-log append at `/ext/gameboard/games/{gameID}/events/{eventID}`) and the **roles / account-gate** authority check. Every write here is an authorized append onto that timeline; on-court state is the deterministic fold of the game lineup plus substitution events on it. The console owns input, never history rewrite.

Within a task the order is **contract-first**:

1. **Contract** — author/extend the slice's event payloads in `api4gameboard.tsp` and the `gameboard-ext` types (Go + TS). This frozen contract is the integration boundary between backend and frontend.
2. **Backend subtask** ∥ **Frontend subtask** — each implemented by its own agent against the generated/frozen types, in parallel.

A task is done only when both subtasks land and its ACs verify end-to-end against the contract.

Order is dependency-ordered. The **authority gate (Task 1)** comes first — nothing may write without an account + the score-sheet-keeper role, so it underpins every later append. **Basket attribution (Task 2)** establishes the on-court picker and the score-event append. **Substitution / on-court management (Task 3)** is the on-court mutation primitive — both the standalone swap and the incoming coach-request confirm — and the **inline scorer-not-on-court (Task 4)** flow composes it with Task 2's attribution. **Fouls + bonus (Task 5)** and **on-court authority precedence (Task 6)** are independent reads/writes over the same gated log. Teams are sneat spaces (`/spaces/{spaceID}`) referenced by id; roster/roles/consent are read from the team space (sneat-team).

## Tasks

### Task 1: Gate the console on account + score-sheet-keeper role

**Verifies:** sports/gameboard-live/scorekeeper-console#ac:console-requires-account-and-role
**Depends-On:** —
**Status:** planning

Operating the console requires a sneat.app account and the score-sheet-keeper game-day role; the write boundary accepts an authorized scorekeeper's appends and refuses everyone else.
- **Contract (TypeSpec + ext types, first):** in `api4gameboard.tsp`, define the authorization envelope for every scorekeeper append (game id, actor account, asserted game-day role) and the refusal response; freeze the score-sheet-keeper role constant in `gameboard-ext` (Go + `@sneat/extension-gameboard-contract`), consuming the frozen `gameboard-event-timeline` `source-authority` shape.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore appends to the event log): enforce account + score-sheet-keeper role (read from the team space via sneat-team `roles`) at the append boundary onto `/ext/gameboard/games/{gameID}/events`; reject unauthenticated or unauthorized writes.
- **Frontend subtask** (`@sneat/extension-gameboard-internal`): gate console entry/operation on sign-in + the role, surfacing a sign-in / not-authorized state for users lacking it.

### Task 2: Record an attributed basket (FT/2/3 + scorer + optional assist)

**Verifies:** sports/gameboard-live/scorekeeper-console#ac:record-attributed-basket
**Depends-On:** 1
**Status:** planning

The scorekeeper records a basket for a team by point value and attributes it to an on-court scorer with an optional on-court assist, increasing the projected score.
- **Contract (TypeSpec + ext types, first):** define the `ScoreEvent` payload (team space id, points ∈ {1,2,3}, scorer player ref, optional assist player ref) in `api4gameboard.tsp` + `gameboard-ext`, plus the record-basket append operation over the frozen event-timeline append.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore appends to the event log): append the score event to `/ext/gameboard/games/{gameID}/events`; the projection fold raises the team score by the points value.
- **Frontend subtask** (`@sneat/extension-gameboard-internal`): the FT/2/3 point pad with a scorer picker from the team's on-court list and an optional assist picker (minor publish-consent honoured).

### Task 3: Manage on-court via substitution (standalone + confirm coach request)

**Verifies:** sports/gameboard-live/scorekeeper-console#ac:substitution-swaps-on-court, sports/gameboard-live/scorekeeper-console#ac:confirm-coach-substitution-request
**Depends-On:** 1
**Status:** planning

The console maintains the authoritative on-court list as the fold of lineup + substitution events: an equal-count out/in swap that cannot confirm while counts differ, and confirming a pre-selected incoming coach substitution request.
- **Contract (TypeSpec + ext types, first):** define the `SubstitutionEvent` payload (team space id, players-out refs, players-in refs) and both the standalone-swap and confirm-coach-request append operations in `api4gameboard.tsp` + `gameboard-ext`; specify the equal-count confirm precondition.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore appends to the event log): append a substitution event per pair onto the event log; reject unequal out/in counts; the on-court fold reflects the swap. The coach-request confirm records the same authoritative substitution event.
- **Frontend subtask** (`@sneat/extension-gameboard-internal`): multi-select out/in substitution UI (confirm disabled while counts differ; add-from-roster where sneat-team allows) and a load-incoming-coach-request view that pre-selects exactly the coach's players for one-tap confirm.

### Task 4: Resolve scorer-not-on-court with an inline substitution

**Verifies:** sports/gameboard-live/scorekeeper-console#ac:score-for-subbed-in-player
**Depends-On:** 2, 3
**Status:** planning

When the scorer taps a basket for a player not on the on-court list, the console folds a substitution into the scoring flow, then attributes the basket to the now-on-court scorer.
- **Contract (TypeSpec + ext types, first):** specify the inline flow as the composition of Task 3's `SubstitutionEvent` append followed by Task 2's `ScoreEvent` append (no new event type) and document the ordering guarantee in `api4gameboard.tsp` + `gameboard-ext`.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore appends to the event log): accept the substitution append then the score append; the on-court list updates before attribution so the scorer is valid.
- **Frontend subtask** (`@sneat/extension-gameboard-internal`): the inline prompt — pick who they replaced (from on-court) or add from roster/off-court — that updates the on-court list, then attributes the pending basket.

### Task 5: Record fouls with team-foul bonus

**Verifies:** sports/gameboard-live/scorekeeper-console#ac:foul-increments-and-bonus
**Depends-On:** 1
**Status:** planning

An individual foul on an on-court player increments that player's personal foul count and the team foul count; the projection shows the opponent in the bonus once the team-foul limit is reached.
- **Contract (TypeSpec + ext types, first):** define the `FoulEvent` payload (team space id, fouling player ref) and the record-foul append operation in `api4gameboard.tsp` + `gameboard-ext`. The team-foul-limit/bonus **projection rule** (threshold + per-period reset) is owned by the [`gameboard-scoreboard`](gameboard-scoreboard.md) read-fold and referenced here — this console only appends the `FoulEvent`.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore appends to the event log): append the foul event; the fold increments personal + team foul counts and flips the opponent into bonus/penalty at the limit.
- **Frontend subtask** (`@sneat/extension-gameboard-internal`): per-player foul entry showing personal foul counts, team foul count, and the bonus/penalty indicator.

### Task 6: Make on-court authoritative over private play-time

**Verifies:** sports/gameboard-live/scorekeeper-console#ac:on-court-is-authoritative
**Depends-On:** 3
**Status:** planning

The on-court state recorded here is authoritative: when it diverges from a private play-time report, the official substitution takes precedence and play-time reconciles to it.
- **Contract (TypeSpec + ext types, first):** expose the authoritative on-court fold (the deterministic projection of lineup + substitution events) as the canonical read in `api4gameboard.tsp` + `gameboard-ext`, marked as the `official-substitution-precedence` source for play-time.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore appends to the event log): serve the official on-court fold from the event log as the precedence source; play-time defers to it rather than appending here.
- **Frontend subtask** (`@sneat/extension-gameboard-internal`): surface the authoritative on-court list as the canonical read consumed where play-time's crowd/private accounting would otherwise diverge.

## Open Questions

None at this time.

---
*This document follows the https://specscore.md/plan-specification*
