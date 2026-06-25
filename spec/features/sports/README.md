---
format: https://specscore.md/feature-specification
status: Approved
---

# Feature: Sports

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports?op=explore) | [Edit](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports?op=edit) | [Ask question](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports?op=ask) | [Request change](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/sports?op=request-change) |
**Status:** Approved
**Source Ideas:** sneat-sports

## Summary

Umbrella for the **Sneat Sports** vertical in this repo. Only the **GameBoard.live**
channel (the viral live-scoring / public-scoreboard surface) lives here, next to its
implementation. The sibling sports features — **sneat-team**, **first-use-backprop**,
**play-stats**, **engagement/\***, **account-gate** — remain in `sneat-co/backstage`
under `spec/features/sports/` and are referenced by name. Concept/vision:
[`spec/ideas/sneat-sports.md`](../../ideas/sneat-sports.md).

## Contents

| Child | Description |
|---|---|
| [gameboard-live](gameboard-live/README.md) | The viral channel: a volunteer scorer runs a live game and publishes a no-login public scoreboard; spectators follow teams and players. A game is an Eventus occasion; following is the multiplayer atom that grows the relationship graph and distributes the product. |

## Problem

GameBoard.live's specs were moved into this implementation repo so they live next to
the code (backend + app). This umbrella is the in-repo home for the channel and its
children; the broader sports platform (management layer, engagement loops, identity
gate) stays specced in backstage.

## Behavior

This is an in-repo umbrella/index. Behavior and acceptance criteria live on the child
feature [`gameboard-live`](gameboard-live/README.md) and its descendants.

## Acceptance Criteria

Not defined here (umbrella feature — acceptance criteria live on the child features).

## Open Questions

- Reconciliation of cross-repo references between this repo's GameBoard.live specs and
  the sibling sports features that remain in `sneat-co/backstage`.

---
*This document follows the https://specscore.md/feature-specification*
