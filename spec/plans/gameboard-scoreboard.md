---
format: https://specscore.md/plan-specification
status: Approved
---
# Plan: Gameboard Scoreboard

**Status:** Approved
**Source Feature:** sports/gameboard-live/scoreboard
**Date:** 2026-06-24
**Owner:** alex
**Supersedes:** —
**Parent:** gameboard-live

> **Status (gameboard repo, 2026-06-26):** Backend is **live in prod** (via sneat-go). This **frontend surface was part of the deleted 1st-gen app and was not ported** to the current Nx + Ionic app — it is **to be rebuilt** on the current scaffolding (Slice 1, first up). See the master plan's [Frontend Reality & Rebuild](./gameboard-live.md) section; salvaged acceptance E2E: [`docs/legacy-mvp-frontend/e2e/full-game.spec.ts`](../../docs/legacy-mvp-frontend/e2e/full-game.spec.ts).

## Summary

Implements the [`scoreboard`](../features/sports/gameboard-live/scoreboard/README.md) Feature as **contract-first vertical slices** over the **`gameboard` root/global extension**. The game aggregate lives at `/ext/gameboard/games/{gameID}` with an append-only event log at `/ext/gameboard/games/{gameID}/events/{eventID}`; teams are sneat spaces referenced by id. A single frozen CONTRACT — TypeSpec `api4gameboard.tsp` plus `gameboard-ext/backend` (Go) and `@sneat/extension-gameboard-contract` (TS) — is consumed by both the BACKEND read-fold/public-read endpoint (`gameboard/backend`, dalgo→Firestore) and the FRONTEND scoreboard composition (`@sneat/extension-gameboard-internal`). The public scoreboard is a **no-login READ projection of the event-timeline fold**; this Feature owns the display composition plus the input affordance that delegates appends to the scorekeeper/timekeeper consoles. All 10 Feature ACs are covered; none deferred.

## Approach

Each task is a thin vertical slice shipped **contract-first**: (1) freeze the slice's TypeSpec models and read endpoint in `api4gameboard.tsp` and the `gameboard-ext` Go + `@sneat/extension-gameboard-contract` TS types — the frozen integration boundary — then (2) a **backend subtask** and (3) a **frontend subtask** proceed in parallel against the generated types, each dispatchable to its own subagent. A task is done only when both subtasks land and its ACs verify end-to-end against the frozen fold.

The slices are dependency-ordered so the read-projection fold exists before anything renders over it:

1. **Task 1** establishes the **event-timeline projection** (the read fold over `/ext/gameboard/games/{gameID}/events/{eventID}`) and the no-login public read endpoint — the shared dependency every display AC reads from, and the capture surface every capture AC appends to.
2. **Tasks 2–3** add the capture event shapes (fouls/timeouts/possession; scoring events) whose appends are owned by the scorekeeper/timekeeper consoles and surfaced here as the input affordance.
3. **Tasks 4–6** render the public composition over the fold (title/main-board/footer/period-strip; freshness; minor-safe rendering) and wire the anonymous share/QR + account-gated follow CTA.

Cross-plan dependencies, named here rather than re-specified: the **frozen event-timeline projection** is the fold this plan reads (owned jointly with `gameboard-live`); the **input affordance delegates appends** to the [`scorekeeper-console`](../features/sports/gameboard-live/scorekeeper-console/README.md) and [`timekeeper-console`](../features/sports/gameboard-live/timekeeper-console/README.md); the share CTA reuses the **`invitus` `link` channel** for link + QR; the **follow** path and **minor-safe-public** consent rule are owned by [`gameboard-live`](../features/sports/gameboard-live/README.md), sourcing consent from [`sneat-team`](../features/sports/sneat-team/README.md).

The three Feature plan-time decisions resolve inside the slices that need them: rules parameters (bonus threshold, timeout allowance, foul-reset cadence) in Task 2; the freshness mechanism (push vs poll + staleness interval, shared with `gameboard-live`) in Task 5; attribution/event ownership in Task 3.

**Event vocabulary note.** Every event-log entry this board folds — scoring, team-foul, timeout, possession — is one of the **same frozen `GameEvent` vocabulary entries** defined in [`gameboard-event-timeline`](gameboard-event-timeline.md) Task 1 (`score`/`team-foul`/`timeout`/`possession`). The `ScoringEvent`/`TeamFoulEvent`/`TimeoutEvent`/`possession-set` names used below are this plan's **read-side view** of those entries, not new event kinds; the authoritative appends are owned by the scorekeeper/timekeeper consoles.

## Tasks

### Task 1: Build the event-timeline projection & public read endpoint

**Verifies:** sports/gameboard-live/scoreboard#ac:title-shows-status-and-period, sports/gameboard-live/scoreboard#ac:main-board-elements
**Depends-On:** —
**Status:** pending

Establish the read-fold over the append-only event log and the no-login public endpoint that serves the board state (status, period, per-team color/score/fouls/timeouts, clock, bonus, possession) so title and main-board render.
- **Contract (TypeSpec + ext types, first):** in `api4gameboard.tsp` define the `Game` reference (`/ext/gameboard/games/{gameID}`, team-space ids + colors), the `BoardState` projection model (status enum, period, per-team `score`/`teamFouls`/`timeoutsRemaining`/`color`, `clock`, `bonus` flags, `possession`), and a public `getBoard(gameID)` read operation; freeze as `gameboard-ext/backend` Go + `@sneat/extension-gameboard-contract` TS.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore read-fold / public read endpoint): implement the timeline fold over `/ext/gameboard/games/{gameID}/events/{eventID}` producing `BoardState`, derive `status`/`period`, and expose the no-login `getBoard` read endpoint (auth-free read of the projection).
- **Frontend subtask** (`@sneat/extension-gameboard-internal`): the title region (status + period, `Final` highlights the winner) and the main board (color-coded home/away with score, current-period team fouls, timeouts remaining, clock, bonus indicator, possession arrow; home/away distinguishable beyond color).

