---
format: https://specscore.md/feature-specification
status: Approved
---

# Feature: Game Screens (UI Map)

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/screens?op=explore) | [Edit](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/screens?op=edit) | [Ask question](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/screens?op=ask) | [Request change](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/screens?op=request-change) |
**Status:** Approved
**Date:** 2026-06-24
**Owner:** alex
**Source Ideas:** sneat-sports
**Grade:** A

> **Approved (A) — UI / information-architecture map.** This Feature does **not** own game behavior — it is the **inventory of screens** a game involves, who each is for, what it does, its access tier, and which Feature owns the behavior behind it. It exists so we can reason about navigation, role-based entry, public-vs-authenticated access, and screen coverage before specifying any single screen in depth. Each screen is then specified in its owning Feature (e.g. the spectator game screen next).
>
> 🖼️ **Prototype:** [`screens.html`](./screens.html) — the GameBoard.live screen-prototype gallery (tabbed browser mock) that lives beside this map. Current tabs: **New game** (the [`new-game`](../new-game/README.md) creation form), **Assign crew** (the [`role-invites`](../role-invites/README.md) creator surface), **Pre-game / Live-spectator / Final** (the [`spectator-screen`](../spectator-screen/README.md) surface), **Team** (team profile — where Follow lives, linked from the live screen; owned by [`sneat-team`](../../sneat-team/README.md) profiles + [`gameboard-live`](../README.md) `follow-team-player`), **Player** (per-game player page, linked from the final box score), **Game board** (the [`scoreboard`](../scoreboard/README.md) TV/projector big-screen — the gallery's default view), **Coach** (the [`coach-console`](../coach-console/README.md) request-side bench surface), **Scorekeeper** (the [`scorekeeper-console`](../scorekeeper-console/README.md) attributed-scoring/foul/substitution surface), and **Timekeeper** (the [`timekeeper-console`](../timekeeper-console/README.md) clock/period/possession/timeout surface). New screen mocks are added as tabs here. Illustrative only, not normative.

## Summary

The **screen/page map for a game**. A game touches many distinct surfaces — a big public gameboard, on-site and online spectator views, operator consoles (score-sheet, clock/board, judge, coach), entry and sharing surfaces, and the engagement loops (predictions, MVP voting, reactions). Behavior for each lives in its owning Feature; this map names every surface once, fixes its **audience** and **access tier** (public / participant-identity / role-authenticated), and pins the **single-source-of-truth** rule so all live surfaces render the same [`event-timeline`](../event-timeline/README.md) projection. Concept/vision: [`spec/ideas/sneat-sports.md`](../../../../ideas/sneat-sports.md).

## Problem

Game behavior is spread across a dozen Features (scoreboard, event-timeline, consensus-scoring, play-time, roles, the engagement loops, first-use-backprop…), but there is no single picture of the **actual screens** people use, who sees each, how someone lands on the right one, and which surfaces need no login versus a game-day role. Without that map we can't reason about navigation, role-based entry, public/minor-safety boundaries, or whether the screen set is even complete — and we risk specifying screens that disagree with each other or omitting crucial ones (e.g. a post-game recap). This Feature is that map.

## Behavior

### Screen inventory

#### REQ: screen-inventory

The game experience MUST comprise the surfaces below. Each row fixes the surface's **audience**, **access tier**, and **owning Feature** (where the behavior is specified). `+` marks surfaces added beyond the initial sketch; `(deferred)` marks planned-but-not-MVP surfaces.

**Public viewing (no login):**

| Screen | Audience | Owner |
|---|---|---|
| **Gameboard** — big public display (TV/projector); shows the **game #** + QR with a **reason to scan** (join on your phone to react 🔥, predict, vote MVP, see stats) | venue + remote viewers | [`scoreboard`](../scoreboard/README.md) (big-screen mode) |
| **Spectator screen** — one responsive surface, on-site + online (venue-aware extras) | spectators (no login) | [`spectator-screen`](../spectator-screen/README.md) |
| **+ Play-by-play / timeline view** *(deferred)* | engaged viewers | [`event-timeline`](../event-timeline/README.md) (rendered) |

**Operator consoles (game-day role required, per [`roles`](../../sneat-team/roles/README.md)):**

| Screen | Audience | Owner |
|---|---|---|
| **Scorekeeper console** (score sheet) | scorer role | [`scorekeeper-console`](../scorekeeper-console/README.md) |
| **Timekeeper console** (clock/board runner) | clock/board role | [`timekeeper-console`](../timekeeper-console/README.md) |
| **+ Judge / referee screen** — rulings & corrections | judge role | [`event-timeline`](../event-timeline/README.md) + [`roles`](../../sneat-team/roles/README.md) |
| **+ Lineup selection screen** — set who's present | coach / manager | [`gameboard-live`](../README.md) `select-lineup` |
| **+ Coach console** — request sub / timeout, bench view | head/assistant coach | [`coach-console`](../coach-console/README.md) |

**Participation (participant identity — account or accountless follow):**

| Screen | Audience | Owner |
|---|---|---|
| **Predictions** — pre-game | followers | [`predictions`](../../engagement/predictions/README.md) |
| **MVP voting** — post-game | affiliated supporters | [`mvp-voting`](../../engagement/mvp-voting/README.md) |
| **+ Consensus reporting screen** — no-crew scoring | identified spectators | [`consensus-scoring`](../consensus-scoring/README.md) |
| **+ Shadow-scoring screen** *(deferred)* | aspiring scorers | [`learn-to-score`](../learn-to-score/README.md) |
| **+ Private stat-book screen** *(deferred)* | collectors | [`play-stats`](../../play-stats/README.md) |

**Lifecycle & navigation:**

| Screen | Audience | Owner |
|---|---|---|
| **+ Pre-game / fixture screen** — time, **venue + directions**, lineups, predictions, **per-team RSVP** (widget owned by rsvp.express), **Share game** | everyone | [`gameboard-live`](../README.md) |
| **+ Post-game recap screen** — final score, box score, MVP results, badges earned, best predictor, share card | everyone | [`post-game-recap`](../post-game-recap/README.md) |
| **+ Players list / box score** — shared per-player points/fouls/minutes (public consent-gated, or team-internal for the coach) | engaged viewers / coach | [`players-list`](../players-list/README.md) (rendered by spectator-screen, coach-console, post-game-recap); [`play-stats`](../../play-stats/README.md) for private books |
| **+ Team-game page** — a team's stats + players **for one game** (result, team totals, date/venue, opponent link, players → player pages), with Follow | spectators / followers | [`sneat-team`](../../sneat-team/README.md) profile + [`players-list`](../players-list/README.md) + [`gameboard-live`](../README.md) `follow-team-player` |
| **+ Player-game page** — a player's stats **for one game** (points/assists/fouls/minutes, badges, own team & opponent), with Follow | spectators / followers | [`sneat-team`](../../sneat-team/README.md) profile + [`players-list`](../players-list/README.md) + `follow-team-player` |

**Entry & distribution:**

| Screen | Audience | Owner |
|---|---|---|
| **Join game screen** — choose role, team / player affiliation | arriving participants | [`roles`](../../sneat-team/roles/README.md) + follow |
| **+ Crew join QR / link** — scan to self-select an open crew role (on the organizer's *assign crew* surface) | arriving crew | [`role-invites`](../role-invites/README.md) → rsvp.express |
| **+ RSVP** — pre-game confirm attendance & game-day role, per team | players / staff / fans | **rsvp.express** *(sister product)* |
| **Share game page / dialog** — social, QR, copy URL | anyone | distribution (own concern — TBD) |
| **+ QR / deep-link landing** — where a scanned link, **or a manually entered game #** (the QR fallback), drops you | arriving viewers | distribution |
| **+ Account-claim / first-use onboarding** | accountless participants | [`first-use-backprop`](../../first-use-backprop/README.md) |
| **+ Follow / following management** | followers | [`gameboard-live`](../README.md) follow |
| **+ Leaderboards** — predictions (and badges) | followers | [`predictions`](../../engagement/predictions/README.md) / [`badges`](../../engagement/badges/README.md) |

### Entry & access

#### REQ: role-based-entry

A participant arriving at a game (typically via the **join game** screen or a **QR/deep-link landing**) MUST be routed to the appropriate surface by their **role and affiliation**: operators to their console (per [`roles`](../../sneat-team/roles/README.md) game-day assignment), spectators to the spectator screen, and accountless arrivals straight to a viewable surface without forced signup.

#### REQ: access-tiers

Each surface MUST honor its access tier: **public/no-login** for viewing and sharing surfaces; a **participant identity** (account or accountless follow) for participation surfaces (reactions, voting, predictions, consensus reporting); and a **game-day role** (per [`roles`](../../sneat-team/roles/README.md)) for operator consoles. Minor-player data on any surface MUST follow the publish-consent rules ([`sneat-team`](../../sneat-team/README.md) / [`roles`](../../sneat-team/roles/README.md)).

### Consistency

#### REQ: single-source-of-truth

All live surfaces (gameboard, spectator screens, operator consoles) MUST render the **same [`event-timeline`](../event-timeline/README.md) projection**, so they never disagree on score, clock, or period. Engagement overlays (🔥, votes, predictions) are presentational additions and MUST NOT alter that projection.

## Architecture

This is an IA/navigation map, not a behavior owner.

- **Ownership:** every screen's behavior, data, and ACs live in the owning Feature named in `screen-inventory`. This map owns only the inventory, routing, access tiers, and the single-source-of-truth rule.
- **Routing:** join-game / QR-landing resolves role + affiliation (from [`roles`](../../sneat-team/roles/README.md) assignments and follow edges) to select the entry surface.
- **Rendering substrate:** live surfaces subscribe to the [`event-timeline`](../event-timeline/README.md) live stream; the recap/box-score surfaces read the final record and [`play-stats`](../../play-stats/README.md).
- **Per-screen depth:** each surface is specified in its owner; surfaces marked `(deferred)` are planned, not MVP.

## Interaction with Other Features

- **[`scoreboard`](../scoreboard/README.md)** — gameboard + spectator viewing surfaces.
- **[`event-timeline`](../event-timeline/README.md)** — the shared projection all live surfaces render; operator consoles append to it.
- **[`consensus-scoring`](../consensus-scoring/README.md)** — the no-crew reporting surface.
- **[`play-time`](../../play-stats/play-time/README.md)** / **[`play-stats`](../../play-stats/README.md)** — bench/substitution screen and box-score/stat surfaces.
- **[`roles`](../../sneat-team/roles/README.md)** — game-day roles that gate operator consoles and drive routing.
- **[`predictions`](../../engagement/predictions/README.md)** / **[`mvp-voting`](../../engagement/mvp-voting/README.md)** / **[`live-reactions`](../../engagement/live-reactions/README.md)** — participation surfaces.
- **[`first-use-backprop`](../../first-use-backprop/README.md)** — the account-claim/onboarding surface.
- **[`gameboardlive-bot`](../gameboardlive-bot/README.md)** — the chat surface, an alternative entry/notification channel parallel to these screens.

## Acceptance Criteria

### AC: inventory-names-owner-and-access (verifies REQ:screen-inventory)

**Given** the screen inventory,
**When** any screen is inspected,
**Then** it names an audience, an access tier, and an owning Feature where its behavior is specified (or is marked deferred).

### AC: arrival-routed-by-role (verifies REQ:role-based-entry)

**Given** a scorer, a spectator, and an accountless QR arrival,
**When** each enters a game,
**Then** the scorer lands on the score-sheet console (role permitting), the spectator on the spectator screen, and the accountless arrival on a viewable surface with no forced signup.

### AC: access-tier-enforced (verifies REQ:access-tiers)

**Given** the surfaces,
**When** a user without a game-day role opens an operator console and a no-login user opens the gameboard,
**Then** the operator console is gated by role while the gameboard opens publicly, and minor-player data on either follows publish-consent.

### AC: live-surfaces-agree (verifies REQ:single-source-of-truth)

**Given** a live game shown on the gameboard, a spectator screen, and the score-sheet console,
**When** a score event is appended,
**Then** all three reflect the same updated projection, and any 🔥/votes shown do not change that score.

## Not Doing / Out of Scope

- **Behavior, data models, and ACs for individual screens** — owned by each screen's Feature; this map only inventories and routes.
- **Visual/interaction design, layout, components** — build-time / design concern.
- **The sharing/distribution mechanism itself** — its own concern (TBD); this map only lists the share + QR-landing surfaces.
- **Non-game screens** — club/team admin, season management, billing.

## Assumption Carryover

From the `sneat-sports` Idea:

- **Must-be-true — anonymous-friendly distribution.** The map enshrines public, no-login viewing/sharing surfaces and account-less participation, with account-claim deferred to first-use — directly serving the low-friction-graph-capture thesis.
- **Should-be-true — one game record, many surfaces.** `single-source-of-truth` makes every surface a view over the one `event-timeline`, the lean foundation the vertical already chose.

## Rehearse Integration

Rehearse stubs are deferred. The ACs are testable in principle (inventory completeness, routing by role, access-tier enforcement, cross-surface consistency), but the implementation repo and the `sports` module do not exist yet and this is a Draft IA map. Per-screen test surfaces are scaffolded in each owning Feature at its own specify/plan time. No `_tests/` stubs here.

## Open Questions

- **Sharing placement** — confirm sharing/QR is its own top-level distribution concern (recommended) vs a game sub-feature.
- **Deferred surfaces** — order of bringing play-by-play view, shadow-scoring, and private-stat-book screens into the MVP.
- **Bot vs screens parity** — which screen capabilities must the [`gameboardlive-bot`](../gameboardlive-bot/README.md) mirror, and which are screen-only.

---
*This document follows the https://specscore.md/feature-specification*
