---
format: https://specscore.md/plan-specification
status: Approved
---
# Plan: Gameboard Coach Console

**Status:** Approved
**Source Feature:** sports/gameboard-live/coach-console
**Date:** 2026-06-24
**Owner:** alex
**Supersedes:** —
**Parent:** gameboard-live

## Summary

Implements the [`coach-console`](../features/sports/gameboard-live/coach-console/README.md) Feature — the **request** side of the "coaches request, the table crew records/grants" authority model — as **contract-first vertical slices**. `gameboard` is a **root/global extension**: games live at `/ext/gameboard/games/{gameID}` with an append-only event log at `/ext/gameboard/games/{gameID}/events/{eventID}`; teams are sneat spaces referenced by id, with roster/roles/consent read from the team space. Each task freezes a frozen **CONTRACT** (`gameboard-ext/backend` Go + `@sneat/extension-gameboard-contract` TS + TypeSpec `api4gameboard.tsp`) and then splits into a **backend subtask** (`gameboard/backend`, mutations via dalgo→Firestore over root `/ext/gameboard/...`) and a **frontend subtask** (`@sneat/extension-gameboard-internal`) implementable by parallel subagents. All five Feature ACs are covered; none deferred.

## Approach

A coach is a **requester, not an authoritative appender**: requests are **transient proposals**, never direct event-log appends. The coach console owns no authoritative game state — it reads the frozen **event-timeline** read model for the authoritative on-court/bench fold and routes proposals to the table crew. Cross-plan dependencies (consumed, not built here): **event-timeline** (authoritative on-court/bench + per-player stat fold this console reads), **scorekeeper-console** (records substitution requests as authoritative events), **timekeeper-console** (grants timeout requests), and **players-list** (the team-internal stat list this console renders in internal mode).

Order is dependency-ordered. Task 1 establishes the **gate** (account + head/assistant-coach role) and the transient-request transport that every later request rides on — including the **per-role one-person collapse**: when the coach also holds the relevant table role, the request short-circuits to a direct record/grant on the held console rather than a proposal. Tasks 2 and 3 are the two read surfaces (authoritative on-court/bench, then the team-internal stat list with minor publish-consent honored in pickers); they depend only on the read model and the gate, so they can run in parallel after Task 1. Tasks 4 and 5 are the two request actions (substitution → scorekeeper, timeout → timekeeper); each depends on Task 1's transport and on the bench read surface (Task 2) so the coach selects against accurate state. Within every task the order is **contract-first**: freeze the TypeSpec + ext types, then build backend ∥ frontend against the generated types.

## Tasks

### Task 1: Gate coach requests and establish the transient-request transport

**Verifies:** sports/gameboard-live/coach-console#ac:coach-cannot-append
**Depends-On:** —
**Status:** pending

Authorize the console (account + head/assistant-coach role) and provide the transport that carries proposals to the table crew without appending to the event log, including the per-role one-person collapse to a direct record/grant when the coach also holds the table role.

- **Contract (TypeSpec + ext types, first):** in `api4gameboard.tsp` define the `RequestEnvelope` (game id, requesting team space id, requester account, kind: `substitution` | `timeout`, status: `pending` | `confirmed` | `declined` | `expired`) and the `request`/`list-requests`/`resolve-request` operations; mark them as **proposals** carrying no authoritative-append capability. Mirror the frozen types into `gameboard-ext/backend` (Go) and `@sneat/extension-gameboard-contract` (TS).
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore): persist transient requests under `/ext/gameboard/games/{gameID}/...` (separate from the authoritative `events/{eventID}` log — the coach path MUST NOT append there); enforce the gate by reading the requester's role from the referenced team space (`sneat-team`), rejecting non-coach accounts; implement the per-role collapse so that when the requester also holds the target table role the call resolves to a direct record/grant rather than a pending proposal.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): in `-internal`, the coach-console shell that requires sign-in + coach role to render request controls; route actions through the request transport, and when the coach holds the table role surface the direct record/grant affordance instead of the proposal handshake.

### Task 2: Render authoritative on-court and bench from the event-timeline read model

