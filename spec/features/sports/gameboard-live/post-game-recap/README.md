---
format: https://specscore.md/feature-specification
status: Approved
---

# Feature: Post-Game Recap

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/post-game-recap?op=explore) | [Edit](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/post-game-recap?op=edit) | [Ask question](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/post-game-recap?op=ask) | [Request change](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports/gameboard-live/post-game-recap?op=request-change) |
**Status:** Approved
**Date:** 2026-06-24
**Owner:** alex
**Source Ideas:** sneat-sports
**Supersedes:** —
**Grade:** A

> **Approved (A).** Reviewed and approved; advisory applied (best-predictor pinned to the single-game closest call). The OG-card correction-after-final question is flagged for planning.

## Summary

The **shareable post-game summary** — the page a parent posts to Facebook or drops into a WhatsApp/Telegram family group after the final whistle. It composes the **final score** (with per-period detail), the **box score**, the **Team MVP + Opponents' Choice** results, the **badges earned**, and a highlight of **this game's best predictor** (linking to the predictors leaderboard). It is built to look great as a **social/Open-Graph share card**, carries a **no-login follow CTA** so recipients who arrive via a shared link become followers, and is **public + minor-safe**. Crucially, arriving via the recap lets a newcomer *view* results but **not vote** for MVP (they didn't engage before the final whistle). This is the surface that converts a game's outcome into reach and new graph edges. Concept/vision: [`spec/ideas/sneat-sports.md`](../../../../ideas/sneat-sports.md).

## Problem

The moment a game ends is the peak emotional moment — exactly when people want to share "we won!" / "look how my kid did". If the only artifact is a bare scoreboard, that energy is lost and so is the viral reach. We need a **purpose-built recap** that summarises the game richly, looks great when pasted into social and messenger apps, reveals the celebratory payoffs (MVP, badges, best predictor), and turns each share into new follows — while staying public, minor-safe, and resistant to letting post-hoc arrivals distort the game's awards.

## Behavior

### Composition

#### REQ: recap-composition

The recap MUST present the finished game's summary, openable by **anyone with no account**: the **final score** with per-period breakdown (from [`scoreboard`](../scoreboard/README.md) / [`event-timeline`](../event-timeline/README.md)), the **box score** (the official [`players-list`](../players-list/README.md) in public mode — points/fouls/minutes per player, consent-gated), the **Team MVP and Opponents' Choice** results ([`mvp-voting`](../../engagement/mvp-voting/README.md)), and the **badges earned** in the game ([`badges`](../../engagement/badges/README.md)).

#### REQ: recap-charts

The recap MUST include a **score-progression chart** — a line chart with **one line per team**, x = game time, y = cumulative score — folded deterministically from the [`event-timeline`](../event-timeline/README.md) score events (showing leads, runs, and ties). When the [`timekeeper-console`](../timekeeper-console/README.md) captured it, the recap MUST also show a **team ball-possession-share chart**. Any player-identifying chart label MUST honour minor publish-consent.

### Sharing (the point)

#### REQ: shareable-card

The recap MUST be a **share-optimised page**: it MUST emit a rich **social / Open-Graph preview card** (teams, final score, a headline — e.g. MVP or top scorer) that renders attractively when pasted into Facebook and messengers (WhatsApp, Telegram), and MUST offer a copy-able URL and QR. (Link/QR *generation* is the distribution concern; this Feature owns the card content and preview metadata.)

#### REQ: recap-drives-follow

The recap MUST present a **no-login follow CTA** so a recipient who arrives via a shared recap can become a follower of the team/player in one tap — converting viral reach into graph edges ([`gameboard-live`](../README.md) follow; account-claim deferred to [`first-use-backprop`](../../first-use-backprop/README.md)).

#### REQ: highlight-best-predictor

The recap MUST **highlight this game's best predictor** — the predictor whose locked prediction was closest to the final result (correct outcome and/or smallest score error, per [`predictions`](../../engagement/predictions/README.md) grading) — and **link to the predictors leaderboard**. The highlight is the **single-game** best call (read from this game's grading), not the cumulative leaderboard rating. This publicly rewards the prediction loop and pulls recap viewers into [`predictions`](../../engagement/predictions/README.md). A minor predictor is shown subject to the same display/anonymisation rules predictions applies to its leaderboards.

### Integrity & safety

#### REQ: view-not-vote

Arriving at a finished game **via the recap** MUST let a viewer see all results but MUST NOT offer an MVP vote action to ineligible arrivals: per [`mvp-voting`](../../engagement/mvp-voting/README.md) `voter-eligibility`, only those who engaged before the final whistle may vote. The recap presents MVP/Opponents' Choice as **results to view**, not a ballot, for post-final arrivals.

#### REQ: minor-safe-recap

All minor-player data on the recap (box score, MVP, badges) MUST honour publish-consent ([`sneat-team`](../../sneat-team/README.md) / [`roles`](../../sneat-team/roles/README.md)); the share card MUST NOT expose a minor's consent-restricted fields.

## Architecture

This Feature **composes** finished-game outputs into a shareable page; it owns the recap surface and its share-card metadata, not the underlying records.

