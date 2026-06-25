---
format: https://specscore.md/feature-specification
status: Approved
---

# Feature: Learn to Score

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/learn-to-score?op=explore) | [Edit](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/learn-to-score?op=edit) | [Ask question](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/learn-to-score?op=ask) | [Request change](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/learn-to-score?op=request-change) |
**Status:** Approved
**Date:** 2026-06-23
**Owner:** alex
**Source Ideas:** sneat-sports
**Supersedes:** —
**Grade:** A

## Summary

A gamified, training-oriented surface on [GameBoard.live](../README.md). An identified spectator runs their **own** clock and score for a live game — a private "shadow" session with **no effect on the official record** — and afterward is **graded on closeness to the official record** (the [`event-timeline`](../event-timeline/README.md) log) on both **score state** (weighted heavier) and **clock/period timing**. Per-game and overall **leaderboards** rank accuracy, and post-game **feedback** shows where they diverged. It is a stealth funnel: playing it *teaches* people to score, growing the platform's scarcest resource — competent volunteer scorers — while each participant is captured as an identified supporter (graph residue). It reuses the same "private record graded against the authoritative score" pattern as [`play-stats`](../../play-stats/README.md), applied to clock+score. Concept: [`spec/ideas/sneat-sports.md`](../../../ideas/sneat-sports.md).

## Problem

The platform's bottleneck is competent volunteer scorers, and there is no fun, low-stakes way to learn the job or to engage spectators who would enjoy "calling the game" themselves. Meanwhile a live game already produces an authoritative clock/score timeline that makes a perfect answer key. This Feature turns scoring into a game: anyone can shadow-run a game on their phone, get scored on how close they were, climb a leaderboard, and learn from where they missed — all without touching the official record. The by-products are exactly what Sports wants: trained future scorers and another reason for an accountless spectator to identify themselves.

## Behavior

### Shadow session

#### REQ: shadow-session

An identified spectator MUST be able to start a **shadow scoring session** for a game and run their own **clock** (start/stop, advance period/overtime) and **score** (points per team) independently of the official scorer. The session MUST be recorded privately to the participant and MUST NOT alter the official game state, the [`scoreboard`](../scoreboard/README.md), or anyone else's session. Multiple participants' sessions for the same game MUST coexist independently.

#### REQ: participant-identity

A shadow session MUST have an **identified participant** — a Sneat account or a [`gameboardlive-bot`](../gameboardlive-bot/README.md) chat handle (reusing the accountless follow handle from [`gameboard-live`](../README.md)). No anonymous sessions. The participant is thereby captured as graph residue (an identified supporter), reconcilable to an account by [`first-use-backprop`](../../first-use-backprop/README.md).

### Official answer key

#### REQ: official-timeline-dependency

Grading MUST compare a session against the official game record — the authoritative, append-only, timestamped clock/score timeline owned by [`event-timeline`](../event-timeline/README.md), whose `record-access` exposes the complete (or as-of) log with both **game-clock and wall-clock** stamps. Grading for a game MUST be available only once that record exists (e.g. the game is `final`). The official record is always the source of truth; a session never amends it.

### Grading

#### REQ: closeness-grading

After the official timeline is available, a session MUST be assigned a **closeness score** combining two components: a **score component** measuring deviation between the participant's score states (running and final, and per-period) and the official ones, and a **timing component** measuring how close the participant's clock/period transitions were to the official ones. Lower deviation MUST yield a higher closeness score. The two components combine into one **score-dominant** grade — **score ≈ 70%, timing ≈ 30%** (exact constants tunable at plan time) — because getting the score right is the core scorer skill. A **partial session** (participant stops early) is graded only over the portion they ran, against the official record up to that point, so stopping early neither inflates the grade nor is rewarded. Grading MUST be deterministic — the same session and official record always yield the same score.

### Leaderboard

#### REQ: leaderboard

