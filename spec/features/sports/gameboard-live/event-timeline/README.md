---
format: https://specscore.md/feature-specification
status: Approved
---

# Feature: Event Timeline

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/event-timeline?op=explore) | [Edit](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/event-timeline?op=edit) | [Ask question](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/event-timeline?op=ask) | [Request change](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/event-timeline?op=request-change) |
**Status:** Approved
**Date:** 2026-06-24
**Owner:** alex
**Source Ideas:** sneat-sports
**Supersedes:** —
**Grade:** A

## Summary

The authoritative, **append-only, ordered, timestamped event log** that *is* a game's official record — the canonical substrate that [`scoreboard`](../scoreboard/README.md), [`gameboardlive-bot`](../gameboardlive-bot/README.md), [`learn-to-score`](../learn-to-score/README.md), [`consensus-scoring`](../consensus-scoring/README.md), [`play-stats`](../../play-stats/README.md) and [`play-time`](../../play-stats/play-time/README.md) all consume. Every official state change is an **immutable event** (status, period, clock, score + attribution, team foul, timeout, substitution, possession, judge ruling, correction) carrying a monotonic **sequence number**, **both a game-clock and a wall-clock** stamp, and its **source** (an official game-day role per [`roles`](../../sneat-team/roles/README.md), or consensus). The **current game state is a deterministic projection (fold)** over the log; corrections and rulings are **appended, never destructive**. The log is **emitted two ways**: a **live ordered stream** for in-game consumers and a **complete as-of/final record** for post-game consumers. This is the data substrate — **not** the user-facing play-by-play view (still deferred). Concept: [`spec/ideas/sneat-sports.md`](../../../../ideas/sneat-sports.md).

## Problem

Several features need *the same thing*: an authoritative, timestamped account of what happened in a game. `learn-to-score` grades a shadow session against the official transitions; `play-time` builds on-court intervals from substitution/period events; `consensus-scoring` cross-checks against the official record (and, with no official crew, *produces* it); `play-stats` reconciles against it; `scoreboard` and `gameboardlive-bot` render/deliver it. Today the official record is scattered — `scoreboard` captures scoring events but no timestamped clock/period-transition log exists — so each consumer would have to invent its own. This Feature defines that record **once**, as an event-sourced log with a clear authority and correction model, so every consumer reads one schema.

## Behavior

### The log

#### REQ: event-log

Each game MUST have a single **append-only, ordered event log**. Every entry is an **immutable event** carrying: a **monotonic sequence number** (total order within the game), an event **type** and **payload**, the **game clock** at the moment (period + remaining time), a **wall-clock timestamp**, and a **source** (the appending game-day role or `consensus`). Once written, an event MUST NOT be mutated or deleted; the log is the authoritative record of the game.

### Event vocabulary

#### REQ: event-vocabulary

