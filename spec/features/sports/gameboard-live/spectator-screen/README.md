---
format: https://specscore.md/feature-specification
status: Approved
---

# Feature: Spectator Game Screen

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/spectator-screen?op=explore) | [Edit](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/spectator-screen?op=edit) | [Ask question](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/spectator-screen?op=ask) | [Request change](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/spectator-screen?op=request-change) |
**Status:** Approved
**Date:** 2026-06-24
**Owner:** alex
**Source Ideas:** sneat-sports
**Supersedes:** —
**Grade:** A

> **Approved (A).** Reviewed and approved; the prior B's two open edges were decided and committed — venue detection (QR/deep-link origin + explicit "I'm here", no geolocation) and predictions visibility (shown to all pre-game; predicting requires sign-in) — and the re-review upgraded B→A.
>
> 🖼️ **Mockup:** [`../screens/screens.html`](../screens/screens.html) — the GameBoard.live screen-prototype gallery; the **Pre-game / Live / Final** tabs are this spectator surface. Illustrative only, not normative.

## Summary

The **primary spectator-facing live game page** — **one responsive surface** for both the parent in the gym and the grandparent watching from home. It renders the live scoreboard projection (no login to view or share) and turns watching into participation — **scarce 🔥 reactions** (endorsing the scoring play), **follow** via tappable team/player **profiles** (the multiplayer atom), predictions, and voting — each a mutation requiring a **sneat.app account** per [`account-gate`](../../account-gate/README.md), routed into the phase-appropriate engagement loop — **predictions** before tip-off, **MVP voting** + the **[post-game recap](../post-game-recap/README.md)** after the final whistle. **Venue-aware extras** (a prominent reaction pad, an "I'm here" presence, a follow QR) light up when the viewer is on-site; the same surface degrades gracefully online. This is where passive watching becomes participation and distribution, so it is the engagement engine of the channel — **viewing + sharing stay public and no-login**, **acting requires a one-tap sign-in**, and minor data is consent-gated. Concept/vision: [`spec/ideas/sneat-sports.md`](../../../../ideas/sneat-sports.md).

## Problem

Spectators are the largest audience and the entire virality/engagement engine, but a bare scoreboard is **passive** — you can only watch. There is no single place that turns watching into following, reacting, predicting, and (afterward) celebrating + sharing, that works equally for someone courtside and someone remote, requires no account to watch or share (acting requires a one-tap sign-in), and respects minor-safety. Splitting on-site and online into separate apps would fragment behavior and double the work. This Feature is the **one cohesive spectator surface** that composes the scoreboard and the engagement loops into a phase-aware page built for low-friction participation and graph capture.

## Behavior

### The live surface

#### REQ: live-scoreboard-render

The spectator screen MUST render the live game from the [`scoreboard`](../scoreboard/README.md) composition over the [`event-timeline`](../event-timeline/README.md) projection, updating in near-real-time, and MUST be openable by **anyone with no Sneat account**. It MUST show a live-freshness indication consistent with `scoreboard`.

#### REQ: one-responsive-surface

On-site and online spectators MUST be served by a **single responsive surface** with shared behavior — not two separate apps. Layout and emphasis adapt to context (compact courtside vs lean-back remote), but the underlying screen and its data are one.

#### REQ: venue-aware-extras

When the viewer is **on-site** — determined by **arrival via the venue/gameboard QR or deep link** and/or an explicit **"I'm here"** tap (NOT geolocation; geolocation is a deferred, optional enhancement, avoided by default for minor-privacy reasons) — the surface MUST be able to surface venue extras: a prominent 🔥 reaction pad, the **"I'm here" presence**, and a **scan-to-follow QR**. Online context omits or relabels these. Presence/venue signals MUST respect minor-safety and privacy.

### Participation

#### REQ: follow-access

The live screen MUST NOT clutter the view with team/player **follow buttons**. It MUST instead make **follow reachable** through: (a) **tappable team and player names** that open their profile pages (owned by [`sneat-team`](../../sneat-team/README.md)), where follow lives; (b) the venue **scan-to-follow QR**; and (c) the [`post-game-recap`](../post-game-recap/README.md) follow CTA at the final. Follow remains the multiplayer atom but is a **mutation requiring a sneat.app account** (per [`account-gate`](../../account-gate/README.md); one-tap sign-in) — only its **placement** moves to the profile / QR / recap surfaces rather than live-screen buttons.

#### REQ: live-reactions-surface

The screen MUST integrate [`live-reactions`](../../engagement/live-reactions/README.md): a 🔥 send control showing the viewer's **remaining budget**, the ability to stack onto a scoring moment, and the **live reaction feed**. The 🔥 control is **attached to the last scoring play** (endorse the scorer), making the per-player attribution explicit (the underlying [`live-reactions`](../../engagement/live-reactions/README.md) mechanic also permits a general game target; this screen chooses the scoring-play placement). Reactions MUST NOT alter the scoreboard's authoritative score.