### Task 2: Capture team fouls & timeouts into the fold

**Verifies:** sports/gameboard-live/scoreboard#ac:scorer-records-fouls-and-timeouts
**Depends-On:** 1
**Status:** pending

Append team-foul and timeout events (with the configured bonus threshold, timeout allowance, and per-period foul-reset cadence) so the fold reflects incremented fouls and decremented timeouts.
- **Contract (TypeSpec + ext types, first):** define `TeamFoulEvent` and `TimeoutEvent` event-log entries plus the rules-config block (bonus threshold, timeout allowance, foul-reset cadence with basketball defaults — resolves the rules-parameters decision); extend `BoardState` fold rules for foul-reset-per-period and bonus.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore read-fold): fold foul/timeout events into per-period `teamFouls`, `timeoutsRemaining`, and `bonus`; the appends themselves are owned by the scorekeeper/timekeeper consoles.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): the foul/timeout **input affordance** that delegates the append to the scorekeeper/timekeeper console; the bonus indicator updates at threshold.

### Task 3: Capture per-basket scoring events with attribution

**Verifies:** sports/gameboard-live/scoreboard#ac:points-create-scoring-event
**Depends-On:** 1
**Status:** pending

Append scoring events (team, points 1/2/3, period, clock, optional scorer, optional assist) so each team's score equals the sum of its scoring events, with optional player attribution.
- **Contract (TypeSpec + ext types, first):** define `ScoringEvent` (team, points, period, clock, optional scorer ref, optional assist ref) in the event log; document that the team score is the fold-sum of its scoring events and attribution is optional (resolves the scoring-event ownership/attribution decision — it extends the parent's capture).
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore read-fold): fold scoring events into per-team score (sum invariant) and retain scorer/assist refs for downstream footer/period projections.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): the per-basket scoring **input affordance** (points + optional scorer + optional assist) delegating the append to the scorekeeper console.

### Task 4: Render footer, score-by-period strip & possession

**Verifies:** sports/gameboard-live/scoreboard#ac:footer-last-score-attribution, sports/gameboard-live/scoreboard#ac:score-by-period-accumulates, sports/gameboard-live/scoreboard#ac:possession-toggle
**Depends-On:** 3
**Status:** pending

Project the scoring-event stream into the last-score footer (points + scorer + optional assist, neutral empty state before any score), the accumulating per-period strip, and the possession-arrow read from the fold.
- **Contract (TypeSpec + ext types, first):** extend `BoardState` with `lastScore` (points, team, optional scorer, optional assist), a `byPeriod` array, and confirm `possession`; add the possession-set event entry to the log shape.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore read-fold): fold the most-recent scoring event into `lastScore`, accumulate `byPeriod` totals, and fold possession-set events into `possession`.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): the footer (e.g. `2 pts — #8 Olivia (assist #4 Sarah)`, neutral empty state when none), the period strip (`Q1 14–10`, `Q2 8–12`), the possession-arrow render, and the possession-toggle input affordance delegating to the timekeeper console.

### Task 5: Add the live-freshness indicator

**Verifies:** sports/gameboard-live/scoreboard#ac:stale-board-indicated
**Depends-On:** 1
**Status:** pending

Surface whether the displayed projection is current: a live indication while updates arrive, switching to a stale/last-updated indication after the configured interval, on the public page and big-screen mode.
- **Contract (TypeSpec + ext types, first):** add `lastUpdatedAt`/heartbeat to `BoardState` and define the staleness interval + push-vs-poll delivery mechanism (resolves the freshness decision, shared with `gameboard-live`).
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore read-fold / public read endpoint): stamp `lastUpdatedAt` from the latest event/heartbeat on the projection and serve it over the chosen delivery channel.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): the freshness indicator (live → stale after the interval, resuming live when updates return) on both the phone board and big-screen mode.

### Task 6: Wire share/QR, account-gated follow & minor-safe display

**Verifies:** sports/gameboard-live/scoreboard#ac:share-anonymous-follow-gated, sports/gameboard-live/scoreboard#ac:minor-shown-by-number-on-board
**Depends-On:** 4
**Status:** pending

Add the anonymous share CTA (link + QR via the `invitus` `link` channel), the account-gated follow CTA (delegating to `gameboard-live`'s follow path), and enforce minor-safe rendering on every player-identifying element including shared/QR-opened and big-screen views.
- **Contract (TypeSpec + ext types, first):** define the anonymous `shareBoard(gameID)` operation (link + QR payload over the `invitus` `link` channel), reference the account-gated follow operation owned by `gameboard-live`, and add the per-player `displayConsent` flag to projected player refs in `BoardState`.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore read-fold / public read endpoint): issue the anonymous share link/QR token (no account), apply the `minor-safe-public` consent from `sneat-team` so unconsented minors project jersey-number-only, and route follow to `gameboard-live`'s account-gated path.
- **Frontend subtask** (`@sneat/extension-gameboard-*`): the share CTA (link + QR, no sign-in) and follow CTA (one-tap sign-in prompt before recording the follow) on phone + big-screen; render minors by jersey number only when consent is absent, including shared/QR views.

## Open Questions

None at this time.

---
*This document follows the https://specscore.md/plan-specification*