**Verifies:** sports/gameboard-live/coach-console#ac:bench-shows-authoritative-oncourt
**Depends-On:** 1
**Status:** pending

Show the authoritative on-court list and available bench (lineup + substitution events) so the coach requests against accurate state, updating live when the scorekeeper records a substitution.

- **Contract (TypeSpec + ext types, first):** in `api4gameboard.tsp` define the read shape the console consumes from the frozen event-timeline fold — `OnCourtBench` (on-court player refs, bench/roster player refs, derived from lineup + substitution events) and its subscribe/get operation; freeze into Go + TS contract packages.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore): expose a read-only projection of on-court/bench folded from `/ext/gameboard/games/{gameID}/events/{eventID}` (the scorekeeper-maintained authoritative state); no writes from this path.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): in `-shared`, an on-court/bench view bound to the projection that re-renders when new substitution events land.

### Task 3: Render the team-internal player stat list

**Verifies:** sports/gameboard-live/coach-console#ac:coach-sees-player-stats
**Depends-On:** 1
**Status:** pending

Surface the [`players-list`](../features/sports/gameboard-live/players-list/README.md) in **team-internal mode** for the coach's own team — jersey #, name, points, personal fouls with foul-trouble flag, and minutes on court — regardless of public publish-consent.

- **Contract (TypeSpec + ext types, first):** select the players-list **internal** read mode in `api4gameboard.tsp` (full per-player stat row: jersey, name, points, personal fouls, foul-trouble flag, minutes on court, folded from event-timeline + on-court intervals); freeze into Go + TS contract packages. The stat set, deterministic fold, and foul-trouble rule are owned by `players-list` — this task only selects and surfaces internal mode.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore): serve the internal-mode stat fold scoped to the coach's own team space, bypassing the *public* consent filter while still respecting team membership.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): in `-internal`, render the team-internal stat table on the bench with the foul-trouble indicator.

### Task 4: Request a substitution to the scorekeeper

**Verifies:** sports/gameboard-live/coach-console#ac:request-sub-recorded-by-scorekeeper
**Depends-On:** 1, 2
**Status:** pending

Let the coach propose an equal-count multi-player swap (off from on-court, on from bench) that only becomes an authoritative substitution event when the scorekeeper confirms — the coach console never appends it.

- **Contract (TypeSpec + ext types, first):** define `SubstitutionRequest` (off player refs, on player refs, equal-count invariant) and `request-substitution` over the Task 1 envelope in `api4gameboard.tsp`; document that confirmation is the scorekeeper's authoritative append. Freeze into Go + TS contract packages.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore): validate equal non-zero off/on counts and route the proposal to the scorekeeper-console; the authoritative substitution event is appended to `events/{eventID}` only on the scorekeeper's confirm, never by this path (except under the Task 1 per-role collapse, where a coach who also holds the scorekeeper role records directly).
- **Frontend subtask** (`@sneat/extension-gameboard-*`): in `-internal`, tap-to-select off (on-court) and on (bench) players over the Task 2 view, with submit disabled until counts match and are non-zero.

### Task 5: Request a timeout to the timekeeper

**Verifies:** sports/gameboard-live/coach-console#ac:request-timeout-granted-by-timekeeper
**Depends-On:** 1, 2
**Status:** pending

Let the coach request a timeout for their team that the timekeeper grants (decrement + countdown) — the coach console does not grant it itself.

- **Contract (TypeSpec + ext types, first):** define `TimeoutRequest` (requesting team space id) and `request-timeout` over the Task 1 envelope in `api4gameboard.tsp`; document that granting (decrement + countdown) is the timekeeper's action. Freeze into Go + TS contract packages.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore): route the timeout proposal to the timekeeper-console; the grant (remaining-timeouts decrement + countdown start, appended to `events/{eventID}`) is the timekeeper's, never this path (except under the Task 1 per-role collapse, where a coach who also holds the timekeeper role grants directly).
- **Frontend subtask** (`@sneat/extension-gameboard-*`): in `-internal`, a request-timeout control that submits the proposal and reflects pending → granted state.

## Open Questions

None at this time.

---
*This document follows the https://specscore.md/plan-specification*