The Feature MUST define the full official event vocabulary, with each owning feature populating its slice: **status** (scheduled / live / halftime / overtime / final / cancelled), **period** transition, **clock** (start / stop / adjust), **score** (team, points 1/2/3, optional scorer + assist), **team-foul**, **timeout**, **substitution** (player on / off), **possession**, **judge-ruling**, and **correction** (void/amend referencing a prior event's sequence number). The vocabulary MUST be the single schema all consumers rely on.

### Projection

#### REQ: state-projection

The **current official game state** — status, period, running clock, each team's score, team fouls, timeouts remaining, possession, and on-court lineup — MUST be derivable as a **deterministic fold** over the log up to a given sequence number. The [`scoreboard`](../scoreboard/README.md) renders this projection; a game's score MUST equal the fold of its score events. Two consumers folding the same log to the same sequence number MUST obtain identical state.

### Corrections & rulings

#### REQ: append-only-corrections

Corrections, voids, and judge rulings MUST be expressed as **new appended events** referencing the sequence number they amend — never by editing history. The projection MUST reflect the net effect (a voided event no longer contributes; an amended attribution uses the latest). The full history, including superseded events, MUST be retained for audit and replay. (`consensus-scoring`'s `suggest-to-scorer` *accept* and a judge override are both just appended events.)

### Source & authority

#### REQ: source-authority

Every event MUST record its **source**, and only authorized sources MAY append, per the per-game assignments in [`roles`](../../sneat-team/roles/README.md): the **score-sheet keeper** (via the [`scorekeeper-console`](../scorekeeper-console/README.md)) appends **score, foul, and substitution** events — coaches *request* substitutions, the score-sheet keeper records them; the **clock/board runner** (via the [`timekeeper-console`](../timekeeper-console/README.md)) appends **clock, period, possession, and timeout** events; the **judge** appends rulings and corrections. A one-person table crew MAY hold both console roles. When a game has **no official crew**, [`consensus-scoring`](../consensus-scoring/README.md) is the authorized source and its confirmed plays are appended with `source = consensus`. An unauthorized append MUST be rejected.

### Emission — live

#### REQ: live-emission

Consumers MUST be able to **subscribe to the log as a live, ordered stream**, receiving each event as it is appended, so the scoreboard, `gameboardlive-bot`, and live views stay current. Events MUST be delivered in sequence order; the live freshness/staleness signalling itself is owned by [`scoreboard`](../scoreboard/README.md).

### Emission — record

#### REQ: record-access

Consumers MUST be able to **read the complete log (or the as-of state at any sequence number)** for a game, especially once `final`, carrying both the game-clock and wall-clock stamps — so post-game consumers ([`learn-to-score`](../learn-to-score/README.md) timing/score grading, [`play-time`](../../play-stats/play-time/README.md) intervals, [`play-stats`](../../play-stats/README.md) reconciliation) can diff and derive deterministically.

## Architecture

Grounded in the existing substrate — see [`spec/research/core-modules-interface.md`](../../../../research/core-modules-interface.md).

- **Storage:** an append-only child collection of the `sports` game aggregate — `/spaces/{spaceID}/ext/sports/games/{gameID}/events/{seq}` — ordered by sequence number; each event document holds `{seq, type, payload, period, gameClock, wallClock, source, correctionOf?}`. Final layout is a plan-time decision.
- **Projection:** a deterministic reducer folds events into current state; the projection MAY be materialized (as the scoreboard's live state doc) or computed on read. `scoreboard`'s scoring events are the **score-typed** entries of this log — whether they physically live in this `events/` collection or in `scoreboard`'s own collection is a plan-time reconciliation (see Open Questions).
- **Authority:** the appending source is checked against the game's per-game `roles` assignments; with no crew, `consensus-scoring` is the authorized appender (`source = consensus`).
- **Dual clock + ordering:** every event carries the game clock (period + remaining), a wall-clock timestamp (server-assigned), and a total order that holds even when the game clock is stopped or adjusted. (The "sequence number" above denotes that *total-order guarantee*, not a mandated counter — see the plan-time realization note below.)
- **Plan-time realization (storage + identity).** The `events/{seq}` path and monotonic counter shown here are illustrative; the implementing [`gameboard` plans](../../../../plans/gameboard-event-timeline.md) make the binding decision: the log lives at the **root/global** `/ext/gameboard/games/{gameID}/events/{eventID}`, where `eventID` is a **client-generated random dashless id** used as the doc key (and as an **idempotency key** — a replayed append is discarded with an "already processed" status), and total order is provided by the **server wall-clock timestamp, ties broken by `eventID`**. Wherever this Feature says "sequence number," read it as that ordering guarantee.
- **Emission:** live consumers subscribe (e.g. Firestore snapshot listeners or a pub/sub feed); post-game consumers read the complete log / as-of fold. The transport mechanism is a plan-time decision.

## Interaction with Other Features

- **[`gameboard-live`](../README.md)** (parent) — owns the game aggregate; its `live-score-clock` actions become clock/period/status/score events on this log.
- **[`scoreboard`](../scoreboard/README.md)** — renders the projection; its captured scoring/foul/timeout/possession events are entries here.
- **[`consensus-scoring`](../consensus-scoring/README.md)** — alternate authorized source when no official crew; also cross-checks against this record.
- **[`play-time`](../../play-stats/play-time/README.md)** — substitution + period events here drive on-court intervals.
- **[`learn-to-score`](../learn-to-score/README.md)** — the official answer key it grades shadow sessions against (this Feature satisfies its named dependency).
- **[`play-stats`](../../play-stats/README.md)** — reconciles shared books against this record.
- **[`roles`](../../sneat-team/roles/README.md)** — defines the per-game roles whose assignments authorize appends.
- **[`gameboardlive-bot`](../gameboardlive-bot/README.md)** — derives notifications from emitted events.

## Acceptance Criteria

### AC: append-immutable-ordered (verifies REQ:event-log)

**Given** a live game,
**When** the score-sheet keeper records a 2-point score and then the clock/board runner stops the clock,
**Then** two events are appended with increasing sequence numbers, each carrying type, payload, game-clock, wall-clock, and source, and neither event can subsequently be mutated or deleted.

### AC: vocabulary-covers-official-events (verifies REQ:event-vocabulary)

**Given** the event vocabulary,
**When** a game progresses through status, period, clock, score, team-foul, timeout, substitution, possession, a judge ruling, and a correction,
**Then** each is representable as a typed event in the single shared schema, and a correction event references the sequence number it amends.

### AC: state-is-deterministic-fold (verifies REQ:state-projection)

**Given** an event log for a game,
**When** two independent consumers fold it to the same sequence number,
**Then** they compute identical current state (status, period, clock, scores, fouls, timeouts, possession, on-court), and the score equals the sum of score events.

### AC: correction-is-appended-not-edited (verifies REQ:append-only-corrections)

**Given** a score event later found to be wrong,
**When** the judge appends a void/correction referencing that event's sequence number,
**Then** the projection no longer counts the original (or counts the amended value), the original event remains in the log for audit, and no history was edited in place.

### AC: only-authorized-source-appends (verifies REQ:source-authority)

**Given** a game with an assigned score-sheet keeper and clock/board runner,
**When** the score-sheet keeper appends a score event and an unauthorized user attempts to append one,
**Then** the authorized append succeeds with its source recorded and the unauthorized append is rejected; and for a game with no official crew, consensus-confirmed plays are appended with `source = consensus`.

### AC: live-stream-in-order (verifies REQ:live-emission)

**Given** a consumer subscribed to a live game's log,
**When** events are appended,
**Then** the consumer receives them in sequence order as they occur, keeping the scoreboard/bot current.

### AC: final-record-readable-with-both-clocks (verifies REQ:record-access)

**Given** a finished game,
**When** learn-to-score and play-time read the complete log,
**Then** each event exposes both its game-clock and wall-clock stamps and the events are totally ordered, enabling deterministic grading and interval derivation.

## Not Doing / Out of Scope

Inherited from the [`sneat-sports`](../../../../ideas/sneat-sports.md) Idea plus spec-level cuts:

- **The user-facing play-by-play timeline view** — this Feature is the event *data*; the rendered timeline view remains deferred (at `gameboard-live`).
- **Aggregate statistics and leaderboards** — owned by `play-stats`; this Feature only provides the events they fold.
- **The scoring/clock/substitution input UIs** — owned by `gameboard-live`/`scoreboard`/`play-time`; this Feature owns the record they append to, not the controls.
- **The realtime transport choice** (snapshot listeners vs pub/sub) and offline-queue mechanics — plan-time decisions.
- **Sports other than basketball** for the specific event vocabulary.

## Assumption Carryover

From the `sneat-sports` Idea:

- **Must-be-true — following a player/game is meaningful.** A single authoritative record is what makes live following, grading, and stats trustworthy and consistent across surfaces; addressed by `event-log` + `state-projection`.
- **Should-be-true — minimal management suffices.** Event-sourcing one log (vs bespoke records per feature) is the leaner foundation; corrections-as-events avoid a separate edit/audit system.

## Rehearse Integration

Rehearse stubs are deferred. The ACs are testable in principle (append immutability/ordering, fold determinism, correction semantics, source authorization, stream ordering, record readability), but the implementation repo and the `sports` module do not exist yet. Stubs will be scaffolded during planning/implementation. No `_tests/` stubs are created at specify time.

## Open Questions

- **Physical home of scoring events.** Whether `scoreboard`'s scoring events live in this unified `events/` log or in their own collection projected into it — reconcile with `scoreboard` at plan time.
- **Realtime transport & ordering.** Live emission mechanism (Firestore snapshot listeners vs pub/sub), and how sequence numbers are assigned and ordering preserved when a scorer is offline and events are queued/replayed.
- **Wall-clock source & skew.** Server-assigned vs device timestamps, and clock-skew tolerance for `learn-to-score`'s timing grading.
- **Concurrent appenders.** Sequence assignment when the score-sheet keeper and clock/board runner append near-simultaneously.
- **Consensus vs later official correction.** How a `source = consensus` event interacts if an official crew (or judge) later amends the record.
- **Correction exposure.** Whether the projection/API ever exposes superseded events to consumers, or only the net state plus an audit view.

---
*This document follows the https://specscore.md/feature-specification*
