---
format: https://specscore.md/feature-specification
status: Approved
---

# Feature: Coach Console

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/coach-console?op=explore) | [Edit](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/coach-console?op=edit) | [Ask question](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/coach-console?op=ask) | [Request change](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/coach-console?op=request-change) |
**Status:** Approved
**Date:** 2026-06-24
**Owner:** alex
**Source Ideas:** sneat-sports
**Supersedes:** —
**Grade:** A

> **Approved (A).** The coach's bench surface; the **request** side of the "coaches request, the table crew records/grants" authority model.
>
> 🖼️ **Mockup:** [`../screens/screens.html`](../screens/screens.html) — the **Coach** tab of the GameBoard.live screen-prototype gallery (sub requests to the scorekeeper, on-court + bench, team-internal stats), with a **role switch** (Coach ⇄ Clock/Board) demonstrating the *per-role* one-person collapse: that coach also holds the **timekeeper** role, so **timeouts grant directly** while substitutions still go to the separate scorekeeper. Illustrative only, not normative.

## Summary

The head/assistant coach's bench console. A coach **requests a substitution** (selecting one or more players to take off the court and an equal number to bring on from the bench) and **requests a timeout** — and the **table crew records/grants** it: a substitution request is confirmed and recorded by the [`scorekeeper-console`](../scorekeeper-console/README.md) (becoming the authoritative substitution event), and a timeout request is granted by the [`timekeeper-console`](../timekeeper-console/README.md). The coach is a **requester, not an authorized appender** (per [`roles`](../../sneat-team/roles/README.md) + [`account-gate`](../../account-gate/README.md)); it also shows the authoritative **on-court / bench** plus a **per-player live stat list** (points, personal fouls + foul-trouble, minutes on court) so the coach decides and requests against accurate state. It is distinct from [`play-time`](../../play-stats/play-time/README.md)'s private Got-in/Got-out accounting. Concept/vision: [`spec/ideas/sneat-sports.md`](../../../../ideas/sneat-sports.md).

## Problem

The authority model has the table crew **record** substitutions and **grant** timeouts, but the **coach** is who decides them. When the coach is a different person from the table crew (the common case), they need a surface to **request** a sub or timeout that the scorekeeper/timekeeper can confirm — instead of shouting across the gym and the table guessing. This console is that handshake: the coach proposes, the authorized operator commits, and the authoritative event is recorded once — keeping `event-timeline` clean and the on-court state correct.

## Behavior

### Requests

#### REQ: request-substitution

A coach MUST be able to **request a substitution** by selecting **one or more players to take off** directly from the authoritative **on-court list** and an **equal number of players to bring on** from the **bench / roster**, then submitting the request. **Multi-player swaps** are allowed as long as the *off* and *on* counts match; the request cannot be submitted while the counts are unequal or zero. The request is a **proposal**, not an authoritative write: the [`scorekeeper-console`](../scorekeeper-console/README.md) confirms it, at which point the substitution event(s) are recorded on [`event-timeline`](../event-timeline/README.md). The coach console MUST NOT append the substitution event itself.

#### REQ: request-timeout

A coach MUST be able to **request a timeout** for their team; the request is granted by the [`timekeeper-console`](../timekeeper-console/README.md) (which decrements remaining timeouts and starts the countdown). The coach console MUST NOT grant/append the timeout itself.

### Bench

#### REQ: bench-and-oncourt

