---
format: https://specscore.md/feature-specification
status: Approved
---

# Feature: New Game

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/new-game?op=explore) | [Edit](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/new-game?op=edit) | [Ask question](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/new-game?op=ask) | [Request change](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/new-game?op=request-change) |
**Status:** Approved
**Date:** 2026-06-24
**Owner:** alex
**Source Ideas:** sneat-sports
**Supersedes:** —
**Grade:** A

> **Approved (A).** The on-ramp to the whole GameBoard.live / sneat.team journey. Elaborates [`gameboard-live` REQ:create-game](../README.md) into the full creation flow.
>
> 🖼️ **Mockup:** [`../screens/screens.html`](../screens/screens.html) — the **New game** tab of the GameBoard.live screen-prototype gallery (two team names + date/time, optional venue/competition, self-declared creator role). Illustrative only, not normative.

## Summary

The **entry point to the entire vertical**: an account-holding organizer creates a game in seconds, and that single act seeds everything downstream — the live scoreboard, following, engagement loops, and (on first real use) the materialization of durable **sneat.team** team profiles + accounts + the club↔family graph edges via [`first-use-backprop`](../../first-use-backprop/README.md). Creation is **ad-hoc-first**: you need only **two team names and a time**. Each side may be an existing sneat.team team (picked) or an **ad-hoc** team (just a name — no club, roster, or accounts required up front); durable profiles materialize later, lazily. The creator must have a **sneat.app account** (a one-tap *Sign in with Google* / email / phone) and becomes the game's **organizer/scorer** — a deliberate, low-friction requirement that many downstream features rely on. At creation the organizer also **discloses their relationship to the game** — coach / player / judge / score-recorder / timekeeper / spectator (and, if spectator, fan-of-a-team or neutral) — recorded for transparency about who is keeping the official record. This Feature owns the *creation journey*; the live game, lineup, and lifecycle are owned by [`gameboard-live`](../README.md) and [`event-timeline`](../event-timeline/README.md). Concept/vision: [`spec/ideas/sneat-sports.md`](../../../../ideas/sneat-sports.md).

## Problem

GameBoard.live's entire flywheel starts with one act — someone creating a game — yet that's also where friction kills adoption. If creating a game first demands a club, a roster, and accounts for everyone, a coach standing courtside won't bother. The platform needs the **lowest-friction on-ramp that still seeds the graph**: create a game with almost nothing, run it, and let the durable structure (club/team profiles, player accounts, family edges) materialize *as a by-product of real use* rather than as a prerequisite. This Feature defines that on-ramp — ad-hoc team entry, a single committed owner, and a clean hand-off to [`first-use-backprop`](../../first-use-backprop/README.md) — making game creation the deliberate bridge from "a phone at a gym" to a populated sneat.team.

## Behavior

### Who creates

#### REQ: account-creator

Creating a game MUST require a **sneat.app account**. The creating user becomes the game's **organizer** (and default **scorer**). This requirement is **deliberate**: a known, persistent owner is a precondition for the many downstream features that attribute control and identity (scoring authority, game-day roles, organizer actions, the cross-product bootstrap), so the creator is the one participant who must be a real account. It is also **low-friction** — a one-tap *Sign in with Google* or an email/phone sign-in — not a heavy gate. Spectators, followers, and players still need **no** account. (Account sign-up itself is owned by Sneat auth, not this Feature.)

#### REQ: creator-affiliation

