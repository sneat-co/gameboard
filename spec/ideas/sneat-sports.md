---
format: https://specscore.md/idea-specification
status: Specified
---

# Idea: Sneat Sports — Sports as Eventus's Highest-Yield Occasion Channel

**Status:** Specified
**Date:** 2026-06-23
**Owner:** alex
**Promotes To:** sports, sports/gameboard-live, sports/gameboard-live/coach-console, sports/gameboard-live/consensus-scoring, sports/gameboard-live/event-timeline, sports/gameboard-live/gameboardlive-bot, sports/gameboard-live/learn-to-score, sports/gameboard-live/new-game, sports/gameboard-live/players-list, sports/gameboard-live/post-game-recap, sports/gameboard-live/role-invites, sports/gameboard-live/scoreboard, sports/gameboard-live/scorekeeper-console, sports/gameboard-live/screens, sports/gameboard-live/spectator-screen, sports/gameboard-live/timekeeper-console
**Supersedes:** —
**Related Ideas:** —

## TL;DR

Sneat enters sports with **two surfaces on one engine**: **GameBoard.live** — a sharp, anonymous-friendly live-scoring and public-scoreboard channel (the viral front door) — and **sneat.team** — the club/team/roster/coach management layer it sits on. The strategic claim is that **a game is the perfect [Eventus](eventus.md) occasion**: following a team or player is the multiplayer atom (graph growth, now account-gated per [`account-gate`](../features/sports/account-gate/README.md)), while anonymous viewing + sharing supplies the viral distribution, and the residue a youth game deposits is uniquely rich because it **bridges two graphs Sneat otherwise keeps apart — the *club graph* (club→team→player→coach) and the *family graph* (parent↔child)**. The first time a team is actually used on GameBoard.live, durable platform entities materialise: a **team profile** in sneat.team and **user accounts** on `sneat.app`. This is not a scoreboard product; it is an Eventus channel that turns a no-login live scoreboard into the lowest-friction relationship-graph capture Sneat has.

## Problem Statement

How might we capture the dense, motivated relationship web around amateur and youth sport — players, parents, grandparents, coaches, fans — into Sneat's relationship graph at near-zero friction, by leading with a live scoreboard nobody has to log in to watch?

## Context

This is **greenfield**: today nothing exists for sports in the Sneat repos — no `gameboard`/`sneat.team` code, no sports module. This Idea pins the concept before any build so the work can aim at it.

