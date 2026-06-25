---
format: https://specscore.md/feature-specification
status: Approved
---

# Feature: Game Players List

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/players-list?op=explore) | [Edit](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/players-list?op=edit) | [Ask question](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/players-list?op=ask) | [Request change](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/players-list?op=request-change) |
**Status:** Approved
**Date:** 2026-06-24
**Owner:** alex
**Source Ideas:** sneat-sports
**Supersedes:** —
**Grade:** A

> **Approved (A).** The shared per-player stat list that the coach console, spectator screen, and recap all reuse — defined once, with consent as the only axis of difference.

## Summary

The **per-player live stat list** for a game — jersey #, name, **points, personal fouls** (with a **foul-trouble** indicator), and **minutes on court** — folded deterministically from the [`event-timeline`](../event-timeline/README.md) projection (points + fouls) and **on-court intervals** (substitution events × game clock). It is defined **once** and reused by multiple surfaces in two **consent modes**: a **public** mode (minor publish-consent applies; consent-gated) used by the [`spectator-screen`](../spectator-screen/README.md) and [`post-game-recap`](../post-game-recap/README.md), and a **team-internal** mode (a coach's own team, full stats) used by the [`coach-console`](../coach-console/README.md). Same data, one fold, one consent rule — no per-surface duplication. Concept/vision: [`spec/ideas/sneat-sports.md`](../../../../ideas/sneat-sports.md).

## Problem

Several surfaces need the *same* per-player stat list off the official record — the coach (rotation/foul-trouble decisions), spectators (a live box-score-lite), and the post-game recap (final box score). Specifying that list separately in each invites drift in *what* is shown and *how* consent applies. This Feature defines the list once — its stat set, its deterministic fold, its foul-trouble rule, and the single **public-vs-internal consent** distinction — so every surface renders an identical, consistent list.

## Behavior

### The stat list

#### REQ: player-stat-fold

For each player the list MUST show **jersey #, name, points, personal fouls, and minutes on court**, derived as a **deterministic fold** of the [`event-timeline`](../event-timeline/README.md) projection (points from score events; personal + team fouls from foul events) and **on-court intervals** (substitution events × game clock). Recomputing from the same record yields the same list. It MUST work **live** (fold to the current moment) and as a **final** box score.

#### REQ: foul-trouble

The list MUST surface a **foul-trouble** indicator as a player nears the disqualification limit (e.g. one foul away), since that is the primary live coaching/viewer signal.

### Consent modes

#### REQ: consent-modes

The list MUST support two modes, chosen by the consuming surface:

