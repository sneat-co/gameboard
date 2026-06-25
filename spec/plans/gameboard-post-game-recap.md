---
format: https://specscore.md/plan-specification
status: Approved
---
# Plan: Gameboard Post Game Recap

**Status:** Approved
**Source Feature:** sports/gameboard-live/post-game-recap
**Date:** 2026-06-24
**Owner:** alex
**Supersedes:** —
**Parent:** gameboard-live

> **Status (gameboard repo, 2026-06-26):** Backend (box-score fold) is **live in prod** (via sneat-go). This **frontend surface was part of the deleted 1st-gen app and was not ported** to the current Nx + Ionic app — it is **to be rebuilt** on the current scaffolding (Slice 3). See the master plan's [Frontend Reality & Rebuild](./gameboard-live.md) section; verified by a **real-stack full-cycle E2E** (UI → API → `gameboardd` → Firestore emulator → fold) that extends the full-game lifecycle chain (see the master plan's Testing strategy); reference spec: [`docs/legacy-mvp-frontend/e2e/recap.spec.ts`](../../docs/legacy-mvp-frontend/e2e/recap.spec.ts).

## Summary

Implements the [`post-game-recap`](../features/sports/gameboard-live/post-game-recap/README.md) Feature as **contract-first vertical slices**. The recap is largely a **READ projection** of a `final` game's event timeline plus a generated **Open-Graph share card**: the canonical store is the root/global `gameboard` extension, with the game at `/ext/gameboard/games/{gameID}` and its append-only event log at `/ext/gameboard/games/{gameID}/events/{eventID}` (teams are sneat spaces referenced by id). Each task freezes one **CONTRACT** — TypeSpec (`api4gameboard.tsp`) + the `gameboard-ext/backend` Go ext types + the `@sneat/extension-gameboard-contract` TS package — then fans out to a **backend subtask** (`gameboard/backend`, dalgo→Firestore read-fold over the root `/ext/gameboard/...` log, plus OG-card image generation) and a **frontend subtask** (`@sneat/extension-gameboard-internal`) that render against the generated types. All 7 Feature ACs are covered; none deferred.

## Approach

Each task is a thin slice that ships its ACs end-to-end. Within a task the order is strictly **contract-first**: (1) the **Contract** freezes the slice's recap projection / share-card / follow shape in `api4gameboard.tsp` + the frozen ext types, which is the integration boundary; then (2) the **backend subtask** and (3) the **frontend subtask** proceed in parallel against the generated types. A task is "done" only when both land and its ACs verify end-to-end. The recap reads — it never mutates the game; all computed views are deterministic folds of the final `/ext/gameboard/games/{gameID}/events/{eventID}` log.

Slices are dependency-ordered. **Slice 1 (Task 1)** establishes the public recap projection — the read endpoint that folds the final timeline into score/per-period/box-score/MVP/badges and the consent filter every later slice reuses, so it lands first. **Slice 2 (Tasks 2–3)** layers the derived visualisations and the celebratory best-predictor highlight onto that projection. **Slice 3 (Tasks 4–5)** owns the distribution + identity surface: the OG/Twitter share card with URL/QR and minor-safe metadata, and the no-login follow CTA with view-not-vote gating.

Cross-plan dependencies consumed (not built here): the **final event-timeline record** (`event-timeline` plan — the frozen final log this recap folds); the **players-list / box score** plan (public-mode per-player points→assists→minutes ordering); **mvp-voting**'s `voter-eligibility` rule (for view-not-vote); **predictions** single-game grading (best-predictor source); **badges** (earned-this-game source); the **account-gate / first-use-backprop** plan (accountless follow identity for the CTA); and the **invitus `link` channel** (share-link/QR distribution mechanism the card content plugs into). The Feature's `card-headline` Open Question is resolved in Task 4 (headline = final score with MVP as secondary line); the `correction-after-final` regeneration question is resolved in Task 1 (the projection is recomputed on read, so a corrected final record reflects on next fetch and triggers card-cache invalidation).

## Tasks

### Task 1: Project the finished-game recap summary

**Verifies:** sports/gameboard-live/post-game-recap#ac:recap-shows-summary, sports/gameboard-live/post-game-recap#ac:recap-minor-consent
**Depends-On:** —
**Status:** pending