#### REQ: player-stats-view

From the live spectator screen, a viewer MUST be able to open the [`players-list`](../players-list/README.md) in **public mode** — per-player **jersey #, name, points, personal fouls** (+ foul-trouble), and **minutes on court** for both teams — with minor publish-consent applied (a minor without consent shown by jersey number only; consent may restrict which stats are public). The stat set, fold, and consent rule are owned by [`players-list`](../players-list/README.md); this screen surfaces it publicly. (It is the public counterpart to the coach console's team-internal view of the same list.)

#### REQ: phase-adaptive-engagement

The screen MUST adapt to the **game phase** from the [`event-timeline`](../event-timeline/README.md) status and route to the right engagement loop: **pre-game** → fixture info (time + **venue with a map/directions link**, from the Calendarius happening) + [`predictions`](../../engagement/predictions/README.md) entry + **per-team RSVP** (opens **rsvp.express** to confirm attendance & game-day role) + a **Share game** action; **live** → scoreboard + reactions (follow via tappable names); **final** → [`MVP voting`](../../engagement/mvp-voting/README.md) entry + a prominent link to the **[post-game recap](../post-game-recap/README.md)**. The phase maps from the authoritative event-timeline status: `scheduled` → pre-game; `live` / `halftime` / `overtime` → live; `final` → final; `cancelled` → a terminal cancelled state. The pre-game **predictions entry is shown to all visitors** (no follow required to see it; **predicting itself requires a one-tap sign-in** per [`account-gate`](../../account-gate/README.md)).

### Safety & identity

#### REQ: minor-safe-no-login

The screen MUST remain **public and no-login for viewing and sharing**; any **mutation** (follow, react, vote, predict, RSVP) requires a **sneat.app account** per [`account-gate`](../../account-gate/README.md). Minor-player data shown anywhere on the surface MUST honour publish-consent ([`sneat-team`](../../sneat-team/README.md) / [`roles`](../../sneat-team/roles/README.md)); viewing/sharing MUST never force signup — the sign-in prompt appears only when a viewer chooses to act.

## Architecture

This Feature **composes** other features into a page; it owns the spectator page, its phase logic, and venue-awareness — not the scoreboard internals, the reaction mechanic, or the recap.

- **Composition:** embeds the [`scoreboard`](../scoreboard/README.md) board, the [`live-reactions`](../../engagement/live-reactions/README.md) control + feed, tappable team/player names → profiles (where follow lives) + the scan-to-follow QR, and phase-gated entry points to [`predictions`](../../engagement/predictions/README.md), [`mvp-voting`](../../engagement/mvp-voting/README.md), and the [`post-game-recap`](../post-game-recap/README.md).
- **Data:** subscribes to the [`event-timeline`](../event-timeline/README.md) live projection for score/clock/period/phase; engagement overlays are presentational and never write the official record.
- **Responsive surface:** one web surface with breakpoints; venue context resolved from QR/deep-link origin or an explicit "I'm here" declaration (geolocation deferred/optional), toggling venue extras.
- **Identity:** viewing is anonymous; any mutation requires a sneat.app account (per [`account-gate`](../../account-gate/README.md)); consent read from `sneat-team`/`roles`.
- **Relation to gameboard mode:** the big-screen TV/projector view is the [`scoreboard`](../scoreboard/README.md) big-screen mode, not this spectator page.

## Interaction with Other Features

- **[`scoreboard`](../scoreboard/README.md)** — the board composition this screen renders (and whose big-screen mode is the separate gameboard).
- **[`event-timeline`](../event-timeline/README.md)** — the live projection + game phase driving the surface.
- **[`live-reactions`](../../engagement/live-reactions/README.md)** — the 🔥 control, budget, and feed embedded here.
- **[`gameboard-live`](../README.md)** — the game itself and the follow atom (reached via team/player profiles, not live-screen buttons).
- **[`predictions`](../../engagement/predictions/README.md)** / **[`mvp-voting`](../../engagement/mvp-voting/README.md)** — phase-gated engagement entry points.
- **[`post-game-recap`](../post-game-recap/README.md)** — the final-phase destination this screen links to.
- **[`first-use-backprop`](../../first-use-backprop/README.md)** — materializes referenced (passive) nodes and upgrades bot-handle identities; actors here are accounts.
- **[`sneat-team`](../../sneat-team/README.md)** / **[`roles`](../../sneat-team/roles/README.md)** — minor publish-consent.
- **[`screens`](../screens/README.md)** — the UI map this surface is inventoried in.
- **[`gameboardlive-bot`](../gameboardlive-bot/README.md)** — a parallel chat surface mirroring follow/notify.
- **rsvp.express** *(sister product)* — the pre-game per-team RSVP surface for confirming attendance and game-day role (player / coach / judge / score-sheet keeper / spectator / …); its responses can inform the game lineup and the `roles` game-day assignments. Reached from the pre-game phase; specified separately (see Open Questions).