- **Public** — minor publish-consent applies ([`sneat-team`](../../sneat-team/README.md) / [`roles`](../../sneat-team/roles/README.md)): a minor without consent is shown by **jersey number only**, and consent MAY restrict which stats are public. Used by public surfaces ([`spectator-screen`](../spectator-screen/README.md), [`post-game-recap`](../post-game-recap/README.md)).
- **Team-internal** — a coach viewing their **own team** sees full stats regardless of *public* publish-consent (which governs public surfaces, not the team's own bench). Used by the [`coach-console`](../coach-console/README.md).

The list owns this rule; the surface only selects the mode.

### Stat set

#### REQ: capture-bound-stats

The stat set MUST be limited to what is **captured today** — points, **assists** (the *optional assist* recorded on each score event, per [`scoreboard`](../scoreboard/README.md)), personal/team fouls, and on-court minutes (from score / foul / substitution events). Richer coach/viewer metrics (**+/- while on court, shooting %, turnovers, rebounds/steals/blocks**) are **phase-2**, pending additional capture; they MUST NOT appear until that capture exists. Which of the captured stats a given surface shows is a surface choice (e.g. the operator/coach console shows points / fouls / minutes; the post-game box score shows points / assists / minutes).

### Ordering

#### REQ: player-order

For **live / operational** surfaces (the operator and coach consoles), the list MUST be ordered by **jersey number ascending**, compared **numerically** (so #5 precedes #12). A player **without a jersey number** MUST sort **after** all numbered players, ordered by **name**; any remaining ties break by name. When a surface splits the list into **on-court** and **bench** groups, this order applies **within each group** (on-court first, then bench).

**Exception — the post-game / recap box score** (the final list rendered by [`post-game-recap`](../post-game-recap/README.md)) MUST instead order by **points scored, then assists, then minutes on court** (all **descending**, leaders first); remaining ties break by jersey number. This points-ordering applies **only** to the final box-score surface, not to live/operational lists.

The ordering MUST be **deterministic** — recomputing the list yields the same sequence.

## Architecture

Grounded in the existing substrate — see [`spec/research/core-modules-interface.md`](../../../../research/core-modules-interface.md).

- **Pure fold:** the list is a deterministic projection over the [`event-timeline`](../event-timeline/README.md) (points/fouls) and on-court intervals (substitution events × game clock, per [`play-time`](../../play-stats/play-time/README.md)). It owns **no state** of its own.
- **Consent:** the public mode reads minor publish-consent from [`sneat-team`](../../sneat-team/README.md) / [`roles`](../../sneat-team/roles/README.md); the team-internal mode is scoped to the requesting coach's own team.
- **Minutes precision:** on-court minutes use the game clock (dead-ball/stoppage handling per `event-timeline`'s dual-clock); reconciled to one shared fold (see Open Questions).
- **Reuse:** consumers (coach-console, spectator-screen, post-game-recap) render this list and pass the mode; they do not re-derive the stats.

## Interaction with Other Features

- **[`event-timeline`](../event-timeline/README.md)** — the official record the points/fouls fold from.
- **[`play-time`](../../play-stats/play-time/README.md)** — the on-court intervals (subs × clock) for minutes.
- **[`coach-console`](../coach-console/README.md)** — renders this list in **team-internal** mode.
- **[`spectator-screen`](../spectator-screen/README.md)** — renders this list in **public** mode (live).
- **[`post-game-recap`](../post-game-recap/README.md)** — renders this list as the final **box score** (public mode).
- **[`sneat-team`](../../sneat-team/README.md)** / **[`roles`](../../sneat-team/roles/README.md)** — roster + the minor publish-consent the public mode honours.
- **[`scoreboard`](../scoreboard/README.md)** — sibling display (the board); this is the per-player breakdown behind it.
- **[`play-stats`](../../play-stats/README.md)** — distinct: *private/crowd* stat books, not this official per-player list.

## Acceptance Criteria

### AC: per-player-fold (verifies REQ:player-stat-fold)

**Given** a game's event-timeline record and on-court intervals,
**When** the players list is computed,
**Then** each player shows jersey #, name, points, personal fouls, and minutes on court, identical on recompute, live and final.

### AC: foul-trouble-flag (verifies REQ:foul-trouble)

**Given** a player one foul from the disqualification limit,
**When** the list renders,
**Then** that player carries a foul-trouble indicator.

### AC: ordered-by-number (verifies REQ:player-order)

**Given** a roster with mixed jersey numbers and a player with no number on an **operator/coach console**,
**When** the list renders,
**Then** players appear in ascending numeric jersey order, the un-numbered player follows them ordered by name, and where the surface groups on-court vs bench the order applies within each group.

### AC: box-score-ordered-by-points (verifies REQ:player-order)

**Given** the **post-game box score**,
**When** it renders,
**Then** players are ordered by points, then assists, then minutes on court (all descending, leaders first), with jersey number breaking remaining ties.

### AC: public-vs-internal-consent (verifies REQ:consent-modes)

**Given** a minor without publish-consent,
**When** the list renders in public mode vs team-internal mode (the coach's own team),
**Then** public mode shows the minor by jersey number only (consent-gated) while team-internal mode shows full stats.

### AC: no-uncaptured-stat (verifies REQ:capture-bound-stats)

**Given** the list,
**When** its columns are inspected,
**Then** they are limited to points, fouls, and minutes — no +/-, shooting %, turnovers, or rebounds/steals/blocks until that capture exists.

## Not Doing / Out of Scope

- **Private/crowd stat books** — owned by [`play-stats`](../../play-stats/README.md).
- **The official record itself** — owned by [`event-timeline`](../event-timeline/README.md); this is a fold over it.
- **Input/capture** — owned by the [`scorekeeper-console`](../scorekeeper-console/README.md) / [`timekeeper-console`](../timekeeper-console/README.md).
- **Uncaptured metrics** (+/-, shooting %, turnovers, rebounds/steals/blocks) — phase-2.
- **Sports other than basketball** for the specific stat set.

## Assumption Carryover

From the `sneat-sports` Idea:

- **Must-be-true — one authoritative record, many surfaces.** Defining the per-player list once (a fold of the official record) keeps the coach, spectator, and recap views consistent; addressed by `player-stat-fold` + reuse.
- **Should-be-true — minimal captured stats are enough to be useful.** Points/fouls/minutes already drive the key decisions (foul trouble, rotation); richer metrics wait on capture.

## Rehearse Integration

Rehearse stubs are deferred. The ACs are testable in principle (deterministic fold, foul-trouble threshold, consent-mode gating, capture-bound columns), but the implementation repo and the `sports` module do not exist yet and this is Draft. Stubs will be scaffolded during planning/implementation. No `_tests/` stubs are created at specify time.

## Open Questions

- **Minutes precision.** Game-clock vs wall-clock basis and dead-ball handling, reconciled to one shared fold with `event-timeline`/`play-time`.
- **Per-stat consent.** Whether public consent can restrict *individual* stats (e.g. show points but not minutes) vs all-or-jersey-only.
- **Extra metrics.** Which phase-2 metric to add first (+/- while on court is derivable from score events + on-court intervals without new capture — possibly a fast follow).
- **Scope.** Whether both teams or one are shown per surface. (Default sort is resolved — see `REQ:player-order`: ascending numeric jersey number, name fallback.)

---
*This document follows the https://specscore.md/feature-specification*