It is written as a channel within the [eventus](eventus.md) concept (see that Idea's thesis: *occasion → multiplayer interaction → graph residue → viral distribution*). Sneat is a space-scoped life-organiser on Firestore via `dalgo`, with `spaceus`/`contactus`/`linkage` as substrate and Calendarius as the when-and-where axis ([`spec/research/core-modules-interface.md`](../research/core-modules-interface.md)). The substrate is already shaped for sport:

- **`spaceus`** already defines `SpaceTypeClub` and `SpaceTypeGroup` alongside `SpaceTypeFamily` (`coretypes/space_type.go`) — a sports **Club** is a Club space; a **Team** is a group/sub-space.
- **`contactus`** holds people within a space with extensible roles including `child`/`adult` (`const4contactus/member_roles.go`) — **Players** and **Coaches** are contacts with sports roles.
- **`linkage`** is the directed, multi-role relationship graph and already models `parent`↔`child` and `manager`↔`direct_report` (`dbo4linkage/`) — **coach↔player**, **follower→team/player**, and the **player↔child** bridge are new roles on the same facade.
- **Calendarius + Eventus** provide the occasion: a **Game** is a Calendarius *happening* + a thin eventus overlay; **`invitus`** already provides the tokenised `link` channel that the public scoreboard URL reuses.

The strategic asset, as everywhere in this repo, is the **relationship graph** — and its cold-start emptiness is the wall. Sport is unusually good fuel for it: one youth game pulls in players, both sets of parents, grandparents, coaches, and fans, each with a strong, recurring motive to follow.

## The Thesis

1. **A game is the perfect Eventus occasion.** It is inherently multiplayer, recurring (a season of them), and emotionally motivated. The "occasion's natural questions" — who is playing, who is in the lineup, what was the score — *are* graph data, surfaced as a by-product of a useful live scoreboard.
2. **Anonymous sharing distributes; account-gated following grows the graph.** Opening and **sharing the public scoreboard link** is the viral, no-account act — a parent shares the live link to grandparents, supporters pass it around; every shared scoreboard is acquisition. **Following a team/player** (and reacting, voting, predicting) is the graph-growing act and, per [`account-gate`](../features/sports/account-gate/README.md), **requires a sneat.app account** — converting an engaged viewer into a real account + relationship edges (the payment for a free product). The solo parts (entering a roster, running the clock) grow and distribute nothing — they stay off the critical path, exactly as Eventus quarantines solo planning.
3. **The residue bridges club↔family graphs (the headline differentiator and moat).** A youth player is simultaneously a *roster entry* in the club graph and *someone's child* in the family graph. Following your kid's team is the act that links the two. No scoreboard competitor builds a relationship graph at all, let alone a bridged one — defensibility comes from the bridged graph, not from scoreboard features anyone can copy.
4. **Two surfaces, one engine, residue lands on the platform.** GameBoard.live is the channel; sneat.team is the management layer it sits on; `sneat.app` is where residue lands. **First real use back-propagates durable entities**: a team profile in sneat.team and user accounts on `sneat.app`, plus club↔family edges in `contactus`/`linkage` via Eventus's isolated graph-write-back port.

**Honest current reality:** none of this is built. This document fixes the concept so the build can target it.

## What Sneat Sports Is

Two branded surfaces on the shared Sneat platform and the Eventus engine:

- **GameBoard.live (the channel / viral front door).** A single volunteer scorer creates a game, confirms the lineup from a reused season roster, controls score and clock, and publishes a public scoreboard (phone, tablet, TV, projector, big-screen mode). **Spectators watch and share with no account; following requires a one-tap sign-in** (per [`account-gate`](../features/sports/account-gate/README.md)). Maps to: Game = Calendarius happening + eventus overlay; public scoreboard = tokenised `link` (à la `invitus`); follow = a `linkage` role written by a signed-in account; notifications via the platform's delivery surface.
- **sneat.team (the management layer).** Club, team, roster, coach, and schedule management; team and player profiles. Maps to: Club = `SpaceTypeClub`; Team = group/sub-space; Player/Coach = `contactus` contacts with sports roles; coach↔player = `linkage` roles.

**The cross-product residue flow (the keystone):** the first time a team is actually used on GameBoard.live →
1. a **team profile** is created in **sneat.team** (the durable management entity), and
2. **user accounts** are created on **`sneat.app`** (platform identity), and
3. **club↔family graph edges** are written through Eventus's **isolated graph-write-back port** (`contactus`/`linkage`), keeping the write surface reconcilable against the in-flight contactus refactor.

## Why This Is Different

- **Not a scoreboard app.** Competitors optimise scoreboard features; Sneat Sports optimises graph growth and distribution and treats scorekeeping as the bait, not the product.
- **The bridged graph is the moat.** Following your child's team links the club graph to the family graph — a uniquely defensible asset no scoreboard tool builds.
- **The product is the residue; the channel is viral.** Anonymous spectating drives distribution; the durable value (profiles, accounts, edges) accrues on the platform.

## Recommended Direction

Treat Sneat Sports as an **Eventus channel** and prove the full loop on **one sport (basketball) and the live-game + follow path first**, before any breadth. Stand up the GameBoard.live loop — *scorer creates game → public scoreboard link → spectators follow team/players → notifications → followers + first-use back-propagation deposit team profile (sneat.team) + accounts (`sneat.app`) + club↔family edges* — with graph write-back behind the Eventus isolated port. Provision only the minimum sneat.team management needed to run one game (create club/team, roster, lineup). Defer statistics, timeline/play-by-play, tournaments, and multi-sport to future enhancements. Add the bridged-graph residue (player↔child linking) as a headline outcome, carrying its harder privacy/modelling questions explicitly as Open Questions rather than blocking the loop on them.

## Alternatives Considered

- **A standalone scoreboard product (compete on features).** Rejected: scoreboard features are commodity and copyable; they build no graph and so no moat.
- **Management-first (lead with sneat.team club/roster admin).** Rejected: solo management neither grows the graph nor distributes the product; only the live-game + follow loop does. Build the minimum management the loop needs and let the rest follow demand.
- **A separate sports vertical not governed as an Eventus channel.** Rejected: the occasion → multiplayer → residue → virality logic is exactly Eventus; forking it would duplicate the engine and lose the shared graph-write-back port.
- **Keep the club graph and family graph separate.** Rejected for the headline: the bridge (player↔child) is the differentiator. Its privacy/modelling cost is real and is carried as Open Questions, not avoided.
- **Require accounts for participation (any mutation), while keeping viewing + sharing anonymous.** **Adopted (revised decision).** Anonymous viewing + sharing still drives distribution, but any data mutation — follow, react, vote, predict, RSVP — requires a sneat.app account, because real accounts + relationship edges are how users pay for a free product (see [`account-gate`](../features/sports/account-gate/README.md)). This reverses the earlier bet on fully-anonymous participation, trading some follow volume for account/graph quality.

## MVP Scope

**Smallest increment that proves the concept:** the **GameBoard.live live-game + follow loop on basketball** — a scorer creates a game, confirms a lineup from a reused team roster, controls score/clock, and publishes a public no-login scoreboard (anyone can view + share); spectators **sign in to follow** the team and players (per `account-gate`) to receive game-starting / live / final-score notifications; and **first real use back-propagates a team profile into sneat.team and user accounts onto `sneat.app`**, with club↔family graph edges written behind Eventus's isolated port. Decomposed into Feature(s) at specify time.

**Out of this increment:** statistics, game timeline / play-by-play, tournaments/divisions/brackets, multi-sport, big-screen polish beyond a usable public scoreboard, and any sneat.team management beyond what is needed to run one game.

## Not Doing (and Why)

- Game timeline, play-by-play and statistics — future enhancements off the MVP path
- Tournaments, divisions and brackets — future, after the single-game loop is proven
- Multi-sport breadth at launch — prove the loop on basketball first
- Heavy solo management features on the critical path — minimum sneat.team needed to run one game; the rest follows the loop

## Key Assumptions to Validate

| Tier | Assumption | How to validate |
|------|------------|-----------------|
| Must-be-true | A no-login live scoreboard captures **viewers**, and **signing in to follow** converts them to accounts at materially lower friction and higher yield than deliberate contacts entry. | Pilot one team's season; measure viewers per game and view→sign-in-to-follow conversion vs deliberate-entry baselines. |
| Must-be-true | The share + view loop is genuinely viral — spectators (parents → grandparents → fans) convert into signed-in followers and new team creators. | Instrument shared-link opens, viewer fan-out per game, and viewer→signed-in-follower / first-time-creator conversion across a season. |
| Must-be-true | The club↔family bridge can be modelled and written through Eventus's one isolated port without forking the engine. | Sketch player↔child linking against `contactus`/`linkage` + the Eventus write-back port; confirm no engine fork and one reconcile surface. |
| Should-be-true | First-use back-propagation (team profile + accounts) is acceptable to volunteers and does not deter scoring. | Test the create-game → first-use flow with volunteer scorers; measure drop-off at account materialisation. |
| Should-be-true | A standalone GameBoard.live brand acquires better than an in-app sports tab, for a spectator who arrives via a shared link. | A/B the GameBoard.live channel surface vs an in-app flow; compare follow completion and onward sharing. |
| Might-be-true | The same loop generalises to other sports without rework. | Defer; admit further sports only once basketball's loop is proven. |

## SpecScore Integration

- **New Features this would create (decomposed at specify time):**
  - *GameBoard.live channel* — game-as-occasion, lineup from roster, live score/clock, public no-login scoreboard, follow team/player, game notifications.
  - *sneat.team management* — club/team/roster/coach + team and player profiles (minimum to run a game first; profiles thereafter).
  - *First-use back-propagation* — team-profile creation in sneat.team + `sneat.app` account creation + club↔family edge write-back through the Eventus isolated port.
- **Existing Features affected:** builds on [`eventus`](eventus.md) (engine + isolated write-back port) and `eventus-mvp`; reuses Calendarius, `spaceus` (`SpaceTypeClub`/`SpaceTypeGroup`), `contactus`, `linkage`, `invitus` (`link` channel).
- **Dependencies:** `spaceus`, `contactus`, `linkage`, Calendarius, `invitus`, the Eventus engine, `sneat-api`, Sneat auth; shared Firebase project `sneat-eur3-1`. New `linkage` roles (follower→team/player, coach↔player, player↔child) and a new sports module persistence path are preconditions decided at specify time.

## Open Questions

- **Minors' privacy.** What is exposed on a public player profile / scoreboard for a child, and who consents — the club, the parent, or both — under the border-checkpoint model?
- **View → account conversion.** How a no-login viewer is converted to a `sneat.app` account at the follow/act moment, and what minimal PII makes them a useful graph node without killing the funnel.
- **Auto-created-account consent.** Whether/how accounts created on first team use are claimed and consented to, and what happens to unclaimed ones.
- **Team modelling.** Team as a `SpaceTypeGroup`, a sub-space of the Club, or a contactus grouping — and how season rosters version across seasons.
- **Player↔child bridge mechanics.** How a roster player is matched/linked to an existing family-space child without duplicating contacts, and the direction/visibility of that edge.
- **Channel branding.** Standalone `GameBoard.live` / `sneat.team` brands vs explicit "by Sneat" surfaces, and when Sneat is introduced to spectators.
- **Multi-sport generalisation.** What is basketball-specific (periods, clock rules) vs reusable across sports.

---
*This document follows the https://specscore.md/idea-specification*