## Acceptance Criteria

### AC: renders-live-no-login (verifies REQ:live-scoreboard-render)

**Given** a live game and a person with no account,
**When** they open the spectator screen,
**Then** the live score/clock/period render and update in near-real-time without any login.

### AC: single-surface-adapts (verifies REQ:one-responsive-surface)

**Given** the spectator screen,
**When** it is opened on a phone courtside and on a laptop at home,
**Then** the same surface serves both, adapting layout while sharing the same behavior and data (not two separate apps).

### AC: venue-extras-on-site-only (verifies REQ:venue-aware-extras)

**Given** a viewer in on-site (venue) context and another in online context,
**When** each opens the screen,
**Then** the on-site viewer sees venue extras (prominent reaction pad, optional "I'm here", follow QR) and the online viewer does not.

### AC: follow-via-profile (verifies REQ:follow-access)

**Given** a no-account spectator on the live screen,
**When** they tap a team or player name,
**Then** that team/player profile opens where they sign in (one tap) to follow, and the live screen itself shows no team/player follow buttons.

### AC: react-with-budget (verifies REQ:live-reactions-surface)

**Given** a spectator with reactions remaining,
**When** they send 🔥 on a scoring moment,
**Then** the 🔥 appears on the live feed, their remaining budget decrements, and the scoreboard score is unchanged.

### AC: player-stats-list (verifies REQ:player-stats-view)

**Given** a live game,
**When** a spectator opens the players list,
**Then** each player shows jersey #, name, points, personal fouls, and minutes on court for both teams, with a minor's display consent-gated (jersey number only without consent).

### AC: surface-follows-phase (verifies REQ:phase-adaptive-engagement)

**Given** a game moving from pre-game to live to final,
**When** the spectator screen is viewed in each phase,
**Then** it shows fixture info with venue + directions, predictions entry, per-team RSVP, and a Share game action pre-game; scoreboard + reactions (follow via tappable names) when live; and MVP-voting entry + a recap link once final.

### AC: minor-safe-public (verifies REQ:minor-safe-no-login)

**Given** a minor player without publish-consent shown on the screen,
**When** any spectator views it,
**Then** the minor is shown only by the consent-permitted fields and no signup is forced for viewing/following/reacting.

## Not Doing / Out of Scope

- **Operator controls** (score-sheet, clock/board, judge, coach) — separate consoles, not the spectator surface.
- **The scoreboard composition internals and big-screen gameboard mode** — owned by [`scoreboard`](../scoreboard/README.md).
- **The post-game recap surface** — its own [`post-game-recap`](../post-game-recap/README.md) Feature; this screen only links to it at final.
- **The reaction, prediction, and voting mechanics** — owned by their engagement Features; this screen embeds their UIs.
- **The sharing/QR distribution mechanism** — a separate distribution concern; this screen hosts the scan-to-follow QR but does not own link generation, and intentionally hosts **no team/player follow buttons** (follow lives on profile pages).

## Assumption Carryover

From the `sneat-sports` Idea:

- **Must-be-true — anonymous distribution, account-gated capture.** Viewing + sharing are public and no-login (distribution); follow and other actions require a sneat.app account (the graph-capture payment). Addressed by `live-scoreboard-render`, `follow-access`, `minor-safe-no-login`.
- **Must-be-true — following is the multiplayer atom.** The screen puts reactions at the centre of the live experience and routes to follow via profiles, converting watchers into followers. Addressed by `follow-access` + `live-reactions-surface`.

## Rehearse Integration

Rehearse stubs are deferred. The ACs are testable in principle (no-login render, responsive single-surface, venue-gated extras, one-tap follow, budgeted reactions, phase adaptation, consent-gated minor display), but the implementation repo and the `sports` module do not exist yet and this is Draft. Stubs will be scaffolded during planning/implementation if promoted. No `_tests/` stubs are created at specify time.

## Open Questions

- **Recap inlining** — how much of the [`post-game-recap`](../post-game-recap/README.md) is teased inline on the final-phase screen vs linked out.
- **Notification opt-in** — where the screen offers notify-me (via [`gameboardlive-bot`](../gameboardlive-bot/README.md)) without friction.
- **One-account integrity** — resisting multi-account / multi-device inflation of reactions/follows/votes even with accounts required.
- **RSVP / rsvp.express** — the pre-game RSVP integration (attendance + game-day role) is a sister-product surface this screen links to; it warrants its **own idea/feature** — how responses feed the game lineup and `roles` game-day assignments, accountless RSVP, and minor consent.

---
*This document follows the https://specscore.md/feature-specification*
