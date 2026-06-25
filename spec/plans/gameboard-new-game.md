---
format: https://specscore.md/plan-specification
status: Approved
---
# Plan: Gameboard New Game

**Status:** Approved
**Source Feature:** sports/gameboard-live/new-game
**Date:** 2026-06-24
**Owner:** alex
**Supersedes:** —
**Parent:** gameboard-live

## Summary

Implements the [`new-game`](../features/sports/gameboard-live/new-game/README.md) Feature as **contract-first full-stack vertical slices**: each task freezes its backend↔frontend API contract first (TypeSpec `api4gameboard.tsp` + the `gameboard-ext/backend` Go ext-types + `@sneat/extension-gameboard-contract` TS), then splits into a **backend subtask** (`gameboard/backend`, mutations via dalgo→Firestore) and a **frontend subtask** (`@sneat/extension-gameboard-internal`) that build against the frozen shapes in parallel. The game is a **root/global** extension record at `/ext/gameboard/games/{gameID}` (it belongs to no space), with each side referencing a sneat-team team-space (`/spaces/{spaceID}`) by id or carried as an ad-hoc name. All **8** Feature ACs are covered; none deferred.

## Approach

Each task is a thin vertical slice that ships its ACs end-to-end (contract + persistence + API + UI). Within a task the order is **contract-first**:

1. **Contract** — author/extend the slice's TypeSpec in `api4gameboard.tsp` (operations + request/response models) and the shared ext-types, following the existing `sneat-go/typespec` convention; generate the Go (`gameboard-ext/backend`) + TS (`@sneat/extension-gameboard-contract`) types. This frozen contract is the integration boundary.
2. **Backend subtask** (`gameboard/backend`) and **Frontend subtask** (`@sneat/extension-gameboard-*`) then proceed **in parallel**, each implemented by its own agent against the generated types, so end-to-end integration has far fewer surprises.

A task is "done" only when both subtasks land and its ACs verify end-to-end against the contract.

**Storage model.** `gameboard` is a **root/global** extension, not space-scoped: the game aggregate lives at `/ext/gameboard/games/{gameID}` and belongs to no space. Each **team** is its own sneat space (`/spaces/{spaceID}`, via [`sneat-team`](../features/sports/sneat-team/README.md)); each side is carried **inline on the game as `{name, colour, spaceID?: null}`** — `spaceID` set for an existing team-space, `null` for an ad-hoc name (back-filled later by `first-use-backprop`). Roster/roles/consent are read from the referenced team space, never copied. All backend mutations go through **dalgo → Firestore**; the implementation is the `gameboard/backend` module over the root `/ext/gameboard/...` tree.

**Cross-plan dependency.** This plan depends on the **frozen `gameboard-event-timeline` contract** — the per-game event log hangs off the game at `/ext/gameboard/games/{gameID}/events/{eventID}`. new-game only creates the game record at `scheduled`; the lifecycle/events are owned there. We **name** (do not redefine) the substrate deps: [`calendarius`](../research/core-modules-interface.md) (the happening), [`eventus`](../features/eventus/eventus-mvp/README.md) (the thin overlay + isolated write-back port), the [`invitus`](../features/sports/gameboard-live/screens/README.md) **`link` channel** (public link / QR / game #), [`sneat-team`](../features/sports/sneat-team/README.md) (team-space identity, brand colour, roster/roles), and [`first-use-backprop`](../features/sports/first-use-backprop/README.md) (lazy materialization of durable team profiles/accounts/family edges on first real use).

**Ordering.** Slices are dependency-ordered. Task 1 establishes the account-gated game aggregate + two ad-hoc sides + the `scheduled` record (the spine everything hangs off). Task 2 adds existing-team references + per-team brand colour. Task 3 layers the creator's affiliation disclosure onto the same create contract. Task 4 makes the scheduled game a Calendarius happening and immediately shareable. Task 5 wires the deferred-materialization hand-off to first-use-backprop and the optional post-creation next-steps.

## Tasks

### Task 1: Create the account-gated scheduled game aggregate (end-to-end)

**Verifies:** sports/gameboard-live/new-game#ac:account-required-to-create, sports/gameboard-live/new-game#ac:create-with-two-names-and-time
**Depends-On:** —
**Status:** pending

The spine: a signed-in account holder creates a game from just two team names and a date/time, becoming organizer/scorer; a visitor with no account cannot.
- **Contract (TypeSpec + ext types, first):** `Game` model (id, two `TeamSide` stubs `{name}`, `scheduledAt`, `status`, `organizerID`/`scorerID`) and a `createGame` operation requiring authentication, in `api4gameboard.tsp` + the `gameboard-ext/backend` Go types + `@sneat/extension-gameboard-contract`; generate Go + TS.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore): persist the game at root `/ext/gameboard/games/{gameID}` (belongs to no space) with two ad-hoc sides and `organizerID = authenticated user`; reject unauthenticated callers. No roster, lineup, venue, or roles required.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): the create form taking two team names + date/time; the account gate (one-tap sign-in) before submit; no-account visitors are blocked from creating.