Expose a public, no-account read that folds a `final` game's event log into the recap summary — final score with per-period breakdown, the public-mode box score, MVP + Opponents' Choice results, and badges earned — with the minor publish-consent filter applied to every player-identifying field.
- **Contract (TypeSpec + ext types, first):** `RecapSummary` model (final score, per-period array, `BoxScoreRow[]` in points→assists→minutes order, MVP + Opponents'-Choice result, earned-badges list) and a public `getRecap(gameID)` operation in `api4gameboard.tsp`; freeze the matching `gameboard-ext/backend` Go types + `@sneat/extension-gameboard-contract` TS, including the per-field consent-restriction flag.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore read-fold): read `/ext/gameboard/games/{gameID}` (must be `final`) and fold `/ext/gameboard/games/{gameID}/events/{eventID}` into the summary; resolve team spaces by id; apply `sneat-team`/`roles` publish-consent so a non-consented minor's restricted fields are omitted; recompute on each read so a corrected final record is reflected.
- **Frontend subtask** (`@sneat/extension-gameboard-internal`): the public recap page section rendering score, per-period detail, box score, MVP/Opponents' Choice, and badges, openable with no account and honouring the consent flags.

### Task 2: Render the recap timeline charts

**Verifies:** sports/gameboard-live/post-game-recap#ac:recap-shows-score-progression
**Depends-On:** 1
**Status:** pending

Derive and render the score-progression chart (one line per team, x = game time, y = cumulative score) folded deterministically from the timeline's score events, plus the team ball-possession-share chart when possession-time was captured.
- **Contract (TypeSpec + ext types, first):** extend `RecapSummary` (or a `getRecapCharts` projection) with a `ScoreProgressionSeries` (per-team time/score points) and an optional `PossessionShare` block, present only when possession data exists; freeze Go + TS types.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore read-fold): fold score events into per-team cumulative time series; emit possession-share only when the timeline captured possession-time; honour minor consent on any player-identifying chart label.
- **Frontend subtask** (`@sneat/extension-gameboard-internal`): a two-line score-over-time chart component and a conditionally-shown possession-share chart bound to the projection.

### Task 3: Highlight this game's best predictor

**Verifies:** sports/gameboard-live/post-game-recap#ac:best-predictor-highlighted
**Depends-On:** 1
**Status:** pending

Surface the predictor whose locked prediction best called *this* game (single-game grading — closest outcome/score error), with a link to the predictors leaderboard, applying the predictions display/anonymisation rules to a minor predictor.
- **Contract (TypeSpec + ext types, first):** a `BestPredictor` block on the recap projection (display name subject to anonymisation, the single-game call detail, leaderboard deep-link); freeze Go + TS types.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore read-fold): read this game's `predictions` grading, select the closest single-game call (not the cumulative rating), and apply the predictions minor-anonymisation rules before projecting.
- **Frontend subtask** (`@sneat/extension-gameboard-internal`): the best-predictor highlight element with its leaderboard link.

### Task 4: Emit the Open-Graph share card

**Verifies:** sports/gameboard-live/post-game-recap#ac:share-card-unfurls, sports/gameboard-live/post-game-recap#ac:recap-minor-consent
**Depends-On:** 1
**Status:** pending

Make the recap a share-optimised page: emit rich server-rendered Open-Graph/Twitter-card metadata + image (teams, final score, headline) that unfurls in Facebook/WhatsApp/Telegram, and offer a copy-able URL and QR — with no minor's consent-restricted field exposed in the card. Headline = final score, MVP as secondary line (resolves the `card-headline` Open Question).
- **Contract (TypeSpec + ext types, first):** an `OgCardMeta` model (og/twitter tags, card image URL, share URL, QR payload) and the route that serves the metadata; freeze Go + TS types; specify the consent filter on every card field.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore read-fold + OG card): render the OG card image and metadata from the consent-filtered Task 1 projection; plug the share URL into the `invitus` `link` channel for distribution; invalidate the cached card when the final record is corrected.
- **Frontend subtask** (`@sneat/extension-gameboard-internal`): inject the server-rendered OG/Twitter `<meta>` tags into the recap page head and render the copy-URL + QR affordances.

### Task 5: Convert recap arrivals — follow CTA, view-not-vote

**Verifies:** sports/gameboard-live/post-game-recap#ac:recap-follow-no-login, sports/gameboard-live/post-game-recap#ac:recap-arrival-views-cannot-vote
**Depends-On:** 1
**Status:** pending

Present a no-login follow CTA that records a follow against an accountless follow identity in one tap, and present MVP/Opponents' Choice as results-to-view (no ballot) for post-final recap arrivals who are ineligible per `mvp-voting` voter-eligibility. The accountless follow is **not** an exception to the umbrella's `follow-requires-account` rule — it is the [`first-use-backprop`](../features/sports/first-use-backprop/README.md) **deferred-identity** path: the follow is recorded against a provisional identity that is claimed/upgraded to a real account on first use.
- **Contract (TypeSpec + ext types, first):** a `followFromRecap(gameID, target)` operation keyed to an accountless follow identity (account-claim deferred to `first-use-backprop`), and a `canVote` eligibility flag on the recap projection; freeze Go + TS types.
- **Backend subtask** (`gameboard/backend`, dalgo→Firestore read-fold): record the accountless follow edge with no signup; compute `canVote=false` for a recap-only arrival per `mvp-voting` voter-eligibility (only pre-final-whistle engagers may vote).
- **Frontend subtask** (`@sneat/extension-gameboard-internal`): the one-tap follow CTA, and an MVP section that shows results without offering a vote action when `canVote` is false.

## Open Questions

None at this time.

---
*This document follows the https://specscore.md/plan-specification*