The console MUST show the **authoritative on-court list** and the available **bench** (from the game lineup / roster) so the coach requests against accurate state; the on-court list is the one maintained by the [`scorekeeper-console`](../scorekeeper-console/README.md). When the scorekeeper **records a substitution** (including confirming the coach's own request), the coach console's on-court/bench MUST **update to reflect it**.

#### REQ: player-stat-table

The console MUST render the [`players-list`](../players-list/README.md) in **team-internal mode** — the coach's own team, full stats (jersey #, name, **points, personal fouls** with **foul-trouble** indicator, and **minutes on court**) regardless of *public* publish-consent — to inform rotation/substitution decisions. The stat set, deterministic fold (event-timeline + on-court intervals), foul-trouble rule, and consent modes are owned by [`players-list`](../players-list/README.md); this console selects the internal mode and surfaces it on the bench.

### Authority & safety

#### REQ: coach-requests-not-appends

A coach is a **requester**, authorized via a **sneat.app account + the head/assistant-coach game-day role** (per [`account-gate`](../../account-gate/README.md) + [`roles`](../../sneat-team/roles/README.md)); requests are proposals the table crew records/grants, never direct appends to [`event-timeline`](../event-timeline/README.md). In a **one-person setup** where the coach also holds a table-crew role, they record/grant directly via the console they hold (no request handshake needed). Player pickers MUST honour minor publish-consent.

## Architecture

Grounded in the existing substrate — see [`spec/research/core-modules-interface.md`](../../../../research/core-modules-interface.md).

- **Requests are transient proposals** routed to the [`scorekeeper-console`](../scorekeeper-console/README.md) (substitution) / [`timekeeper-console`](../timekeeper-console/README.md) (timeout); the authoritative event is appended by the table crew on confirmation. This console owns **no authoritative game state**.
- **Bench/on-court** is read from the scorekeeper console's authoritative on-court fold (lineup + substitution events).
- **Gate:** account + head/assistant-coach role at the request boundary (`account-gate` + `roles`).
- **One-person collapse (per role):** the collapse applies **per table role the coach actually holds** — for each action it short-circuits to a direct record/grant only on a console the coach holds, while actions owned by a role held by someone else still use the request handshake (e.g. a coach who also runs the clock grants timeouts directly but still requests substitutions from a separate scorekeeper).

## Interaction with Other Features

- **[`scorekeeper-console`](../scorekeeper-console/README.md)** — receives substitution requests and records them as authoritative substitution events.
- **[`timekeeper-console`](../timekeeper-console/README.md)** — receives timeout requests and grants them.
- **[`event-timeline`](../event-timeline/README.md)** — where the recorded sub / granted timeout land (appended by the table crew, not this console).
- **[`roles`](../../sneat-team/roles/README.md)** — the head/assistant-coach role that authorizes requesting (coaches request; the table crew records/grants).
- **[`account-gate`](../../account-gate/README.md)** — requires an account + the coach role to operate.
- **[`play-time`](../../play-stats/play-time/README.md)** — distinct: the *private/crowd* Got-in/Got-out accounting, not the official coach request.
- **[`sneat-team`](../../sneat-team/README.md)** — roster/lineup the bench is drawn from; minor consent.

## Acceptance Criteria

### AC: request-sub-recorded-by-scorekeeper (verifies REQ:request-substitution)

**Given** a coach on the coach console and a table crew on the scorekeeper console,
**When** the coach selects an equal number of players to swap by tapping them in the on-court and bench lists (e.g. off #7, on #12) and submits,
**Then** a substitution proposal reaches the scorekeeper console, and only on the scorekeeper's confirm is the substitution event recorded on the timeline — the coach console never appends it. The submit action is unavailable until the off/on counts match.

### AC: request-timeout-granted-by-timekeeper (verifies REQ:request-timeout)

**Given** a coach with timeouts remaining,
**When** the coach requests a timeout,
**Then** the request reaches the timekeeper console, which grants it (decrement + countdown); the coach console does not grant it itself.

### AC: bench-shows-authoritative-oncourt (verifies REQ:bench-and-oncourt)

**Given** an in-progress game,
**When** the coach opens the console,
**Then** it shows the authoritative on-court list and the available bench, matching the scorekeeper console's on-court state.

### AC: coach-sees-player-stats (verifies REQ:player-stat-table)

**Given** an in-progress game,
**When** the coach opens the player list,
**Then** each player shows jersey #, name, points, personal fouls (with a foul-trouble flag as they near the limit), and minutes on court — folded from the event-timeline projection and on-court intervals.

### AC: coach-cannot-append (verifies REQ:coach-requests-not-appends)

**Given** a user with only the coach role (not a table-crew role),
**When** they act on the coach console,
**Then** they may only **request** (not append) substitutions/timeouts and must be a signed-in account with the coach role; a coach who also holds a table role may record/grant directly.

## Not Doing / Out of Scope

- **Appending authoritative events directly** — the table crew (scorekeeper/timekeeper consoles) records/grants; this console only requests.
- **Scoring, fouls, clock, period, possession** — owned by the [`scorekeeper-console`](../scorekeeper-console/README.md) / [`timekeeper-console`](../timekeeper-console/README.md).
- **Private play-time accounting** (Got-in/Got-out) — owned by [`play-time`](../../play-stats/play-time/README.md).
- **Tactics / playbook / messaging** — not in scope.
- **Sports other than basketball** for the specific sub/timeout rules.

## Assumption Carryover

From the `sneat-sports` Idea:

- **Should-be-true — a clean request/record handshake beats ad-hoc shouting.** The console exists to make the coach→table-crew handshake explicit so subs/timeouts are recorded once and correctly; whether coaches adopt it (vs verbal) is a post-MVP measurement.
- **Deliberately not authoritative.** The Idea's authoritative-record thesis is preserved by keeping the coach a requester; only the table crew appends — addressed by `coach-requests-not-appends`.

## Rehearse Integration

Rehearse stubs are deferred. The ACs are testable in principle (request→confirm handshake, no direct append, bench accuracy, gate), but the implementation repo and the `sports` module do not exist yet and this is Draft. Stubs will be scaffolded during planning/implementation. No `_tests/` stubs are created at specify time.

## Open Questions

- **Request handoff UX.** How a request notifies the table crew (badge/sound), how the operator confirms/declines, and request expiry.
- **One-person collapse.** The exact UX when the coach also holds a table-crew role (skip the handshake / direct action) and how multi-role assignment drives it.
- **Request audit.** Whether requests themselves are logged (separate from the recorded authoritative event) for transparency.
- **Decline / amend.** What happens when the scorekeeper declines or amends a requested sub (e.g. different player in).
- **Coach stat set.** Beyond points / fouls / minutes, which coach-relevant metrics (+/- while on court, shooting %, turnovers) are worth showing — and which need additional capture (phase-2) rather than the currently-captured score/foul/substitution events.

---
*This document follows the https://specscore.md/feature-specification*
