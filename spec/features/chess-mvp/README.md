---
format: https://specscore.md/feature-specification
status: Implementing
---

# Feature: Chess MVP — board, clock, OTB record

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/chess-mvp?op=explore) | [Edit](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/chess-mvp?op=edit) | [Ask question](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/chess-mvp?op=ask) | [Request change](https://specscore.studio/app/github.com/sneat-co/gameboard/spec/features/chess-mvp?op=request-change) |
**Status:** Implementing
**Source Ideas:** —

## Summary

Playable chessground+chess.js board (pass-and-play + vs-Stockfish), a first-class chess clock, and OTB (over-the-board) clock+record mode that saves a PGN-with-clock game record. This is chess.gameboard.live's playable MVP — see `backstage/docs/roadmaps/gameboard-chess.md` for the full product rationale (the OTB clock+scoresheet is the standout, on-brand feature: the app as digital chess clock + auto-scoresheet).

## Problem

GameBoard.live's chess vertical today is an idea document only — there is no playable chess anywhere in the app. Chess players (club, family, kids/parents) have no reason to open GameBoard.live. The single highest-leverage MVP slice is: a genuinely playable board (not a mockup), a real chess clock (the thing that makes this useful even with zero online infrastructure), and the OTB record mode that turns a phone/tablet into a digital clock + auto-scoresheet for a game played on a physical board — the feature the roadmap identifies as the go-to reason to use the app at all. Online real-time play against a remote contact, spectating, and ratings are explicitly Phase 2 (they need Firestore listeners / invitus / ranking math not yet built) — this Feature is scoped to what's playable with zero new backend infrastructure: chess is a Firestore/localStorage document, not a Durable Object, for MVP.

## Behavior

### Playable board

#### REQ: legal-play

The board enforces legal chess: only legal moves are draggable/droppable, turn order is enforced, and check/checkmate/stalemate/draw are detected automatically as the game is played.

#### REQ: pass-and-play

Two people can play a full game on one device, taking turns at the same board (no second device or account required).

### Vs computer

#### REQ: vs-computer-levels

A user can play against a computer opponent (Stockfish) at one of at least 3 selectable strength levels; the engine replies automatically after the human's move.

### Chess clock

#### REQ: time-control-presets

Starting a game offers common time-control presets (e.g. 3+2 blitz, 5+0 blitz, 10+5 rapid, 15+10 rapid) plus a custom base-time+increment option, and an untimed option.

#### REQ: increment-and-flag

The clock applies the configured increment to the side that just moved and hands the clock to the other side; a side whose clock reaches zero immediately loses the game on time ("flags").

### OTB (over-the-board) record mode

#### REQ: otb-clock-and-scoresheet

A mode exists where the app's clock runs for a game being played on a physical board, and each move played is entered on the app's board, producing a move-by-move game record as the game is played — the app functions as a digital clock + scoresheet without requiring an opponent to be online.

#### REQ: pgn-with-clock-export

Every game (however it was played — pass-and-play, vs-computer, or OTB) can be exported as PGN, and the PGN includes a `%clk` annotation recording the clock time remaining after each move.

### Game end + result

#### REQ: result-and-rematch

When a game ends (checkmate, stalemate, draw, resignation, or flag-fall), the result is displayed, and the user is offered "Rematch" (same settings, new game) and "New game" (back to game setup) affordances.

### Save + browse games

#### REQ: persisted-game-record

A game in progress and at completion is saved as a game record (players, full move list with per-move clock times, final position, PGN, time control, status, result) that survives a page reload.

#### REQ: games-list

A list of previously saved games is browsable, showing each game's players, mode, status/result, and its PGN.

## Acceptance Criteria

### AC: illegal-moves-rejected

Validates `legal-play`.

Scenario: An illegal move is rejected
Given a game in progress
When a player attempts to move a piece to a square that isn't a legal destination for it
Then the move is rejected and the board/game state is unchanged.

### AC: checkmate-ends-game

Validates `legal-play`.

Scenario: Checkmate ends the game with the correct result
Given a game reaches a checkmated position
When the mating move is played
Then the game is marked over and the winner is the side that delivered checkmate.

### AC: two-players-one-device

Validates `pass-and-play`.

Scenario: Two people alternate turns on one device
Given a new pass-and-play game
When White moves and then Black moves
Then each move is only accepted for the side to move, and the board reflects both moves in order.

### AC: computer-replies-after-human-move

Validates `vs-computer-levels`.

Scenario: The engine responds automatically
Given a vs-computer game where the human plays White
When White makes a legal move
Then Black (Stockfish) automatically makes a legal reply without further user action.

### AC: three-plus-strength-levels-offered

Validates `vs-computer-levels`.

Scenario: Multiple difficulty levels are selectable
Given the new-game setup for a vs-computer game
When the user views the strength options
Then at least 3 distinct levels are offered, and the selected level is used for the engine's search.

### AC: preset-time-controls-available

Validates `time-control-presets`.

Scenario: Common presets are offered at game setup
Given the chess new-game screen
When the user opens the time-control choices
Then blitz (e.g. 3+2), rapid (e.g. 10+5), an untimed option, and a custom base+increment option are all available.

### AC: increment-applied-on-move

Validates `increment-and-flag`.

Scenario: Increment is credited to the mover
Given a game with a non-zero increment
When a player completes a move
Then their remaining clock time increases by the configured increment before the clock hands over to the opponent.

### AC: flag-fall-ends-game

Validates `increment-and-flag`.

Scenario: Running out of time loses the game
Given a timed game where a side's clock reaches zero
When the flag falls
Then the game ends immediately and the other side is recorded as the winner.

### AC: otb-produces-move-by-move-record

Validates `otb-clock-and-scoresheet`.

Scenario: OTB mode builds the scoresheet as the game is played
Given an OTB record-mode game with the clock running
When each move made on the physical board is entered on the app's board
Then the move is added to the game's move list with the clock time at that point, without requiring an online opponent.

### AC: pgn-export-includes-clk

Validates `pgn-with-clock-export`.

Scenario: Exported PGN has clock annotations
Given a game with at least one move played under a time control
When the game's PGN is generated
Then each move in the PGN body is followed by a `{[%clk H:MM:SS]}` annotation reflecting the clock at that point.

### AC: result-shown-with-rematch-and-new-game

Validates `result-and-rematch`.

Scenario: Game end offers next actions
Given a game that has just ended (by any end condition)
When the result is displayed
Then "Rematch" and "New game" actions are both offered.

### AC: game-survives-reload

Validates `persisted-game-record`.

Scenario: A saved game can be found again
Given a game that has had at least one move played
When the browser is reloaded
Then the game's moves, final position, and PGN are still retrievable by its id.

### AC: saved-games-listed-with-pgn

Validates `games-list`.

Scenario: The games list shows past games
Given one or more games have been played
When the user opens the games list
Then each game is listed with its players and result/status, and its PGN can be viewed from there.

## Out of Scope

- Online real-time play against a remote contact (Firestore listeners synchronising two separate clients) — needs the multi-client sync layer; Phase 2.
- Spectating a live game via a share link — depends on the above.
- Challenge/invite loop via invitus — depends on contactus/invitus wiring not built for chess yet.
- Ratings/Elo, ladders, and tournaments.
- The kids/parents family graph tie-in described in the roadmap.
- Under-promotion (promoting to a piece other than a queen) in the on-screen board UI — moves auto-queen; a documented rough edge.
- Resuming a live, still-ticking clock after a page reload mid-game — a reloaded in-progress game opens as a read-only recap of its position so far (the clock does not keep counting down while the tab is closed); finishing the game before closing the tab is the supported flow for this MVP.
- A Firestore-backed game record — the MVP persists locally (localStorage) behind an interface a Firestore implementation can drop into without changing any caller; see `chess-game-store.ts`.

## Assumption Carryover

None — this Feature has no source Idea.

## Open Questions

- Should OTB mode support a per-move "no clock" pure-scoresheet variant (no time control) for casual games? Not needed for MVP (untimed games already skip the clock entirely).
- When online real-time play (Phase 2) lands, does the local game-record interface get a Firestore-backed implementation dropped straight in, or does the schema need to change to support concurrent-writer conflict resolution?

---
*This document follows the https://specscore.md/feature-specification*
