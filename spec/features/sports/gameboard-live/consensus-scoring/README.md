---
format: https://specscore.md/feature-specification
status: Approved
---

# Feature: Consensus Scoring

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/consensus-scoring?op=explore) | [Edit](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/consensus-scoring?op=edit) | [Ask question](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/consensus-scoring?op=ask) | [Request change](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/consensus-scoring?op=request-change) |
**Status:** Approved
**Date:** 2026-06-23
**Owner:** alex
**Source Ideas:** sneat-sports
**Supersedes:** —
**Grade:** A

## Summary

Crowd-consensus scoring for games with **no official scorer** — friendlies, pickup games, anywhere nobody keeps a score-sheet. Identified spectators report each **scoring play** (team, points, who scored, optional assist); when enough **independent reporters agree**, the play is confirmed and attributed, and confirmed plays accumulate into the game's score. The authority rule is the inverse of the rest of the vertical: **when no official scorer runs the game, consensus IS the authoritative record; when an official scorer is present, the official record wins and consensus only supplements attribution** — surfacing the crowd's "who scored" to the scorer as an accept/dismiss **suggestion** when they missed the moment. This realizes the **public-crowdsourcing** path [`play-stats`](../../play-stats/README.md) deferred, scoped to scoring/attribution. Each reporter is an identified supporter (graph residue), so consensus voting is also a multiplayer/graph-growth act, and it extends Sports beyond officiated club games into informal play. Concept: [`spec/ideas/sneat-sports.md`](../../../ideas/sneat-sports.md).

## Problem

Every other Sports surface assumes someone runs the score. Most amateur basketball — friendlies, training games, pickup — has nobody on the score-sheet, so the score and "who scored" simply evaporate, and parents/players following along get nothing. Yet a crowd of phones is present. This Feature lets that crowd produce a trustworthy-enough record by agreement: report the last basket, and when independent spectators concur, it counts. It must do this without letting a few wrong or malicious reports corrupt the game, and it must defer to an official scorer whenever one exists.

## Behavior

### Reporting

#### REQ: report-scoring-play

An identified spectator MUST be able to report a **scoring play** for a live game: the scoring **team**, the **points** (`1`/`2`/`3`), the **player who scored** (a lineup player owned by [`sneat-team`](../../sneat-team/README.md)), and an OPTIONAL assisting player. Each report is a **candidate** contribution tied to its reporter and a timestamp. A report MUST NOT by itself change the game record until it is confirmed by consensus.

### Consensus

#### REQ: consensus-confirmation

Candidate reports describing the **same scoring play** (same team/points within a short time window) MUST be grouped, and the play MUST be **confirmed and attributed** (points + scorer + optional assist) once agreement among **independent reporters** reaches a configurable threshold (a minimum count and majority). When reporters disagree on the scorer, the play MAY be confirmed for the points/team while the **scorer remains disputed/unattributed** until consensus is reached. The dedup window, minimum count, and majority are configurable parameters (plan-time defaults).

#### REQ: consensus-as-record

Confirmed plays MUST accumulate into the game's **consensus score** (per team, per period). For a game with **no official scorer**, this consensus score and its attributions ARE the game's authoritative record (the `sports` game score/scoring events), and the game MUST be marked as consensus-sourced. Only `confirmed` plays contribute to the score; pending/disputed reports do not.

### Authority

#### REQ: official-precedence

If an official scorer runs the game (via [`gameboard-live` REQ:live-score-clock](../README.md) / [`scoreboard`](../scoreboard/README.md)), the **official record is authoritative**: consensus MUST NOT override the official score or official attributions, and MAY only **supplement** via `suggest-to-scorer`. Consensus establishes the authoritative record **only** when no official scorer is present.

#### REQ: suggest-to-scorer

When an official scorer is running the game and the scorer **missed who scored** (a basket is recorded but unattributed, or the scorer requests help), the consensus scorer/assist attribution MUST be surfaced to the scorer as a **suggestion** they can **accept** — applying it to the official record — or **dismiss**. The suggestion MUST NOT auto-apply to the official record; the scorer remains authoritative. Accepting a suggestion attributes the official basket to the suggested player; dismissing leaves it as the scorer set it.

### Integrity

#### REQ: reporter-identity-integrity

