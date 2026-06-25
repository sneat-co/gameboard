---
format: https://specscore.md/feature-specification
status: Approved
---

# Feature: Scoreboard

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/scoreboard?op=explore) | [Edit](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/scoreboard?op=edit) | [Ask question](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/scoreboard?op=ask) | [Request change](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/scoreboard?op=request-change) |
**Status:** Approved
**Date:** 2026-06-23
**Owner:** alex
**Source Ideas:** sneat-sports
**Supersedes:** —
**Grade:** A

## Summary

The public live scoreboard composition for a game, and the scorer-input expansion that feeds it. The board has three regions — a **title** (status + period), a **main board** (color-coded home/away, each with score, team fouls, and timeouts; plus the game clock, a bonus/penalty indicator, and a possession arrow), and a **footer** (the last score: points and — consent permitting — scorer and assisting player). Because a scoreboard can only show what is captured, this Feature also **extends [`gameboard-live`](../README.md)'s scoring** to record team fouls, timeouts, possession, and per-basket **scoring events** (points + optional scorer + optional assist). The **operator input** for this capture is realized by the [`scorekeeper-console`](../scorekeeper-console/README.md) (score/fouls/subs) and [`timekeeper-console`](../timekeeper-console/README.md) (clock/period/possession/timeouts); this Feature owns the **display/composition**. It adds a **live-freshness** indicator, a **share + QR** call-to-action (anonymous — making the board the viral surface) plus a **follow** CTA (account-gated per [`account-gate`](../../account-gate/README.md)), and a **score-by-period** strip. It renders on the public no-login page and in big-screen mode, both owned by [`gameboard-live`](../README.md).

## Problem

`gameboard-live` proves the loop with score, clock, and period, but a real basketball scoreboard the audience recognizes also shows team fouls (and bonus), timeouts, possession, and the last basket — and the last-basket attribution (who scored, who assisted) is exactly the residue that makes following a *player* meaningful. None of that is captured today (play-by-play and stats were deferred). This Feature defines both the recognizable scoreboard composition and the minimal scorer inputs that make it truthful, while keeping the board a no-login, viral, minor-safe surface. A full chronological timeline view and aggregate statistics remain out of scope.

## Behavior

### Display — Title

#### REQ: title-status-period

The scoreboard title MUST show the game **status** — one of `Scheduled`, `Live`, `Halftime`, `Overtime`, `Final`, `Cancelled` — and the current **period** (e.g. `Q1`–`Q4`, `OT`). When the status is `Final`, the title MUST indicate the result is final and the winning side MUST be visually highlighted on the board. Status and period derive from `gameboard-live`'s game state (`REQ:live-score-clock`).

### Display — Main board

#### REQ: main-board

The main board MUST show, for both **home** and **away**: the team name rendered in the team's **color**, the team **score**, the team **fouls** for the current period, and **timeouts remaining**. The board MUST also show the **game clock**, a **bonus/penalty** indicator for a team once its current-period team fouls reach the configured bonus threshold, and a **possession** arrow indicating which team currently has possession. Home and away MUST be visually distinguishable beyond color alone (label/position) for accessibility.

### Display — Footer

#### REQ: last-score-footer

