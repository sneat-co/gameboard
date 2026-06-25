---
format: https://specscore.md/feature-specification
status: Approved
---

# Feature: Scorekeeper Console

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/scorekeeper-console?op=explore) | [Edit](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/scorekeeper-console?op=edit) | [Ask question](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/scorekeeper-console?op=ask) | [Request change](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/scorekeeper-console?op=request-change) |
**Status:** Approved
**Date:** 2026-06-24
**Owner:** alex
**Source Ideas:** sneat-sports
**Supersedes:** —
**Grade:** A

> **Approved (A).** One of the two authoritative operator consoles; the score-sheet keeper's input surface. Appends to [`event-timeline`](../event-timeline/README.md). (Re-review lifted B→A once the substitution-authority was reconciled across event-timeline + roles.)
>
> 🖼️ **Mockup:** [`../screens/screens.html`](../screens/screens.html) — the **Scorekeeper** tab of the GameBoard.live screen-prototype gallery (per-team on-court attribution, FT/2/3 point pad, fouls + bonus, multi-select substitution, and loading/confirming an incoming coach substitution request). Illustrative only, not normative.

## Summary

The official **scorekeeper**'s phone console — the authoritative input for the score sheet. It records each basket (**FT / 2 / 3**) for a team, **attributing it to a player from that team's on-court list** (with an optional assist), records **individual + team fouls**, and **manages the on-court lineup via substitutions** — including the common case where the scorer taps a basket for a player who has come on but isn't yet on the on-court list. Every action is an **authorized append to [`event-timeline`](../event-timeline/README.md)** (the score-sheet-keeper source per [`roles`](../../sneat-team/roles/README.md)), requires a **sneat.app account + that game-day role** (per [`account-gate`](../../account-gate/README.md)), and the resulting projection is what the public [`scoreboard`](../scoreboard/README.md) renders. The **clock, period, possession, and timeouts** live on the sibling [`timekeeper-console`](../timekeeper-console/README.md). Concept/vision: [`spec/ideas/sneat-sports.md`](../../../../ideas/sneat-sports.md).

## Problem

The official record is only as good as the input surface. A volunteer scorer on a phone needs to log baskets fast, attribute each to the right player, keep fouls (and the bonus) correct, and — crucially — keep the **on-court list** accurate so attribution stays valid. The frequent friction is recording a basket for a player who's been subbed in but isn't on the on-court list. Without a tight console that folds substitutions into the scoring flow, attribution and on-court state drift and the timeline degrades.

## Behavior

### Recording scores

#### REQ: record-basket

The scorekeeper MUST be able to record a score for a team by point value — **free throw (1), 2, or 3** — and MUST attribute it to a player chosen from that team's **on-court list**, with an **optional assisting** on-court player. Each recorded basket appends a **score event** (team, points, scorer, optional assist) to [`event-timeline`](../event-timeline/README.md).

#### REQ: scorer-not-on-court

If the player who scored is **not on the on-court list**, the console MUST offer an inline **substitution** before attributing: pick the player they **replaced** (from the on-court list) or add the scorer from the **roster / off-court** (adding a new player where [`sneat-team`](../../sneat-team/README.md) roster additions are allowed), update the on-court list, then attribute the basket to them. The substitution itself appends a substitution event (see `manage-on-court`).

### Fouls

#### REQ: record-foul

The scorekeeper MUST be able to record an **individual foul** on an on-court player, which increments that player's personal foul count and the **team foul** count and appends a **foul event**; the projection MUST reflect the **bonus/penalty** once a team reaches the team-foul limit.

### On-court & substitutions

#### REQ: manage-on-court

The console MUST maintain the authoritative **on-court list** (five players for basketball) derived from the game lineup and substitution events. A **substitution** is: select **one or more players out** (from on-court) and an **equal number in** (from off-court / roster, add new where allowed), then **confirm the swap(s)** — appending substitution event(s); the console MUST NOT confirm while the out/in counts are unequal. The console MUST also be able to **load an incoming coach substitution request** (pre-selecting exactly the players the coach chose) and let the scorekeeper **confirm** it, recording the same authoritative substitution event(s). Substitution MUST be available both **inline** (from the scorer-not-on-court flow) and as a **standalone** selection on the console.

#### REQ: authoritative-on-court

The on-court list maintained here is the **authoritative** one; [`play-time`](../../play-stats/play-time/README.md)'s private/crowd on-court accounting MUST defer to it (its `official-substitution-precedence`). The on-court state is the deterministic fold of the lineup + substitution events on the timeline.

### Authority & safety

#### REQ: console-authority

Operating the scorekeeper console MUST require a **sneat.app account and the score-sheet-keeper game-day role** (per [`account-gate`](../../account-gate/README.md) + [`roles`](../../sneat-team/roles/README.md)); its writes are the authorized score/foul/substitution appends to [`event-timeline`](../event-timeline/README.md)'s `source-authority`. Player pickers MUST honour minor publish-consent ([`sneat-team`](../../sneat-team/README.md)) in how players are displayed.

## Architecture

Grounded in the existing substrate — see [`spec/research/core-modules-interface.md`](../../../../research/core-modules-interface.md).

- **Writes:** score / foul / substitution events appended to [`event-timeline`](../event-timeline/README.md) (the scorekeeper is an authorized source per `roles`).
- **On-court list:** a deterministic fold of the game lineup + substitution events; the substitution UI mutates it by appending events, never by editing history.
- **Pickers:** players come from the [`sneat-team`](../../sneat-team/README.md) roster / game lineup; minor display honours publish-consent.
- **Projection:** the public [`scoreboard`](../scoreboard/README.md) renders the fold these events produce; this console owns input, not display.
- **Gate:** account + score-sheet-keeper role enforced at the write boundary (`account-gate`).

