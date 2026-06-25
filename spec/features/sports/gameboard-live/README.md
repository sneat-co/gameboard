---
format: https://specscore.md/feature-specification
status: Approved
---

# Feature: GameBoard.live

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live?op=explore) | [Edit](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live?op=edit) | [Ask question](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live?op=ask) | [Request change](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live?op=request-change) |
**Status:** Approved
**Date:** 2026-06-23
**Owner:** alex
**Source Ideas:** sneat-sports
**Supersedes:** —
**Grade:** A

## Summary

The MVP channel of the [Sports](../README.md) vertical and an [Eventus](../../eventus/README.md) mini-product. A volunteer scorer creates a basketball game, confirms which players are present from the team's season roster (owned by [`sneat-team`](../sneat-team/README.md)), controls score and clock, and publishes a **public, no-login scoreboard**. Anyone can **view and share** the scoreboard with no account; **signing in to follow** a team/player (per [`account-gate`](../account-gate/README.md)) is the multiplayer atom that grows the relationship graph, while every shared scoreboard link drives distribution. A game is a Calendarius **happening** + a thin **eventus overlay**; the public scoreboard reuses the `invitus` `link` channel; follow edges are written via the `linkage` facade. Durable account/profile materialization on first real use is owned by [`first-use-backprop`](../first-use-backprop/README.md). Substrate map: [`spec/research/core-modules-interface.md`](../../../research/core-modules-interface.md).

## Contents