Every reporter MUST be a **sneat.app account** (per [`account-gate`](../../account-gate/README.md) — reporting is a data mutation; a [`gameboardlive-bot`](../gameboardlive-bot/README.md) chat handle must upgrade to an account first) — no anonymous reports — and MUST count at most **once per scoring play**. The system MUST apply anti-abuse controls (per-reporter rate limits; Sybil resistance via identity) so a small number of actors cannot manufacture consensus. An identified reporter is captured as graph residue, reconcilable by [`first-use-backprop`](../../first-use-backprop/README.md).

### Display

#### REQ: consensus-display

The scoreboard/record MUST present the consensus-derived score and attributions, visibly distinguishing **confirmed** plays from **pending/disputed** ones. Player-identifying display MUST honor the minor publish-consent owned by [`sneat-team`](../../sneat-team/README.md) and surfaced by [`gameboard-live` REQ:minor-safe-public](../README.md): a minor without consent is shown by jersey number only.

## Architecture

Grounded in the existing substrate — see [`spec/research/core-modules-interface.md`](../../../../research/core-modules-interface.md).

- **Reports:** a child collection of the `sports` game aggregate — `/spaces/{spaceID}/ext/sports/games/{gameID}/consensusReports/{reportId}` — carrying reporter, team, points, scorer ref, optional assist ref, timestamp, and grouping/confirmation state. Final layout is a plan-time decision.
- **Consensus engine:** a deterministic grouper + threshold evaluator turns candidate reports into confirmed plays (dedup window → independent-reporter count + majority → confirm; scorer may be confirmed separately from points).
- **Authoritative record:** for a consensus-sourced game, confirmed plays are written as the game's scoring events / score; for an officiated game, the official scoring events (`scoreboard`) remain authoritative and consensus is advisory/supplemental only. The game record marks which source is authoritative.
- **Identity:** a sneat.app account (per [`account-gate`](../../account-gate/README.md)); one vote per reporter per play.
- **Players & consent:** scoring/assist reference `sneat-team` lineup players; minor-consent applied at display.
- **Relationship to play-stats:** this is the public-crowdsourcing slice `play-stats` deferred; confirmed consensus attributions are a source `play-stats`' phase-2 official-team-stats can consume.

## Interaction with Other Features

- **[`gameboard-live`](../README.md)** (parent) — owns the game aggregate, lineup, official score path, and the follow handle; defines `minor-safe-public`. Consensus is an alternative scoring source for its games.
- **[`scoreboard`](../scoreboard/README.md)** — when official, its scoring events win; otherwise it displays the consensus-derived score (distinguishing confirmed vs pending).
- **[`gameboardlive-bot`](../gameboardlive-bot/README.md)** — chat identity and a natural reporting surface for spectators.
- **[`sneat-team`](../../sneat-team/README.md)** — lineup players reports reference and the minor-consent source of truth.
- **[`first-use-backprop`](../../first-use-backprop/README.md)** — reconciles a chat-identified reporter into a Sneat account/graph node.
- **[`play-stats`](../../play-stats/README.md)** — consumer of confirmed consensus attributions (its deferred crowdsourcing path).
- **[`badges`](../../engagement/badges/README.md)** — derives consensus-reliability badges from confirmation counts / reporter reputation.

## Acceptance Criteria

### AC: report-is-candidate (verifies REQ:report-scoring-play)

**Given** an identified spectator watching a no-scorer friendly with lineups,
**When** the spectator reports "home, 2 points, scored by #8 Olivia, assist #4 Sarah",
**Then** a candidate report tied to that reporter and timestamp is recorded, and the game's score is unchanged until the play is confirmed.

### AC: majority-confirms-and-attributes (verifies REQ:consensus-confirmation)

**Given** a threshold of 3 independent reporters and majority, and four spectators reporting the same home 2-point play within the dedup window — three naming "#8 Olivia" and one naming "#10 Kate",
**When** consensus is evaluated,
**Then** the play is confirmed as home +2 attributed to "#8 Olivia" (the majority), grouped as a single play rather than four.

### AC: disagreement-leaves-scorer-disputed (verifies REQ:consensus-confirmation)