The system MUST rank participants by closeness score on a **per-game** leaderboard and **per-scope overall** leaderboards (**club / competition / global**), most accurate first. Overall boards MUST apply the same **small-sample fairness as [`predictions`](../../engagement/predictions/README.md)** — a volume qualification (exclude participants below the scope's median graded-session count) plus a confidence/shrinkage-adjusted rank — and MUST **normalize for game length/level** so longer or higher-scoring games don't distort cross-game ranking. Only graded sessions (those with an available official record) MUST appear; sessions flagged by `anti-gaming` MUST be excluded from (or marked on) the boards.

### Feedback

#### REQ: divergence-feedback

After grading, a participant MUST be able to review **where they diverged** from the official record — their score and clock/period transitions alongside the official ones — so the session functions as scoring practice, not just a number.

### Integrity

#### REQ: anti-gaming

A game's official scoreboard is **public** (a venue TV, the big-screen gameboard, other devices), so the official value **cannot be hidden** from a shadow participant. Integrity is therefore enforced by **detecting likely copying** rather than concealment: the grader MUST flag sessions whose input pattern indicates mirroring the official feed — e.g. consistently exact values entered on a fixed lag, or implausibly perfect timing with no genuine self-correction — and flagged sessions MUST be **excluded from (or marked on) the leaderboards**. The exact signals and thresholds are plan-time tunables.

## Architecture

Grounded in the existing substrate — see [`spec/research/core-modules-interface.md`](../../../../research/core-modules-interface.md).

- **Sessions:** stored scoped to the participant (their own space), e.g. `/spaces/{participantSpaceID}/ext/sports/shadowSessions/{sessionID}`, capturing their clock/score event log referencing the `gameID`. Sessions never write the `sports` game aggregate or `scoreboard` state.
- **Official record (answer key):** the authoritative clock/score timeline is the [`event-timeline`](../event-timeline/README.md) log, read via its `record-access` (with game-clock + wall-clock stamps). This Feature consumes it; it does not build it.
- **Grading:** a deterministic grader diffs the session event log against the `event-timeline` record into a score component + a timing component → one **score-dominant (~70/30)** closeness score; exact constants tunable at plan time.
- **Leaderboards:** per-game and per-scope (club / competition / global) rankings over graded sessions, applying the [`predictions`](../../engagement/predictions/README.md) small-sample fairness (median-volume qualification + shrinkage-adjusted rank) and game-length/level normalization, with copy-flagged sessions excluded. Materialization vs on-read is a plan-time decision.
- **Identity & residue:** account or `gameboardlive-bot` chat handle; participant reconciled by `first-use-backprop`.
- **Privacy:** the feature deals only with team score and clock — it surfaces **no roster-player PII**, so the minor-safe rules of `scoreboard`/`play-stats` do not apply here; leaderboards show the participant's own identity (by playing, they opt in).

## Interaction with Other Features

- **[`gameboard-live`](../README.md)** (parent) — owns the official game/clock/score state; provides the follow handle.
- **[`event-timeline`](../event-timeline/README.md)** — the authoritative **answer key** this Feature grades against (its `record-access` log with game-clock + wall-clock stamps); the named dependency, now satisfied.
- **[`scoreboard`](../scoreboard/README.md)** — renders the official score/period built from the same official events.
- **[`predictions`](../../engagement/predictions/README.md)** — shares the small-sample leaderboard-fairness approach reused here.
- **[`gameboardlive-bot`](../gameboardlive-bot/README.md)** — chat identity for a participant.
- **[`first-use-backprop`](../../first-use-backprop/README.md)** — reconciles a chat-identified participant into a Sneat account/graph node.
- **[`play-stats`](../../play-stats/README.md)** — sibling that shares the "private record graded against official" pattern (player stats there, clock+score here).
- **[`badges`](../../engagement/badges/README.md)** — consumes closeness grades to award scorekeeper-accuracy badges.

## Acceptance Criteria

### AC: run-shadow-session-no-official-effect (verifies REQ:shadow-session)

**Given** a live game and an identified spectator,
**When** the spectator starts a shadow session and runs their own clock and adds points for each team,
**Then** their session is recorded privately, the official game state and scoreboard are unchanged, and another participant's concurrent session is unaffected.

### AC: session-requires-identity (verifies REQ:participant-identity)

**Given** a request to start a shadow session,
**When** the requester is identified by a Sneat account or a gameboardlive-bot chat handle,
**Then** the session is created with that participant; and an anonymous request cannot start a session.

### AC: grading-waits-for-official-timeline (verifies REQ:official-timeline-dependency)

**Given** a shadow session for a game that is still live (no official timeline yet),
**When** grading is requested,
**Then** no closeness score is produced until the official clock/score timeline is available (e.g. the game is finished), at which point grading can proceed.

### AC: closeness-score-combines-score-and-timing (verifies REQ:closeness-grading)

**Given** two finished-game sessions — one whose final/per-period scores and clock transitions closely match the official record, and one with larger score and timing deviations,
**When** both are graded,
**Then** the closer session receives the higher closeness score; a session that nails the score but is loose on timing outranks one loose on the score but tight on timing (score-dominant ~70/30); and re-grading the same session against the same official record yields an identical score.

### AC: per-game-and-overall-leaderboards (verifies REQ:leaderboard)

**Given** several graded sessions across multiple games in a club, including a participant with one lucky high-closeness session below the scope's median session count,
**When** the leaderboards are produced,
**Then** a per-game ranking and per-scope overall rankings are returned most-accurate-first; the lucky low-volume participant is excluded from the overall board by the volume qualification; and an ungraded session (no official record) does not appear.

### AC: copying-flagged (verifies REQ:anti-gaming)

**Given** a session whose inputs mirror the official feed on a fixed lag with implausibly perfect values,
**When** it is graded,
**Then** it is flagged as likely copying and excluded from (or marked on) the leaderboards, while a genuine session with natural self-corrections is not flagged.

### AC: divergence-review (verifies REQ:divergence-feedback)

**Given** a graded session,
**When** the participant opens their feedback,
**Then** they see their score and clock/period transitions alongside the official ones, highlighting where they diverged.

## Not Doing / Out of Scope

Inherited from the [`sneat-sports`](../../../../ideas/sneat-sports.md) Idea plus spec-level cuts:

- **Using shadow sessions to correct or contribute to the official score/stats** — sessions are a game, never a data source; the official record stays with `scoreboard`/`gameboard-live`.
- **Player-stat shadow capture** — tracking per-player stats is `play-stats`; this Feature is clock + team score only.
- **Building the official timeline itself** — owned by [`event-timeline`](../event-timeline/README.md); this Feature only consumes it.
- **Rewards/prizes, badges, tournaments beyond a closeness leaderboard** — future gamification.
- **Live mid-game provisional grading** — grading is post-official-timeline; a live "how am I doing" mode is a future enhancement.
- **Sports other than basketball.**

## Assumption Carryover

From the `sneat-sports` Idea:

- **Must-be-true — the follow atom is viral; participants convert.** A shadow-session participant is an identified supporter reconciled by `first-use-backprop`; addressed by `participant-identity`. This adds a *third* engagement atom (after follow and stat-collection).
- **Should-be-true — competent scorers can be grown.** The training/feedback loop (`divergence-feedback` + `leaderboard`) is the mechanism; whether it actually produces willing real scorers is a post-MVP measurement.

## Rehearse Integration

Rehearse stubs are deferred. The ACs are testable in principle (session isolation, identity gating, grade determinism, leaderboard eligibility, feedback rendering), but the implementation repo and the official-timeline emission do not exist yet. Stubs will be scaffolded during planning/implementation. No `_tests/` stubs are created at specify time.

## Open Questions

- **Live provisional mode.** Whether a live "closeness so far" view is worth adding later (engagement) vs grading strictly post-game.
- **Tuning constants.** The anti-gaming copy-detection signals/thresholds (lag tolerance, perfection bounds) and the fairness/normalization constants — plan-time tunables, not open design.

---
*This document follows the https://specscore.md/feature-specification*