## Interaction with Other Features

- **[`event-timeline`](../event-timeline/README.md)** — the log this console appends score/foul/substitution events to.
- **[`scoreboard`](../scoreboard/README.md)** — renders the projection these inputs drive.
- **[`timekeeper-console`](../timekeeper-console/README.md)** — sibling console owning clock / period / possession / timeouts.
- **[`coach-console`](../coach-console/README.md)** — substitution requests arrive from here; the scorekeeper confirms and records them as the authoritative substitution event.
- **[`gameboard-live`](../README.md)** — the game and its lineup.
- **[`sneat-team`](../../sneat-team/README.md)** / **[`roles`](../../sneat-team/roles/README.md)** — roster + the score-sheet-keeper role that authorizes this console; minor consent.
- **[`account-gate`](../../account-gate/README.md)** — requires an account + the role to operate.
- **[`play-time`](../../play-stats/play-time/README.md)** — defers to this console's authoritative on-court / substitution state.
- **[`consensus-scoring`](../consensus-scoring/README.md)** — the alternative source when no scorekeeper runs the game.

## Acceptance Criteria

### AC: record-attributed-basket (verifies REQ:record-basket)

**Given** a live game with an on-court list,
**When** the scorekeeper records a 2 for the home team and picks "#7 Sarah" as scorer and "#4 Méabh" as assist,
**Then** a score event (home, +2, scorer #7, assist #4) is appended to the timeline and the projected score increases by 2.

### AC: score-for-subbed-in-player (verifies REQ:scorer-not-on-court)

**Given** a basket for a player not on the on-court list,
**When** the scorekeeper records it,
**Then** the console prompts a substitution (who they replaced, or add from roster), updates the on-court list via a substitution event, and then attributes the basket to the now-on-court scorer.

### AC: foul-increments-and-bonus (verifies REQ:record-foul)

**Given** a team one foul short of the team-foul limit,
**When** the scorekeeper records another individual foul on an on-court player,
**Then** that player's personal foul count and the team foul count increment, and the projection shows the opponent in the bonus.

### AC: substitution-swaps-on-court (verifies REQ:manage-on-court)

**Given** five players on court,
**When** the scorekeeper selects one or more players out and an equal number in from the bench and confirms,
**Then** a substitution event is appended per pair and the on-court list reflects the swap(s); the confirm action is unavailable while the out/in counts differ.

### AC: confirm-coach-substitution-request (verifies REQ:manage-on-court)

**Given** an incoming substitution request from the [`coach-console`](../coach-console/README.md),
**When** the scorekeeper loads the request (pre-selecting exactly the players the coach chose) and confirms it,
**Then** the substitution event(s) are appended, the on-court list reflects the swap, and the change propagates to the coach console's on-court/bench view.

### AC: on-court-is-authoritative (verifies REQ:authoritative-on-court)

**Given** an official substitution recorded here and a divergent private play-time report,
**When** on-court state is resolved,
**Then** the official substitution takes precedence and play-time reconciles to it.

### AC: console-requires-account-and-role (verifies REQ:console-authority)

**Given** a user without the score-sheet-keeper role (or not signed in),
**When** they try to open/operate the scorekeeper console,
**Then** access is refused (sign-in + role required), and an authorized scorekeeper's writes are accepted as event-timeline appends.

## Not Doing / Out of Scope

- **Clock, period, possession, timeouts** — owned by [`timekeeper-console`](../timekeeper-console/README.md).
- **The public display / scoreboard composition** — owned by [`scoreboard`](../scoreboard/README.md).
- **The play-by-play view and aggregate stats** — owned elsewhere; this console is input.
- **Crowd/consensus scoring** — owned by [`consensus-scoring`](../consensus-scoring/README.md) (the no-scorekeeper path).
- **Sports other than basketball** for the specific scoring/foul vocabulary.

## Assumption Carryover

From the `sneat-sports` Idea:

- **Must-be-true — a single authoritative record is trustworthy across surfaces.** A tight scorekeeper input that keeps attribution + on-court state correct is what makes the timeline (hence scoreboard, stats, grading) trustworthy. Addressed by `record-basket` + `manage-on-court` + `authoritative-on-court`.
- **Should-be-true — one volunteer on a phone can run it.** The inline substitution flow minimizes friction; whether one person can run both consoles is an Open Question.

## Rehearse Integration

Rehearse stubs are deferred. The ACs are testable in principle (attributed appends, sub-on-score flow, foul/bonus, swap, precedence, gate), but the implementation repo and the `sports` module do not exist yet and this is Draft. Stubs will be scaffolded during planning/implementation. No `_tests/` stubs are created at specify time.

## Open Questions

- **One vs two operators.** Whether one volunteer can run both the scorekeeper and timekeeper consoles on one device, and how the two consoles compose.
- **Foul-out / disqualification.** How reaching the personal-foul limit surfaces and whether it forces a substitution.
- **Mis-tap correction.** How a wrong basket/attribution is corrected (a correction event per `event-timeline`'s append-only-corrections) from the console.
- **On-court count rules.** Confirming the five-on-court rule and how injuries / short benches are handled.

---
*This document follows the https://specscore.md/feature-specification*