### Task 2: Pick existing teams or ad-hoc sides, with per-team brand colour (end-to-end)

**Verifies:** sports/gameboard-live/new-game#ac:ad-hoc-and-existing-sides, sports/gameboard-live/new-game#ac:sets-team-colour
**Depends-On:** 1
**Status:** pending

Each side may reference an existing sneat-team team-space or be an ad-hoc typed name, and each carries a distinguishing brand colour (defaulted, never required).
- **Contract (TypeSpec + ext types, first):** shape `TeamSide` as the canonical inline side `{name, colour, spaceID?: null}` — `spaceID` set for an existing sneat-team team-space, `null` for an ad-hoc typed name — with documented colour defaults; no roster is copied across the contract boundary.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore): store each side inline as `{name, colour, spaceID?}` — an existing side carries its `/spaces/{spaceID}` id, an ad-hoc side carries `spaceID: null`; persist each side's brand colour, defaulting to the team-space's own colour for existing sides and a sensible default for ad-hoc sides.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): a per-side picker (search existing sneat-team teams vs type a new name) plus a colour picker beside each name with sensible defaults.

### Task 3: Disclose creator affiliation on the game (end-to-end)

**Verifies:** sports/gameboard-live/new-game#ac:creator-discloses-affiliation
**Depends-On:** 1
**Status:** pending

At creation the organizer discloses their relationship to the game, recorded on the game for transparency/authority.
- **Contract (TypeSpec + ext types, first):** an `affiliation` field on `createGame` — enum `coach | player | judge | score-recorder | timekeeper | spectator`, with a required `spectatorAffiliation` (`fan-of:<side>` | `neutral`) when `spectator` is chosen; validate the conditional on the contract.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore): persist the self-declared (unverified) disclosure on the game record at `/ext/gameboard/games/{gameID}`; an official role (coach/judge/score-recorder/timekeeper) is the creator's initial game-day role claim read against the relevant team space.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): a one-tap affiliation selector with the spectator → fan-of/neutral follow-up; surfaced on the created game.

### Task 4: Schedule as a Calendarius happening and make it shareable (end-to-end)

**Verifies:** sports/gameboard-live/new-game#ac:scheduled-and-shareable
**Depends-On:** 1
**Status:** pending

A created game (with date/time and optional venue/competition) is persisted at `scheduled`, appears as a Calendarius happening, and exposes a public link, QR, and game #.
- **Contract (TypeSpec + ext types, first):** optional `venue` + `competition` on the game; a share descriptor (public `link`, `qr`, human-typable `gameNumber`) on the get-game/create-game response.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore): on create, register the game's time/place as a **calendarius** happening with a thin **eventus** overlay (via the eventus isolated write-back port), persist at `status: scheduled`, and mint the share triple via the **invitus `link` channel**, storing it on `/ext/gameboard/games/{gameID}`.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): optional venue/competition inputs; a share panel rendering the link, its QR, and the game # immediately after creation.

### Task 5: Defer materialization to first use and offer optional next steps (end-to-end)

**Verifies:** sports/gameboard-live/new-game#ac:materialization-deferred-to-first-use, sports/gameboard-live/new-game#ac:optional-next-steps
**Depends-On:** 2, 4
**Status:** pending

Creation records references/stubs only — no team profiles or accounts are eagerly created — and the organizer is offered (never required) lineup, role-invite, and share next steps.
- **Contract (TypeSpec + ext types, first):** a `materialized` marker on each side (false at `scheduled`) and the first-use trigger shape (fires when the game first goes `live` / scoreboard published); the optional next-step entry points (link to lineup, invite-role, share) as non-blocking response fields.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore): while `scheduled`, write only the game + inline sides with `spaceID: null` for ad-hoc names (no `/spaces/{spaceID}` team profile, no accounts); on the first real-use transition owned by the `gameboard-event-timeline` contract, hand off to **first-use-backprop** to materialize durable sneat-team team-space(s), **back-fill each side's previously-`null` `spaceID` with the new team-space id**, create opt-in accounts, and write club↔family edges.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): from a created game, optional CTAs to select a lineup (existing team's roster), invite a game-day role, and share — each available, none gating creation.

## Open Questions

None at this time.

---
*This document follows the https://specscore.md/plan-specification*