**Given** enough reporters to confirm a 2-point home play but an even split on who scored,
**When** consensus is evaluated,
**Then** the play is confirmed for home +2 while the scorer remains disputed/unattributed pending further agreement.

### AC: consensus-is-record-without-scorer (verifies REQ:consensus-as-record)

**Given** a game with no official scorer and several confirmed plays,
**When** the game record is read,
**Then** the per-team/per-period score equals the sum of confirmed plays' points, the attributions reflect confirmed scorers, and the game is marked consensus-sourced; pending/disputed reports do not affect the score.

### AC: official-wins-when-present (verifies REQ:official-precedence)

**Given** a game an official scorer is running,
**When** consensus reports arrive that disagree with the official score,
**Then** the official score and attributions stand unchanged, and consensus only fills attribution for a basket the official left unattributed.

### AC: scorer-accepts-or-dismisses-suggestion (verifies REQ:suggest-to-scorer)

**Given** an officiated game where the scorer recorded a home 2-point basket but did not see who scored, and consensus points to "#8 Olivia",
**When** the suggestion is surfaced to the scorer,
**Then** accepting it attributes the official basket to "#8 Olivia", and dismissing it leaves the basket as the scorer set it — in neither case does consensus change the official record without the scorer's action.

### AC: identity-and-one-vote (verifies REQ:reporter-identity-integrity)

**Given** the consensus mechanism,
**When** an anonymous report is attempted, and when a single reporter submits the same play twice,
**Then** the anonymous report is rejected, the duplicate counts only once toward consensus, and a reporter exceeding the rate limit is throttled.

### AC: confirmed-vs-pending-and-minor-safe (verifies REQ:consensus-display)

**Given** a consensus-sourced game with one confirmed play attributed to a minor without club consent and one pending play,
**When** the scoreboard renders,
**Then** confirmed and pending plays are visually distinguished, and the minor scorer is shown by jersey number only.

## Not Doing / Out of Scope

Inherited from the [`sneat-sports`](../../../../ideas/sneat-sports.md) Idea plus spec-level cuts:

- **Consensus on fouls, timeouts, clock, or rich stats** — this Feature is scoring plays (points + who) only; broader stats remain `play-stats`, clock-accuracy is `learn-to-score`.
- **Overriding an official scorer** — consensus never supersedes an official record; it only supplements attribution when one exists.
- **Full dispute-resolution workflows** — beyond confirmed/pending/disputed states and threshold re-evaluation, richer adjudication is future.
- **Free-text / non-roster players** — reports reference existing lineup players; ad-hoc player entry for fully informal games is a future question (see Open Questions).
- **Sports other than basketball.**

## Assumption Carryover

From the `sneat-sports` Idea:

- **Must-be-true — the follow atom is viral; participants convert.** A consensus reporter is an identified supporter reconciled by `first-use-backprop`; addressed by `reporter-identity-integrity`. This adds a *fourth* engagement atom (follow, stat-collection, shadow-scoring, consensus-voting).
- **Should-be-true — informal games widen the funnel.** Consensus brings games with no scorer (the majority of amateur play) into Sports; whether crowds reliably reach consensus is a post-MVP measurement.

## Rehearse Integration

Rehearse stubs are deferred. The ACs are testable in principle (report capture, grouping/threshold logic, record derivation, official precedence, identity/anti-abuse, display states), but the implementation repo and the upstream game/lineup surfaces do not exist yet. Stubs will be scaffolded during planning/implementation. No `_tests/` stubs are created at specify time.

## Open Questions

- **No-scorer detection.** Whether a game is explicitly created in a "consensus" mode or consensus simply activates when no official scorer is present, and how a switch mid-game is handled.
- **Threshold tuning & abuse.** Minimum reporter count, majority %, dedup window, and Sybil/collusion resistance for small crowds (a handful of friends could be the entire crowd).
- **Disputed-play resolution.** How long a play stays pending, whether late reports can flip an attribution, and how corrections surface to viewers.
- **Informal rosters.** Whether fully informal games (no real roster) need ad-hoc/jersey-only player entry, and how minor-consent works without a club.
- **Feeding play-stats.** The contract by which confirmed consensus attributions become a source for `play-stats`' phase-2 official team stats.

---
*This document follows the https://specscore.md/feature-specification*
