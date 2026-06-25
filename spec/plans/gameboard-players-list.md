---
format: https://specscore.md/plan-specification
status: Approved
---
# Plan: Gameboard Players List

**Status:** Approved
**Source Feature:** sports/gameboard-live/players-list
**Date:** 2026-06-24
**Owner:** alex
**Supersedes:** —
**Parent:** gameboard-live

## Summary

Implements the [`players-list`](../features/sports/gameboard-live/players-list/README.md) Feature as **contract-first vertical slices**. The list is a **pure projection that owns no state**: a deterministic read-side fold over the frozen `event-timeline` projection (points/fouls), `play-time` on-court intervals (minutes), and `sneat-team` roster + minor publish-consent. Each task first **freezes its contract** (TypeSpec `api4gameboard.tsp` + the Go `gameboard-ext/backend` types + the TS `@sneat/extension-gameboard-contract`), then splits into a **backend subtask** (`gameboard/backend`, a dalgo→Firestore read-fold over root `/ext/gameboard/games/{gameID}` and its `events/{eventID}` log) and a **frontend subtask** (`@sneat/extension-gameboard-internal`, the one shared list component reused by `coach-console`, `spectator-screen`, and `post-game-recap`). All six Feature ACs are covered; none deferred.

## Approach

The list is a fold, so the integration boundary is the **list DTO** — once its shape (jersey #, name, points, personal fouls, foul-trouble flag, on-court minutes), its **consent-mode parameter** (`public` vs `team-internal`), and its **ordering rule** are frozen in the contract, backend and frontend proceed in parallel against generated types. Within each task the order is contract-first: (1) **Contract** freeze, then (2) **Backend subtask** ∥ (3) **Frontend subtask**.

Cross-plan dependencies the fold consumes (not owned here): the **frozen `event-timeline` fold** (the official points/fouls record), [`play-time`](../features/sports/play-stats/play-time/README.md) **intervals** (substitution events × game clock, for minutes), and **`sneat-team` consent** (roster + minor publish-consent). This plan reads those projections; it does not modify them.

Slices are dependency-ordered. **Task 1** establishes the core fold + DTO + the default live/operational ordering — everything else extends it. **Task 2** adds the foul-trouble derivation on the same fold. **Task 3** layers consent-mode gating (public vs team-internal) onto the DTO. **Task 4** adds the box-score ordering variant (the recap surface) and pins the capture-bound column set. Tasks 2–4 all depend on Task 1's frozen DTO; the capture-bound guard (Task 4) is verified once the full column set exists.

## Tasks

### Task 1: Fold the core per-player stat list with live/operational ordering

**Verifies:** sports/gameboard-live/players-list#ac:per-player-fold, sports/gameboard-live/players-list#ac:ordered-by-number
**Depends-On:** —
**Status:** pending

The deterministic core fold: each player's jersey #, name, points, personal fouls, and on-court minutes, working live and as a final box score, ordered for live/operational surfaces.
- **Contract (TypeSpec + ext types, first):** the `PlayerStatRow` DTO (jersey #, name, points, personalFouls, minutesOnCourt) and the list-players operation in `api4gameboard.tsp`; the **default ordering rule** = ascending numeric jersey, un-numbered last by name, applied within on-court/bench groups when a surface groups them. Generate Go (`gameboard-ext/backend`) + TS (`@sneat/extension-gameboard-contract`).
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore read-fold): the deterministic fold over the `event-timeline` projection (points/fouls) + `play-time` on-court intervals (minutes), read from root `/ext/gameboard/games/{gameID}/events/{eventID}`; identical on recompute, live and final; emits rows in the default order.
- **Frontend subtask** (`@sneat/extension-gameboard-internal`): the shared players-list component rendering the DTO rows in contract order, reused by all three consumer surfaces.

### Task 2: Derive the foul-trouble indicator

**Verifies:** sports/gameboard-live/players-list#ac:foul-trouble-flag
**Depends-On:** 1
**Status:** pending

Surface a foul-trouble flag as a player nears the disqualification limit (e.g. one foul away) — the primary live coaching/viewer signal.
- **Contract (TypeSpec + ext types, first):** add a `foulTrouble` boolean (and the threshold-distance basis) to the `PlayerStatRow` DTO.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore read-fold): derive the flag from the same personal-foul fold against the disqualification limit; deterministic on recompute.
- **Frontend subtask** (`@sneat/extension-gameboard-internal`): render the foul-trouble indicator on flagged rows in the shared component.

### Task 3: Gate the list by consent mode (public vs team-internal)

**Verifies:** sports/gameboard-live/players-list#ac:public-vs-internal-consent
**Depends-On:** 1
**Status:** pending

The single consent rule the list owns: a minor without publish-consent is shown by jersey number only in public mode, while team-internal mode (the coach's own team) shows full stats.
- **Contract (TypeSpec + ext types, first):** the **consent-mode parameter** (`public` | `team-internal`) on the list operation, and the DTO's "jersey-only" redacted shape for a consent-gated minor.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore read-fold): read minor publish-consent from the `sneat-team` space space (roster/roles); in `public` mode redact a non-consenting minor to jersey-only; in `team-internal` mode (caller's own team) return full stats regardless of public consent.
- **Frontend subtask** (`@sneat/extension-gameboard-internal`): consumers pass the mode (spectator/recap → public, coach-console → team-internal); the shared component renders the redacted row correctly.

### Task 4: Add box-score ordering and pin the capture-bound column set

**Verifies:** sports/gameboard-live/players-list#ac:box-score-ordered-by-points, sports/gameboard-live/players-list#ac:no-uncaptured-stat
**Depends-On:** 1
**Status:** pending

The final box-score surface orders by points → assists → minutes (descending), and the whole list is pinned to capture-bound columns only.
- **Contract (TypeSpec + ext types, first):** a **box-score ordering** parameter (points, then assists, then minutes, all descending; jersey breaks ties) selectable by the recap surface; freeze the column set to captured stats only (points, assists, fouls, minutes) — no +/-, shooting %, turnovers, or rebounds/steals/blocks fields exist in the DTO.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore read-fold): the box-score sort over the same fold (assists from the optional per-score-event assist); deterministic on recompute; no uncaptured stat is computed or returned.
- **Frontend subtask** (`@sneat/extension-gameboard-internal`): the `post-game-recap` consumer requests box-score ordering; the shared component renders only the capture-bound columns.

## Open Questions

None at this time.

---
*This document follows the https://specscore.md/plan-specification*
