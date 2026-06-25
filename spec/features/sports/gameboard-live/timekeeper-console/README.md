---
format: https://specscore.md/feature-specification
status: Approved
---

# Feature: Timekeeper Console

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/timekeeper-console?op=explore) | [Edit](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/timekeeper-console?op=edit) | [Ask question](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/timekeeper-console?op=ask) | [Request change](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/timekeeper-console?op=request-change) |
**Status:** Approved
**Date:** 2026-06-24
**Owner:** alex
**Source Ideas:** sneat-sports
**Supersedes:** —
**Grade:** A

> **Approved (A).** The second authoritative operator console (the clock/board runner). Appends to [`event-timeline`](../event-timeline/README.md). (Re-review lifted B→A once the possession/timeout authority was reconciled across event-timeline + roles.)
>
> 🖼️ **Mockup:** [`../screens/screens.html`](../screens/screens.html) — the **Timekeeper** tab of the GameBoard.live screen-prototype gallery (game clock start/stop + ±5s, period advance, possession toggle, timeouts with countdown, optional team possession-time). Illustrative only, not normative.

## Summary

The official **timekeeper**'s phone console (the clock/board runner). It runs the **game clock** (start / stop, **±5s adjust**), sets each period's **length** (in 1-minute steps, before the period starts), advances the **period/quarter** (including overtime), toggles **possession**, and grants **timeouts** — starting a **timeout countdown** that decrements the team's remaining timeouts. It optionally tracks **team ball-possession time** via a simple **Team A · dead-ball · Team B** toggle, accumulating how long each team holds the ball for a recap chart. Every action is an **authorized append to [`event-timeline`](../event-timeline/README.md)** (the clock/board-runner source per [`roles`](../../sneat-team/roles/README.md)), requires a **sneat.app account + that game-day role** (per [`account-gate`](../../account-gate/README.md)), and is the single source of truth the public [`scoreboard`](../scoreboard/README.md) renders. Scoring, fouls, and substitutions live on the sibling [`scorekeeper-console`](../scorekeeper-console/README.md). Concept/vision: [`spec/ideas/sneat-sports.md`](../../../../ideas/sneat-sports.md).

## Problem

The live clock, period, possession arrow, and timeout state must be controllable in a tap on a phone and be the **single source of truth** every surface renders — drift here desyncs the whole game. Beyond the basics, teams would value a richer signal — how long each side actually held the ball — but only if it's captured almost for free. This console owns that authoritative timing/possession input plus an optional, low-effort possession-time capture.

## Behavior

### Clock & period

#### REQ: clock-control

The timekeeper MUST be able to **start** and **stop** the game clock and **adjust** it by small increments (**±5 seconds**, and correct to a specific value), each appending a **clock event** to [`event-timeline`](../event-timeline/README.md). The running/stopped clock state is authoritative.

#### REQ: period-control

The timekeeper MUST be able to **advance the period/quarter**, including into **overtime**, appending a **period event**.

#### REQ: quarter-length

Before a period's clock has started, the timekeeper MUST be able to set that period's **length** by adjusting it in **one-minute increments** (up and down, within sane bounds). The configured length sets the period's **starting clock value**. Once the period clock has **started**, the length MUST be **locked** for that period and not editable until the next period; **advancing the period** re-opens the length for the new period (with a regulation default, and a shorter default for overtime).

### Possession & timeouts

#### REQ: possession-switch

The timekeeper MUST be able to **toggle possession** between the two teams, appending a **possession event**; the projected possession arrow reflects it.

#### REQ: timeouts

The timekeeper MUST be able to **grant a timeout** to a team, which **decrements that team's remaining timeouts** and **starts a timeout countdown**; this appends a **timeout event** and the countdown surfaces on the [`scoreboard`](../scoreboard/README.md).

### Team ball-possession time (optional)

#### REQ: team-possession-time

The console MAY offer a **Team A · dead-ball · Team B** control to track cumulative ball-possession time: selecting a team **starts that team's possession timer** (and disables its button), selecting the other team **switches** the running timer, and **dead-ball** pauses both. Possession time MUST accumulate **per team** from these possession events (game-clock based) and feed a **possession-share chart** on the [`post-game-recap`](../post-game-recap/README.md). This capture is **optional** — its absence MUST NOT block clock/score operation.

### Authority & sync

#### REQ: console-authority-and-sync

Operating the timekeeper console MUST require a **sneat.app account and the clock/board-runner game-day role** (per [`account-gate`](../../account-gate/README.md) + [`roles`](../../sneat-team/roles/README.md)); its writes are the authorized clock / period / possession / timeout appends to [`event-timeline`](../event-timeline/README.md)'s `source-authority`. Changes MUST reflect on the [`scoreboard`](../scoreboard/README.md) / [`spectator-screen`](../spectator-screen/README.md) immediately (single source of truth); engagement overlays (🔥, votes) MUST NOT affect them.

## Architecture

Grounded in the existing substrate — see [`spec/research/core-modules-interface.md`](../../../../research/core-modules-interface.md).