At creation the organizer MUST **disclose their relationship to the game** by choosing one: **coach**, **player**, **judge**, **score-recorder** (score-sheet keeper), **timekeeper** (clock/board runner), or **spectator**. If they choose **spectator**, they MUST further declare **team affiliation** — a **fan of** one of the two teams, or **neutral**. The disclosure is recorded on the game and exists for **transparency and authority**: a game whose official record is kept by a team's coach carries different trust than one kept by a neutral spectator. A disclosed official role (coach / judge / score-recorder / timekeeper) is the creator's initial game-day **role** claim ([`roles`](../../sneat-team/roles/README.md)); a **spectator** creator signals a non-official scorer, informing the [`consensus-scoring`](../consensus-scoring/README.md) / [`event-timeline` source-authority](../event-timeline/README.md) posture. The disclosure is **self-declared** (not verified) and surfaced to viewers (see Open Questions). When the creator is a **fan** of a team, the flow continues into the [`account-gate`](../../account-gate/README.md) relationship-capture probe (related to a player? → parent/relative/friend), and **all mutating actions** in the game follow that gate (account required).

### What it takes

#### REQ: minimal-to-create

The **minimum** to create a game MUST be just **two team names and a date/time** (plus the creator's one-tap affiliation disclosure, `creator-affiliation`). A roster, lineup, opponent details, venue, competition, and game-day roles MUST all be **optional at creation** and addable later. Nothing about creation may require the away side to have a Sneat presence.

#### REQ: ad-hoc-or-existing-teams

Each side of a game MUST be either an **existing sneat.team team** (selected) or an **ad-hoc team** (a typed name, carrying no club/roster/accounts). A game MUST be creatable with zero, one, or two ad-hoc sides. An ad-hoc team is a lightweight stub on the game; it is NOT eagerly turned into a sneat.team team (materialization is deferred — see `bootstraps-journey`).

#### REQ: schedule-and-place

The organizer MUST be able to set the game's **date/time** and, optionally, a **venue** and **competition label**. Time + place establish the game as a Calendarius **happening** with a thin **eventus overlay** (so it appears on the calendar), and the venue is what the [`spectator-screen`](../spectator-screen/README.md) later shows with map/directions.

#### REQ: team-colour

At creation the organizer MAY set a **brand colour per team** (a colour picker beside each team name). The colour is a **team attribute** that distinguishes the two sides across every surface (scoreboard, big-screen, box score, score-progress chart, team/player pages). An **ad-hoc** team's colour is chosen here; an **existing** sneat.team team carries its own brand colour. **Sensible defaults are provided** so colour is never required to create. The colour attribute is **owned by [`sneat-team`](../../sneat-team/README.md)** (team profile); this flow only sets it for ad-hoc sides at creation.

### What creation produces

#### REQ: creates-scheduled-game

Creation MUST persist the **sports game aggregate** at status **`scheduled`** (the later `live`/`final`/`cancelled` lifecycle is owned by [`gameboard-live`](../README.md) / [`event-timeline`](../event-timeline/README.md), not here), and MUST make the game **shareable immediately** — a public link, QR, and human-typable **game #** (per the [`screens`](../screens/README.md) map; reusing the `invitus` `link` channel) — so the organizer can invite people before tip-off.

### The journey hand-off

#### REQ: bootstraps-journey

Creating a game MUST be the **trigger point** for the cross-product journey, but MUST NOT eagerly create club/team profiles or accounts. Instead it records the references/stubs (existing-team references and ad-hoc-team names) so that on **first real use** (the game goes `live` / scoreboard is published) [`first-use-backprop`](../../first-use-backprop/README.md) materializes the durable **sneat.team** team profile(s) for ad-hoc teams, opt-in accounts, and the club↔family edges. This Feature creates the game; first-use-backprop deposits the durable graph.

### Getting ready (optional, post-creation)

#### REQ: organizer-next-steps

From a created game, the organizer MUST be able to (all **optional**, none required to create): select the **lineup** ([`gameboard-live` select-lineup](../README.md)) for an existing team's roster; assign or invite **game-day roles** ([`roles`](../../sneat-team/roles/README.md), incl. RSVP via [`rsvp-express`](../../../../ideas/rsvp-express.md)); and **share** the game. These prepare the game without blocking its creation.

## Architecture

Grounded in the existing substrate — see [`spec/research/core-modules-interface.md`](../../../../research/core-modules-interface.md).

- **Identity:** creation is gated on an authenticated sneat.app account; the creator id is recorded as organizer/scorer.
- **Game aggregate:** persisted at `/spaces/{spaceID}/ext/sports/games/{gameID}` at `scheduled`. For an organizer with no club yet, the game is created in their available space (personal/owner space); ad-hoc teams are stubs on the game. The exact pre-materialization home and how it re-homes into a club/team space at first-use-backprop are plan-time decisions.
- **Teams:** an existing side references a `sneat.team` team id; an ad-hoc side is a `{name}` stub. No roster is copied (consistent with `gameboard-live` create-game).
- **Calendarius + eventus:** time/place create a Calendarius happening + thin eventus overlay; the eventus isolated write-back port is the path first-use-backprop later uses.
- **Shareability:** `invitus` `link` channel → public link + QR + game #; viewable via [`scoreboard`](../scoreboard/README.md) / [`spectator-screen`](../spectator-screen/README.md).
- **Hand-off:** new-game writes only the game + stubs; first-use-backprop owns materialization on first real use.

## Interaction with Other Features

- **[`gameboard-live`](../README.md)** (parent) — this Feature elaborates its `create-game` REQ; gameboard-live owns `select-lineup`, live scoring, and the status lifecycle.
- **[`first-use-backprop`](../../first-use-backprop/README.md)** — consumes the created game + ad-hoc stubs; materializes sneat.team profiles, accounts, and club↔family edges on first real use.
- **[`sneat-team`](../../sneat-team/README.md)** — source of existing teams to pick; destination for materialized ad-hoc teams.
- **[`event-timeline`](../event-timeline/README.md)** — owns the status lifecycle after `scheduled`.
- **[`scoreboard`](../scoreboard/README.md)** / **[`spectator-screen`](../spectator-screen/README.md)** — render the created game; surface its share link / QR / game #.
- **[`roles`](../../sneat-team/roles/README.md)** + **[`rsvp-express`](../../../../ideas/rsvp-express.md)** — optional post-creation role assignment / RSVP; the creator's disclosed official role (coach/judge/score-recorder/timekeeper) is their initial game-day role claim.
- **[`consensus-scoring`](../consensus-scoring/README.md)** / **[`event-timeline`](../event-timeline/README.md)** — the creator's disclosed affiliation informs the authority/trust posture (neutral spectator-scorer vs a team coach) and whether consensus supplements a non-official scorer.
- **Calendarius / Eventus / `invitus`** — the happening, the overlay + write-back port, and the share-link channel.

## Acceptance Criteria

### AC: account-required-to-create (verifies REQ:account-creator)

**Given** a signed-in user with a sneat.app account and a visitor with no account,
**When** each tries to create a game,
**Then** the account holder creates it and becomes the game's organizer/scorer, and the no-account visitor cannot create a game.

### AC: creator-discloses-affiliation (verifies REQ:creator-affiliation)

**Given** an organizer creating a game,
**When** they declare their relationship to the game,
**Then** they must pick coach / player / judge / score-recorder / timekeeper / spectator; if they pick spectator they must additionally declare fan-of-a-team or neutral; and the disclosure is recorded on the game.

### AC: create-with-two-names-and-time (verifies REQ:minimal-to-create)

**Given** an organizer with no club, roster, or opponent set up,
**When** they enter two team names and a date/time and nothing else,
**Then** the game is created successfully (roster/lineup/venue/roles all left empty).

### AC: ad-hoc-and-existing-sides (verifies REQ:ad-hoc-or-existing-teams)

**Given** an organizer whose club has team "U14 Girls" in sneat.team and an opponent that does not,
**When** they create a game picking "U14 Girls" for the home side and typing "Riverside Raptors" for the away side,
**Then** the home side references the existing sneat.team team and the away side is recorded as an ad-hoc stub (no roster, no sneat.team team created yet).

### AC: sets-team-colour (verifies REQ:team-colour)

**Given** the creation form with a colour picker beside each team name,
**When** the organizer creates a game leaving the colours at their defaults or choosing new ones,
**Then** each team carries a brand colour used to distinguish the sides on later surfaces, and creation succeeds without requiring a colour choice.

### AC: scheduled-and-shareable (verifies REQ:creates-scheduled-game + REQ:schedule-and-place)

**Given** a newly created game with a date/time and venue,
**When** creation completes,
**Then** the game is persisted at status `scheduled`, appears as a Calendarius happening, and exposes a public link, QR, and game # to share — before any lifecycle change.

### AC: materialization-deferred-to-first-use (verifies REQ:bootstraps-journey)

**Given** a game created with an ad-hoc team,
**When** the game is only `scheduled` (not yet used),
**Then** no sneat.team team profile or accounts have been created for the ad-hoc side; and only when the game first goes `live` / its scoreboard is published does first-use-backprop materialize them.

### AC: optional-next-steps (verifies REQ:organizer-next-steps)

**Given** a freshly created game,
**When** the organizer chooses to set a lineup, invite a game-day role, or share the game,
**Then** each is available but none was required for the game to exist.

## Not Doing / Out of Scope

- **Roster / lineup management** — owned by [`sneat-team`](../../sneat-team/README.md) and [`gameboard-live` select-lineup](../README.md); creation only optionally links to them.
- **Live scoring + status transitions** (`live`/`final`/`cancelled`) — owned by [`gameboard-live`](../README.md) / [`event-timeline`](../event-timeline/README.md).
- **Eager club/team profile + account creation** — deferred to [`first-use-backprop`](../../first-use-backprop/README.md) on first real use.
- **Account sign-up / authentication** — Sneat auth; this Feature requires an account but does not own creating one.
- **RSVP / role mechanics** — [`rsvp-express`](../../../../ideas/rsvp-express.md) / [`roles`](../../sneat-team/roles/README.md).
- **Recurring fixtures, seasons, tournaments, brackets** — single-game creation only.

## Assumption Carryover

From the `sneat-sports` Idea:

- **Must-be-true — "run one game first" with near-zero setup.** The whole bet is that a coach will create a game on the spot; ad-hoc teams + minimal-to-create address it. The one required step — the organizer's account — is a one-tap social / email / phone sign-in, deliberately kept light, and is justified by the many downstream features that depend on a known owner.
- **Must-be-true — the club↔family graph bridge.** new-game is the explicit trigger that, via first-use-backprop, turns a casual game into durable sneat.team structure and family edges. Addressed by `bootstraps-journey`.

## Rehearse Integration

Rehearse stubs are deferred. The ACs are testable in principle (account gating, minimal create, ad-hoc vs existing sides, scheduled+shareable, deferred materialization, optional next steps), but the implementation repo and the `sports` module do not exist yet and this is Draft. Stubs will be scaffolded during planning/implementation. No `_tests/` stubs are created at specify time.

## Open Questions

- **Pre-materialization home.** Which space a game lives in before first-use-backprop (organizer personal/owner space vs a provisional club space), and how it re-homes cleanly.
- **Ad-hoc team dedup.** Avoiding duplicate sneat.team profiles when two organizers each create games naming the same real team (matching/merge at materialization).
- **Opponent claim.** How the away (ad-hoc) team's real club later discovers and claims its materialized profile.
- **Minimum to go live.** Whether a game can go `live` with ad-hoc teams and no roster (consensus/ad-hoc scoring), or whether some setup is required before tip-off.
- **Affiliation transparency & trust.** Where the creator's self-declared affiliation is shown to viewers (e.g. "scored by a Celtics coach" vs "neutral spectator"), and how a self-declared (unverified) affiliation interacts with the official-vs-consensus authority model.

---
*This document follows the https://specscore.md/feature-specification*