- **Composition:** reads the final [`event-timeline`](../event-timeline/README.md) record (score/periods), the [`players-list`](../players-list/README.md) box score (public mode), [`mvp-voting`](../../engagement/mvp-voting/README.md) results, [`badges`](../../engagement/badges/README.md) earned, and the best predictor from [`predictions`](../../engagement/predictions/README.md) grading.
- **Share card:** server-rendered Open-Graph/Twitter-card metadata + image so messenger/social unfurls look good; the link/QR generation itself is the distribution concern.
- **Follow + identity:** no-login follow via [`gameboard-live`](../README.md); account-claim via [`first-use-backprop`](../../first-use-backprop/README.md).
- **Consent:** minor display reads `sneat-team`/`roles` publish-consent.
- **Availability:** generated once a game is `final`; behaviour if the official record is later corrected is a plan-time decision (see Open Questions).

## Interaction with Other Features

- **[`event-timeline`](../event-timeline/README.md)** / **[`scoreboard`](../scoreboard/README.md)** — final score + per-period detail.
- **[`players-list`](../players-list/README.md)** — the box score (public mode); private books stay with [`play-stats`](../../play-stats/README.md).
- **[`mvp-voting`](../../engagement/mvp-voting/README.md)** — MVP + Opponents' Choice results, and the `voter-eligibility` rule the recap honours.
- **[`predictions`](../../engagement/predictions/README.md)** — best-predictor highlight + leaderboard link.
- **[`badges`](../../engagement/badges/README.md)** — badges earned in the game.
- **[`gameboard-live`](../README.md)** — the follow CTA target.
- **[`first-use-backprop`](../../first-use-backprop/README.md)** — account-claim for a recap arrival who follows.
- **[`spectator-screen`](../spectator-screen/README.md)** — links here at the final phase.
- **[`sneat-team`](../../sneat-team/README.md)** / **[`roles`](../../sneat-team/roles/README.md)** — minor publish-consent.
- **[`screens`](../screens/README.md)** — the UI map this surface is inventoried in.

## Acceptance Criteria

### AC: recap-shows-summary (verifies REQ:recap-composition)

**Given** a finished game,
**When** the recap is opened with no account,
**Then** it shows the final score with per-period detail, the box score, the Team MVP and Opponents' Choice, and the badges earned.

### AC: recap-shows-score-progression (verifies REQ:recap-charts)

**Given** a finished game's score events,
**When** the recap is shown,
**Then** a two-line score-over-time chart (one line per team, x = game time, y = score) is rendered; and a team possession-share chart appears when possession-time was captured.

### AC: share-card-unfurls (verifies REQ:shareable-card)

**Given** a recap URL,
**When** it is pasted into Facebook or a messenger,
**Then** a rich preview card (teams, final score, a headline) unfurls, and a copy-able URL and QR are available.

### AC: recap-follow-no-login (verifies REQ:recap-drives-follow)

**Given** a person who opened a shared recap with no account,
**When** they tap follow,
**Then** a follow is recorded against an accountless follow identity with no signup.

### AC: best-predictor-highlighted (verifies REQ:highlight-best-predictor)

**Given** a finished game with graded predictions,
**When** the recap is shown,
**Then** the predictor who best called this game is highlighted with a link to the predictors leaderboard.

### AC: recap-arrival-views-cannot-vote (verifies REQ:view-not-vote)

**Given** a newcomer who opens a finished game only via its recap,
**When** they view the MVP section,
**Then** results are visible but no MVP vote action is offered to them (ineligible per voter-eligibility).

### AC: recap-minor-consent (verifies REQ:minor-safe-recap)

**Given** a minor without publish-consent appearing in the box score,
**When** the recap and its share card render,
**Then** the minor's consent-restricted fields are not shown or exposed in the card.

## Not Doing / Out of Scope

- **The live scoreboard / live viewing** — owned by [`spectator-screen`](../spectator-screen/README.md) and [`scoreboard`](../scoreboard/README.md); the recap is the post-final surface.
- **The MVP vote mechanic** — owned by [`mvp-voting`](../../engagement/mvp-voting/README.md); the recap only displays results.
- **The share-link / QR generation mechanism** — the distribution concern; the recap owns card content + preview metadata only.
- **Highlight video / clips** — not in scope.

## Assumption Carryover

From the `sneat-sports` Idea:

- **Must-be-true — following distributes the product.** The recap is the explicit virality surface: a share that unfurls richly and converts recipients into followers. Addressed by `shareable-card` + `recap-drives-follow`.
- **Should-be-true — engagement deepens the graph residue.** Revealing MVP, badges, and the best predictor at the peak emotional moment maximises share intent; validated before committing, hence Draft.

## Rehearse Integration

Rehearse stubs are deferred. The ACs are testable in principle (composition, OG-card unfurl, no-login follow, best-predictor highlight, view-not-vote, consent), but the implementation repo and the `sports` module do not exist yet and this is Draft. Stubs will be scaffolded during planning/implementation if promoted. No `_tests/` stubs are created at specify time.

## Open Questions

- **Card headline** — which fact leads the share card (final score vs MVP vs top scorer vs "your kid scored N").
- **Correction after final** — if the official record is amended post-final, whether the recap and its cached share card regenerate.
- **Inline vs deep-link** — how much box score / predictions detail is inline vs linked to the owning surfaces.
- **Best-predictor scope** — closest single-game call vs the top-rated predictor for the team; and minor-predictor display.

---
*This document follows the https://specscore.md/feature-specification*