| Child | Description |
|---|---|
| [gameboardlive-bot](gameboardlive-bot/README.md) | Chat-bot delivery and lightweight follow surface for GameBoard.live. A Telegram bot (GameBoardLiveBot) is the first implementation; WhatsApp is a follow-up on the same chat-delivery contract. Lets users receive game notifications via chat (chat id is the notification handle) and posts live updates into group chats; following itself is a mutation requiring a sneat.app account (per account-gate), so a chat handle must upgrade to follow. |
| [scoreboard](scoreboard/README.md) | The public live scoreboard composition for a game — title (status + period), main board (color-coded home/away with score, team fouls + bonus, timeouts remaining, possession, clock), and footer (last score with scorer/assist) — plus the scorer-input expansion that captures team fouls, timeouts, possession, and per-basket scoring events (points + scorer + optional assist). Adds a live-freshness indicator, an anonymous follow/share CTA + QR, and a score-by-period strip. |
| [learn-to-score](learn-to-score/README.md) | Gamified shadow-scoring: an identified spectator runs their own clock and score for a live game (privately, with no effect on the official record), and afterward is graded on how close their score state AND clock/period timings were to the official timeline. Per-game and overall leaderboards rank accuracy, and post-game feedback shows where they diverged — a stealth funnel that trains competent volunteer scorers. Grades against the authoritative event-timeline record (record-access, dual clock). |
| [consensus-scoring](consensus-scoring/README.md) | Crowd-consensus scoring for games with no official scorer (friendlies, pickup, no score-sheet). Identified spectators report each scoring play (points, who scored, optional assist); when enough independent reporters agree, the play is confirmed and attributed, and confirmed plays accumulate into the game's score. When no official scorer runs the game, consensus IS the authoritative record; when an official scorer is present, official wins and consensus only supplements attribution. Realizes play-stats' deferred public-crowdsourcing for the scoring slice. |
| [event-timeline](event-timeline/README.md) | The authoritative, append-only, ordered, timestamped event log that IS a game's official record — the canonical substrate scoreboard, gameboardlive-bot, learn-to-score, consensus-scoring, play-stats and play-time all consume. Every official state change is an immutable event (status, period, clock, score+attribution, team foul, timeout, substitution, possession, judge ruling, correction) carrying a sequence number, both game-clock and wall-clock, and its source (official game-day role or consensus). Current game state is a deterministic projection (fold) over the log; corrections/rulings are appended, never destructive. Emitted both as a live ordered stream and as a complete as-of/final record. This is the data substrate, not the user-facing play-by-play view. |
| [screens](screens/README.md) | The information-architecture map of every game screen (audience, access tier, owning feature) — public viewing, operator consoles, participation, lifecycle, and entry/distribution — plus role-based entry, access tiers, and a single-source-of-truth rule (all live surfaces render the same event-timeline projection). A map, not a behavior owner. **Draft.** |
| [spectator-screen](spectator-screen/README.md) | The primary spectator-facing live game page — one responsive surface for on-site + online. No-login live scoreboard, scarce 🔥 reactions, follow via profiles/QR, phase-adaptive entry (predictions pre-game, MVP voting + recap at final), venue-aware extras, minor-safe. The engagement engine of the channel. **Approved (A).** |
| [post-game-recap](post-game-recap/README.md) | The shareable post-final summary — the artifact posted to Facebook / messengers. Final score, box score, MVP + Opponents' Choice, badges earned, and this game's best predictor (linking to the leaderboard); rich OG share card + no-login follow CTA. Recap arrivals can view results but not vote. **Approved (A).** |
| [new-game](new-game/README.md) | The creation on-ramp to the whole vertical — elaborates create-game into the full journey. Account-holding organizer creates a game from just two team names + a time; each side is an existing sneat.team team or an ad-hoc name (no club/roster/accounts up front). Persists at `scheduled`, immediately shareable (link/QR/game #); durable team profiles + accounts + family edges materialize lazily via first-use-backprop on first real use. **Approved (A).** |
| [scorekeeper-console](scorekeeper-console/README.md) | The official scorekeeper's input console: records baskets (FT/2/3) attributed to an on-court player (+ optional assist), individual + team fouls, and manages the on-court lineup via substitutions (incl. the scorer-not-on-court flow). Appends authoritative score/foul/substitution events to event-timeline; account + score-sheet-keeper role required. **Approved (A).** |
| [timekeeper-console](timekeeper-console/README.md) | The official timekeeper's console (clock/board runner): game clock (start/stop, ±5s), period/quarter, possession toggle, and timeouts (with a timeout countdown), plus optional team ball-possession-time capture (Team A / dead-ball / Team B) feeding a recap chart. Appends authoritative clock/period/possession/timeout events to event-timeline; account + clock/board-runner role required. **Approved (A).** |
| [coach-console](coach-console/README.md) | The coach's bench surface — the request side of "coaches request, the table crew records/grants": request a substitution (recorded by the scorekeeper console) and a timeout (granted by the timekeeper console), and view the authoritative on-court/bench. Account + head/assistant-coach role; a requester, not an authoritative appender. Distinct from play-time's private Got-in/out. **Approved (A).** |
| [role-invites](role-invites/README.md) | The creator's "assign crew" surface — assign a game-day role to a named person and issue a targeted invite with role + permissions attached, plus a crew-coverage view (which essential roles are filled / pending / unfilled before tip-off). A thin orchestrator: delivery + accept/decline reuse rsvp.express (targeted mode), the role/permission model + authoritative grant stay with roles; it proposes, never grants. **Approved (A).** |
| [players-list](players-list/README.md) | The shared per-player live stat list — jersey #, name, points, personal fouls (+ foul-trouble), minutes on court — folded from event-timeline + on-court intervals, in two consent modes (public/consent-gated, or team-internal full). Reused by the coach console, spectator screen, and recap box score; private books stay with play-stats. **Approved (A).** |

## Problem

Amateur and youth games are run by volunteers with a phone, and the people who care most (parents, grandparents, coaches, scouts, fans) have no low-friction way to follow along live. Dedicated scoreboard apps solve display but build no relationship graph and require everyone to adopt an app. This Feature delivers the smallest slice that proves the Sports bet: let one scorer run a game and publish a scoreboard anyone can open without an account, and let spectators follow teams/players so that following both notifies them and deposits relationship edges — turning a live scoreboard into the lowest-friction graph capture Sneat has.

## Behavior

### Game

#### REQ: create-game

A scorer MUST be able to create a basketball game with a home team, an away team, a date/time, a venue, and a competition label (optional). The game is created within a club/team **space** and persisted via a new `sports` space module at `/spaces/{spaceID}/ext/sports/games/{gameID}` (Firestore via dalgo), and is represented as a Calendarius **happening** plus a thin **eventus overlay** so it appears on the calendar for free. The game references team identifiers owned by `sneat-team`; it MUST NOT copy roster details. A game has a status of `scheduled`, `live`, `finished`, or `cancelled`.

#### REQ: select-lineup

Before tip-off, the scorer MUST be able to select which players from a team's **season roster** (owned by [`sneat-team`](../sneat-team/README.md)) are present for this game, by checking boxes against the existing roster — not by re-entering player data. The selected subset becomes the **game lineup**. The scorer MUST be able to run a game even when only part of the roster is present.

### Live Scoring

#### REQ: live-score-clock

While a game is `live`, the scorer MUST be able to increase and decrease each team's score, start and stop the game clock, and advance the period (quarter), including into overtime, following basketball period structure. Score and clock changes MUST be controllable from a phone with minimal taps. Transitioning the game to `live` and later to `finished` MUST be scorer actions, and the published scoreboard MUST reflect the current score, clock, and period.

### Public Scoreboard

#### REQ: public-scoreboard

Every game MUST have a public scoreboard page reachable by a shareable link and matching QR code (reusing the `invitus` `link` channel + token), openable by **anyone with no Sneat account**. The scoreboard MUST display the two teams, the live score, the clock, and the current period, and MUST update as the scorer makes changes. The scoreboard MUST offer a big-screen display mode (extra-large score and clock, full-screen) suitable for a TV or projector while the scorer controls the game from a separate device.

### Following (the multiplayer atom)

#### REQ: follow-team-player

From a scoreboard or a team/player profile, a spectator MUST be able to **follow** a team and/or an individual player. Following is a data mutation, so per [`account-gate`](../account-gate/README.md) it MUST require a **sneat.app account** — an unauthenticated viewer is prompted to sign in first (one tap: Google / email / phone). The follow MUST record a directed `follower → team` / `follower → player` edge via the `linkage` facade (`UpdateRelatedAndIDsOfSpaceItem`) using a dedicated follow relationship role (with a registered opposite), written **through the Eventus isolated graph-write-back port** (see `## Architecture`) rather than by a direct `linkage` write. Sign-in MUST be kept to one tap so following stays low-friction. (Accountless records are only for *referenced* people — e.g. a rostered player who hasn't joined — materialized later by [`first-use-backprop`](../first-use-backprop/README.md); a follower is an actor and is therefore an account.)

#### REQ: follow-notifications

A follower MUST receive notifications for the teams/players they follow covering at least: a new game scheduled, the game starting soon, the game going live, and the final result published. A spectator who does not follow MUST NOT receive notifications. Notification delivery reuses the platform's notification surface; the per-channel delivery mechanism is a plan-time decision.

### Minor Safety

#### REQ: minor-safe-public

For a player who is a minor, the public scoreboard and any public surface for that player MUST expose only the club-consented minimal fields (by default first name and jersey number) and MUST NOT expose a minor's date of birth, full personal contact details, or any field not consented through the club. The consent source of truth is the club/team in [`sneat-team`](../sneat-team/README.md); absent consent, the minor is shown by jersey number only.

## Architecture

Grounded in the existing substrate — see [`spec/research/core-modules-interface.md`](../../../research/core-modules-interface.md).

- **New module:** `sports` is a Sneat **space module** on **Firestore via dalgo** at `/spaces/{spaceID}/ext/sports/...` (same convention as `eventus`, `contactus`, `invitus`). Aggregate root: `Game` at `/spaces/{spaceID}/ext/sports/games/{gameID}`; children (collection layout finalized at plan time): `Lineup` (the present-players subset for the game) and live `Scoreboard` state (score, clock, period, status).
- **Occasion:** a game is a Calendarius happening + a thin eventus overlay (interim marker today; the `'event'` `HappeningKind` later), reusing the Eventus engine rather than forking it.
- **Teams/players:** owned by `sneat-team` (Club = `SpaceTypeClub`; Team = group/sub-space; Player/Coach = `contactus` contacts). The game references these ids; it is a graph *producer*, never the owner of identity/roster.
- **Public scoreboard:** reuses the `invitus` `link` channel + token for the shareable link/QR; the public page is gated only by token possession and exposes no private data (see `minor-safe-public`).
- **Following / graph enrichment:** account-path follows add a `follower → team/player` edge via the `linkage` facade; written behind the Eventus **isolated graph-write-back port** so the write surface stays reconcilable against the in-flight contactus refactor.
- **Surfaces:** GameBoard.live frontend (scorer control + public scoreboard + big-screen mode) and backend endpoints for game CRUD, lineup selection, scoreboard updates, link/token issuance, follow capture, and notification fan-out.

## Interaction with Other Features

- **[`sneat-team`](../sneat-team/README.md)** — owns clubs, teams, season rosters, coaches, and profiles; GameBoard.live reads rosters for `select-lineup` and reads consent for `minor-safe-public`.
- **[`first-use-backprop`](../first-use-backprop/README.md)** — materializes a team profile, creates accounts for referenced people on first real use, links the club↔family (player↔child) bridge, and upgrades bot-handle identities to accounts.
- **[Eventus](../../eventus/README.md)** — the occasion overlay + the isolated graph-write-back port this Feature writes through.
- **Calendarius** — owns the game's time/place (the happening).
- **`invitus`** — the `link` channel reused for the public scoreboard link/QR.
- **`linkage`** — the relationship graph; receives `follower → team/player` edges.
- **[`badges`](../engagement/badges/README.md)** — follow edges feed follower-loyalty badges (followers are signed-in accounts).

## Acceptance Criteria

### AC: scorer-creates-game (verifies REQ:create-game)

**Given** a signed-in scorer with a club/team space,
**When** the scorer creates a game with home team "Limerick Celtics U14 Girls", away team "Ennis Tigers U14 Girls", a date/time, and a venue,
**Then** a game record is persisted at `/spaces/{spaceID}/ext/sports/games/{gameID}` with status `scheduled`, it references the two teams without copying roster details, and it appears as a Calendarius happening.

### AC: lineup-from-roster (verifies REQ:select-lineup)

**Given** a team whose season roster has 15 players and an existing game,
**When** the scorer checks 9 of the 15 players as present,
**Then** the game lineup is persisted as exactly those 9 players (referencing roster ids), and the scorer entered no player names or numbers manually.

### AC: live-score-and-clock (verifies REQ:live-score-clock)

**Given** a `scheduled` game with a lineup,
**When** the scorer sets the game `live`, adds points to each team, starts then stops the clock, and advances from Q1 to Q2,
**Then** the persisted scoreboard reflects the updated scores, the stopped clock value, period Q2, and status `live`.

### AC: public-scoreboard-no-login (verifies REQ:public-scoreboard)

**Given** a `live` game,
**When** an unknown person with no Sneat account opens the game's shared link/QR,
**Then** they see the two teams, the current score, clock, and period without signing in, and the values update as the scorer changes them.

### AC: big-screen-mode (verifies REQ:public-scoreboard)

**Given** the public scoreboard of a game,
**When** a viewer switches to big-screen mode on a TV/projector while the scorer controls the game from a phone,
**Then** the scoreboard renders an extra-large score and clock in full-screen and continues to reflect the scorer's live changes.

### AC: account-follow-records-edge (verifies REQ:follow-team-player)

**Given** a signed-in Sneat account holder viewing a team's scoreboard,
**When** the holder follows the team and one of its players,
**Then** a `follower → team` edge and a `follower → player` edge are recorded via the `linkage` facade through the Eventus write-back port.

### AC: follow-requires-account (verifies REQ:follow-team-player)

**Given** an unauthenticated viewer on a team's scoreboard,
**When** they tap follow,
**Then** they are prompted to sign in to a sneat.app account first, and only once signed in is the `follower → team` edge recorded via the `linkage` facade through the Eventus write-back port.

### AC: followers-notified (verifies REQ:follow-notifications)

**Given** a follower of a team and a non-follower,
**When** a game for that team is scheduled, goes live, and publishes a final result,
**Then** the follower receives the scheduled / live / final-result notifications and the non-follower receives none.

### AC: minor-shown-minimally (verifies REQ:minor-safe-public)

**Given** a minor player on a roster with no club consent to publish personal details,
**When** anyone opens the public scoreboard or that player's public surface,
**Then** the player is shown by first name and jersey number only, and no date of birth or personal contact details are exposed.

## Not Doing / Out of Scope

Inherited from the [`sneat-sports`](../../../ideas/sneat-sports.md) Idea plus spec-level cuts:

- A chronological **timeline / play-by-play view** and **aggregate player/team statistics**. (Per-basket scoring attribution, team fouls, timeouts, and possession *are* now captured — owned by the [`scoreboard`](scoreboard/README.md) sub-feature — but no timeline view or stat lines are computed.)
- Tournaments, divisions, groups, and brackets.
- Sports other than basketball (period/clock rules generalized later).
- Team/player **profile authoring and club/roster management** — owned by [`sneat-team`](../sneat-team/README.md).
- Account creation, team-profile materialization, and the club↔family (player↔child) bridge — owned by [`first-use-backprop`](../first-use-backprop/README.md).
- `invitus` email/SMS/Telegram delivery and the `'event'` `HappeningKind` — deferred to the sneat-libs batch; link/QR + interim overlay marker until then.

## Assumption Carryover

From the `sneat-sports` Idea:

- **Must-be-true — a no-login scoreboard captures viewers, and signing in to follow converts them at acceptable friction.** Addressed by `public-scoreboard` (anonymous view/share) + `follow-team-player` (account-gated) and their ACs; the conversion-yield measurement is post-MVP (Open Questions).
- **Must-be-true — the follow atom is viral.** Partially addressed (the follow action + shared link exist); spectator→creator conversion is a post-MVP measurement, not an AC here.
- **Must-be-true — the club↔family bridge writes through one isolated port without forking the engine.** The follow edge here writes through the Eventus port; the bridge itself is carried by `first-use-backprop`.
- **Should-be-true — first-use back-propagation is acceptable to volunteers.** Deferred to `first-use-backprop`.

## Rehearse Integration

Rehearse stubs are deferred. The ACs are testable in principle (backend record assertions, link/token issuance, scoreboard state, follow-edge writes), but the implementation repo and its test surfaces do not exist yet. Stubs will be scaffolded during planning/implementation once backend interfaces are defined. No `_tests/` stubs are created at specify time.

## Open Questions

- **View → follow conversion.** How a no-login viewer is converted to an account at the follow moment, and how notifications reach a newly signed-in follower — coordinated with [`first-use-backprop`](../first-use-backprop/README.md) and [`account-gate`](../account-gate/README.md).
- **Shared first-use trigger.** The event that counts as a team's "first real use" (which drives [`first-use-backprop`](../first-use-backprop/README.md) — e.g. the game first going `live`) is defined authoritatively in that Feature; the Plan MUST resolve it once for both Features, not independently.
- **Named plan-time decisions:** (a) the exact name and registered opposite of the new `follower → team/player` `linkage` role; (b) the `sports` module collection layout for lineup and live scoreboard state; (c) the notification delivery channel(s) for `follow-notifications`; (d) basketball period/overtime rule parameters and how they are later generalized across sports.
- **Scorer authorization.** Whether any signed-in user can score a club's game or only club/team-authorized scorers (coordinated with `sneat-team` roles).



---
*This document follows the https://specscore.md/feature-specification*