The footer MUST show the most recent **scoring event**: the points scored and the team. When a scorer is attributed and display is permitted by `minor-safe-display`, it MUST also show the scoring player (jersey number, plus first name when consented — matching the parent's [`minor-safe-public`](../README.md) first-name default) and, when present, the **assisting** player. When no scoring event has occurred yet, the footer MUST render an empty/neutral state rather than stale data.

### Display — Score by period

#### REQ: score-by-period

The board MUST show a per-period score strip (e.g. `Q1 14–10`, `Q2 …`) derived from the recorded scoring events, accumulating as the game progresses.

### Display — Live freshness

#### REQ: live-freshness

The public board MUST show whether the displayed state is **current**. When updates from the scorer continue to arrive, it MUST present a live indication; when no update has been received for a configurable interval (e.g. the scorer loses connectivity), it MUST present a **stale/last-updated** indication so viewers do not mistake a frozen board for the live state. This applies to the no-login public page and big-screen mode.

### Display — Follow & share

#### REQ: follow-share-cta

The public board MUST present a **share** CTA — share the board (link + QR, reusing the `invitus` `link` channel) — which requires **no account**; and a **follow** CTA — following the team or a player invokes [`gameboard-live` REQ:follow-team-player](../README.md) and, per [`account-gate`](../../account-gate/README.md), requires a **sneat.app account** (one-tap sign-in prompt). Both MUST be available from the phone board and big-screen mode.

### Display — Minor safety

#### REQ: minor-safe-display

Every player-identifying element on the board (footer scorer/assist, any roster reference) MUST honor the minor publish-consent owned by [`sneat-team`](../../sneat-team/README.md) and surfaced by [`gameboard-live` REQ:minor-safe-public](../README.md): a minor without consent is shown by jersey number only — never name, date of birth, or personal details — including in shared/QR-opened and big-screen views.

### Capture — Fouls & timeouts

#### REQ: capture-fouls-timeouts

The scorer MUST be able to record a **team foul** (incrementing that team's current-period foul count) and a **timeout** taken by a team (decrementing that team's remaining timeouts from a configured per-game allowance). Team fouls reset per period per the configured rules. These values feed the bonus indicator and the main board.

### Capture — Scoring events

#### REQ: capture-scoring-events

When the scorer records points for a team, the system MUST persist a **scoring event** carrying: the team, the points (1/2/3), the period, and the clock time, and OPTIONALLY an attributed **scorer** (a lineup player) and an **assisting** player. Attribution MUST be optional — the scorer can record points without naming a player. The team score MUST equal the sum of its scoring events' points. Scoring events are the source for `last-score-footer` and `score-by-period` (and a future timeline, out of scope here).

### Capture — Possession

#### REQ: capture-possession

The scorer MUST be able to set/toggle which team has **possession**; the main board's possession arrow reflects the current value.

## Architecture

Grounded in the existing substrate — see [`spec/research/core-modules-interface.md`](../../../../research/core-modules-interface.md).

- **State & events:** extends the `sports` module game aggregate (`/spaces/{spaceID}/ext/sports/games/{gameID}`, owned by `gameboard-live`). The live game state gains per-team `teamFouls` (per period), `timeoutsRemaining`, and `possession`; **scoring events** are a child collection `/spaces/{spaceID}/ext/sports/games/{gameID}/scoringEvents/{eventID}` (points, team, period, clock, optional scorer ref, optional assist ref). Final collection layout is a plan-time decision.
- **Rules config:** the bonus threshold, timeout allowance, and team-foul reset cadence are configurable game/competition parameters (basketball defaults), finalized at plan time.
- **Composition:** the scoreboard is the rendering of this state into the three regions; it is the detailed composition of `gameboard-live`'s `REQ:public-scoreboard` and reuses its public no-login link and big-screen mode rather than introducing a new surface.
- **Freshness:** the live/stale indicator is driven by the recency of scorer updates (heartbeat/last-write timestamp); mechanism (push vs poll) is a plan-time decision shared with `gameboard-live`.
- **Consent:** player-identifying rendering applies the `minor-safe-public` rule sourced from `sneat-team` before display.
- **Follow/share:** share/QR reuse the `invitus` `link` channel (anonymous); the follow CTA invokes `gameboard-live`'s account-gated follow path; this Feature owns no follow state itself.

## Interaction with Other Features

- **[`gameboard-live`](../README.md)** (parent) — owns the game aggregate, score/clock/period, the public no-login page + big-screen mode, the follow path, and `minor-safe-public`. This Feature extends its scoring capture and details its scoreboard composition.
- **[`sneat-team`](../../sneat-team/README.md)** — source of truth for minor publish-consent and for the lineup players a scoring event can attribute.
- **[`gameboardlive-bot`](../gameboardlive-bot/README.md)** — a sibling delivery surface; both consume the same game state/events. The bot delivers; this Feature displays.
- **`invitus`** — `link` channel reused for share/QR.

## Acceptance Criteria

### AC: title-shows-status-and-period (verifies REQ:title-status-period)

**Given** a game in progress in Q2,
**When** a viewer opens the scoreboard,
**Then** the title shows status `Live` and period `Q2`; and when the scorer ends the game, the title shows `Final` with the winning team highlighted.

### AC: main-board-elements (verifies REQ:main-board)

**Given** a live game where the home team has 5 team fouls in the current period (bonus threshold 5) and 2 timeouts remaining, with possession,
**When** a viewer opens the board,
**Then** the board shows each team's color-coded name, score, current-period team fouls, and timeouts remaining, the clock, a bonus indicator on the home team, and the possession arrow pointing to the home team.

### AC: footer-last-score-attribution (verifies REQ:last-score-footer)

**Given** a scoring event of 2 points attributed to a consented player "#8 Olivia" assisted by "#4 Sarah",
**When** the board renders the footer,
**Then** the footer shows "2 pts — #8 Olivia (assist #4 Sarah)"; and before any scoring event, the footer shows a neutral empty state.

### AC: score-by-period-accumulates (verifies REQ:score-by-period)

**Given** recorded scoring events totaling 14–10 in Q1 and 8–12 in Q2,
**When** the board renders the period strip,
**Then** it shows `Q1 14–10` and `Q2 8–12`.

### AC: stale-board-indicated (verifies REQ:live-freshness)

**Given** a live board receiving updates,
**When** no update arrives for the configured staleness interval,
**Then** the board switches from a live indication to a stale/last-updated indication; and resumes the live indication when updates return.

### AC: share-anonymous-follow-gated (verifies REQ:follow-share-cta)

**Given** an anonymous viewer with no Sneat account on the public board,
**When** the viewer uses the share CTA and then the follow CTA,
**Then** they obtain a share link + QR without signing in, and the follow CTA prompts a one-tap sign-in before recording the follow (via `gameboard-live`'s account-gated follow path).

### AC: minor-shown-by-number-on-board (verifies REQ:minor-safe-display)

**Given** a minor scorer without club consent to publish personal details,
**When** that player scores and the footer (and any shared/big-screen view) renders,
**Then** the player is shown by jersey number only, with no name or personal details.

### AC: scorer-records-fouls-and-timeouts (verifies REQ:capture-fouls-timeouts)

**Given** a live game,
**When** the scorer records a team foul for the away team and a timeout for the home team,
**Then** the away team's current-period foul count increments (updating the bonus indicator at threshold) and the home team's timeouts-remaining decrements by one.

### AC: points-create-scoring-event (verifies REQ:capture-scoring-events)

**Given** a live game with a lineup,
**When** the scorer adds 3 points for the home team and attributes them to "#10 Kate" with no assist, then adds 2 points with no attribution,
**Then** two scoring events are persisted (3 pts → Kate; 2 pts → unattributed), the home score increases by 5, and the home score equals the sum of its scoring events.

### AC: possession-toggle (verifies REQ:capture-possession)

**Given** a live game with possession shown for the home team,
**When** the scorer toggles possession,
**Then** the board's possession arrow points to the away team.

## Not Doing / Out of Scope

Inherited from the [`sneat-sports`](../../../../ideas/sneat-sports.md) Idea plus spec-level cuts:

- A full chronological **timeline / play-by-play view** and **aggregate player/team statistics** — this Feature persists scoring events but does not present a timeline or compute stat lines.
- **Individual player foul counts / foul-outs** — only team fouls (for bonus) are tracked here.
- **Shot clock** — not tracked at the target volunteer/youth level.
- **Scoring/clock control UI mechanics** — owned by `gameboard-live REQ:live-score-clock`; this Feature adds the foul/timeout/scoring-event/possession inputs but the core control surface is the parent's.
- **Notification delivery** — owned by `gameboard-live` / `gameboardlive-bot`.

## Assumption Carryover

From the `sneat-sports` Idea:

- **Must-be-true — following a player is meaningful.** Per-basket attribution (scorer/assist) captured here is what makes a followed player's game legible; the deeper stats payoff is deferred (Not Doing) and measured post-MVP.
- **Must-be-true — the board is a no-login shareable viral surface.** Sharing is anonymous; following is account-gated. Addressed by `follow-share-cta` + `live-freshness` over `gameboard-live`'s public page; conversion yield is a post-MVP measurement.

## Rehearse Integration

Rehearse stubs are deferred. The ACs are testable in principle (state/event assertions, render rules, consent filtering, freshness transitions), but the implementation repo and the parent's scoreboard surface do not exist yet. Stubs will be scaffolded during planning/implementation. No `_tests/` stubs are created at specify time.

## Open Questions

- **Rules parameters.** Bonus threshold, timeout allowance, and team-foul reset cadence — per-competition configuration and basketball defaults (and how these generalize across sports later).
- **Freshness mechanism.** Push vs poll and the staleness interval — shared decision with `gameboard-live`.
- **Attribution UX.** How fast the scorer can attribute a basket (scorer/assist) without slowing scoring on a phone; whether attribution is ever required.
- **Scoring-event ownership vs gameboard-live.** Whether the scoring-event capture ultimately lives here or is folded back into `gameboard-live REQ:live-score-clock` at plan time (it currently extends it).
- **Display conventions.** The **bonus** indicator marks the team *in the bonus* (the non-fouling team that shoots free throws), not the team over the limit; **timeouts** display as remaining; **clock** prominence/placement on the big-screen gameboard (corner vs centre); **possession** indicator placement; and an optional **per-period time-progress bar**.

---
*This document follows the https://specscore.md/feature-specification*