- **Writes:** clock / period / possession / timeout events appended to [`event-timeline`](../event-timeline/README.md) (the clock/board runner is an authorized source per `roles`).
- **Clock model:** the authoritative clock is reconstructed from start/stop/adjust events + wall-clock (per `event-timeline`'s dual-clock); the console UI shows the running value.
- **Timeout countdown:** a UI countdown started on a timeout event; the remaining-timeouts count is the fold of timeout events.
- **Team possession time:** a deterministic fold of possession events against the game clock (dead-ball gaps excluded); materialized for the recap chart.
- **Gate + sync:** account + clock/board-runner role at the write boundary; the scoreboard/spectator surfaces render the same projection.

## Interaction with Other Features

- **[`event-timeline`](../event-timeline/README.md)** — the log this console appends clock/period/possession/timeout events to.
- **[`scoreboard`](../scoreboard/README.md)** — renders clock, period, possession arrow, timeouts-remaining, bonus, and the timeout countdown.
- **[`scorekeeper-console`](../scorekeeper-console/README.md)** — sibling console owning scoring / fouls / substitutions.
- **[`coach-console`](../coach-console/README.md)** — timeout requests arrive from here; the timekeeper grants them.
- **[`gameboard-live`](../README.md)** — the game; its `live-score-clock` actions are realized through these two consoles.
- **[`post-game-recap`](../post-game-recap/README.md)** — consumes team-possession-time for a possession-share chart.
- **[`sneat-team`](../../sneat-team/README.md)** / **[`roles`](../../sneat-team/roles/README.md)** — the clock/board-runner role authorizing this console.
- **[`account-gate`](../../account-gate/README.md)** — requires an account + the role to operate.

## Acceptance Criteria

### AC: start-stop-adjust-clock (verifies REQ:clock-control)

**Given** a live game,
**When** the timekeeper starts the clock, later stops it, and adjusts it by −5 seconds,
**Then** clock events are appended and the projected running clock reflects each change.

### AC: advance-period (verifies REQ:period-control)

**Given** the end of Q1,
**When** the timekeeper advances the period,
**Then** a period event is appended and the projection shows Q2 (and overtime is reachable past Q4).

### AC: set-quarter-length-before-start (verifies REQ:quarter-length)

**Given** a period whose clock has not yet started,
**When** the timekeeper increases or decreases the quarter length in one-minute steps,
**Then** the period's starting clock reflects the new length; and once the clock is started the length control is locked until the period is advanced.

### AC: toggle-possession (verifies REQ:possession-switch)

**Given** possession with the home team,
**When** the timekeeper toggles possession,
**Then** a possession event is appended and the projected possession arrow points to the away team.

### AC: timeout-decrements-and-counts-down (verifies REQ:timeouts)

**Given** the away team with timeouts remaining,
**When** the timekeeper grants them a timeout,
**Then** their remaining-timeouts count decrements, a timeout event is appended, and a timeout countdown starts and surfaces on the scoreboard.

### AC: team-possession-timer (verifies REQ:team-possession-time)

**Given** the possession-time control,
**When** the timekeeper selects Team A, later Team B, with a dead-ball pause between,
**Then** Team A's possession timer runs then stops, Team B's runs, the dead-ball gap counts to neither, and per-team possession totals accumulate for the recap chart.

### AC: console-requires-account-and-role (verifies REQ:console-authority-and-sync)

**Given** a user without the clock/board-runner role (or not signed in),
**When** they try to operate the timekeeper console,
**Then** access is refused (sign-in + role required); an authorized timekeeper's changes are appended and reflected live on the scoreboard.

## Not Doing / Out of Scope

- **Scoring, fouls, substitutions** — owned by [`scorekeeper-console`](../scorekeeper-console/README.md).
- **The public display / scoreboard composition** — owned by [`scoreboard`](../scoreboard/README.md).
- **Shot clock** — not in this cut (see Open Questions).
- **Rendering the recap charts** — owned by [`post-game-recap`](../post-game-recap/README.md); this console only supplies the possession-time data.
- **Sports other than basketball** for the specific clock/period rules.

## Assumption Carryover

From the `sneat-sports` Idea:

- **Must-be-true — one authoritative live state across surfaces.** The timekeeper console is the single writer of clock/period/possession/timeout, which every surface renders; addressed by `console-authority-and-sync`.
- **Should-be-true — richer signals can be captured cheaply.** Team possession-time via a 3-button toggle is near-free capture that yields a compelling recap chart; whether volunteers actually use it is a post-MVP measurement.

## Rehearse Integration

Rehearse stubs are deferred. The ACs are testable in principle (clock/period/possession/timeout appends + projections, countdown, possession-time fold, gate), but the implementation repo and the `sports` module do not exist yet and this is Draft. Stubs will be scaffolded during planning/implementation. No `_tests/` stubs are created at specify time.

## Open Questions

- **Shot clock.** Whether a shot-clock (24s) is added later and whether it's this console or a separate operator.
- **One vs two operators.** Whether one volunteer runs both consoles on one device (and how clock + scoring compose).
- **Possession-time precision.** Game-clock vs wall-clock basis, dead-ball handling, and whether team-possession-time is MVP or a later enhancement.
- **Clock correction.** ±5s vs arbitrary correct-to-value, and whether corrections are append-only correction events.

---
*This document follows the https://specscore.md/feature-specification*
