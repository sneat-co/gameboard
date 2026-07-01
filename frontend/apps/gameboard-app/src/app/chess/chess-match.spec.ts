import { describe, expect, it } from 'vitest';
import { ChessMatch } from './chess-match';

function newMatch(
  overrides: Partial<ConstructorParameters<typeof ChessMatch>[0]> = {},
) {
  return new ChessMatch({
    timeControl: null,
    whiteLabel: 'Alex',
    blackLabel: 'Sam',
    ...overrides,
  });
}

describe('ChessMatch — move/result handling (chess.js wrapper)', () => {
  it('plays legal moves, advances the turn, and records SAN', () => {
    const match = newMatch();
    expect(match.turn).toBe('w');
    expect(match.move('e2', 'e4').ok).toBe(true);
    expect(match.turn).toBe('b');
    expect(match.move('e7', 'e5').ok).toBe(true);
    expect(match.turn).toBe('w');
    expect(match.history.map((m) => m.san)).toEqual(['e4', 'e5']);
    expect(match.isOver()).toBe(false);
  });

  it('rejects illegal moves without throwing and without changing state', () => {
    const match = newMatch();
    const fenBefore = match.fen();
    const attempt = match.move('e2', 'e5'); // not a legal pawn move
    expect(attempt.ok).toBe(false);
    expect(match.fen()).toBe(fenBefore);
    expect(match.history.length).toBe(0);
  });

  it("detects checkmate (Fool's mate) and assigns the correct result", () => {
    const match = newMatch();
    expect(match.move('f2', 'f3').ok).toBe(true);
    expect(match.move('e7', 'e5').ok).toBe(true);
    expect(match.move('g2', 'g4').ok).toBe(true);
    expect(match.move('d8', 'h4').ok).toBe(true); // Qh4# — white is mated
    expect(match.isOver()).toBe(true);
    expect(match.endReasonValue()).toBe('checkmate');
    expect(match.result()).toBe('0-1'); // black (the mover) wins
    expect(match.resultSummary()).toBe('Sam wins by checkmate');
  });

  it('further moves are rejected once the game is over', () => {
    const match = newMatch();
    match.move('f2', 'f3');
    match.move('e7', 'e5');
    match.move('g2', 'g4');
    match.move('d8', 'h4');
    expect(match.isOver()).toBe(true);
    const attempt = match.move('e2', 'e4');
    expect(attempt.ok).toBe(false);
  });

  it('detects stalemate as a draw', () => {
    // A well-known minimal stalemate position: black king on h8 has no moves
    // and is not in check, white to move delivers the stalemating move.
    const match = newMatch({ fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1' });
    // It's black to move and black is already stalemated in this FEN.
    expect(match.chess.isStalemate()).toBe(true);
    expect(match.isOver()).toBe(true);
    expect(match.endReasonValue()).toBe('stalemate');
    expect(match.result()).toBe('1/2-1/2');
    expect(match.resultSummary()).toBe('Draw by stalemate');
  });

  it('resignation ends the game and credits the other side', () => {
    const match = newMatch();
    match.move('e2', 'e4');
    match.resign('b');
    expect(match.isOver()).toBe(true);
    expect(match.endReasonValue()).toBe('resignation');
    expect(match.result()).toBe('1-0');
    expect(match.resultSummary()).toBe('Alex wins by resignation');
    // Further moves/resignations are no-ops once resigned.
    expect(match.move('a7', 'a6').ok).toBe(false);
  });

  it('flags on time and the flagged side loses', () => {
    const match = newMatch({ timeControl: { baseMs: 2_000, incrementMs: 0 } });
    match.start();
    match.tick(2_500); // white's clock runs out
    expect(match.isOver()).toBe(true);
    expect(match.endReasonValue()).toBe('flag');
    expect(match.result()).toBe('0-1');
    expect(match.resultSummary()).toBe('Sam wins on time');
  });

  it('legalMovesBySquare exposes chessground-shaped legal destinations', () => {
    const match = newMatch();
    const dests = match.legalMovesBySquare();
    expect(dests.get('e2')).toEqual(expect.arrayContaining(['e3', 'e4']));
    expect(dests.get('g1')).toEqual(expect.arrayContaining(['f3', 'h3']));
  });
});

describe('ChessMatch — PGN export with clock annotations', () => {
  it('produces a PGN with %clk after every half-move and the correct result tag', () => {
    const match = newMatch({
      timeControl: { baseMs: 60_000, incrementMs: 2_000 },
    });
    match.start();
    match.tick(1_000);
    match.move('e2', 'e4');
    match.tick(1_000);
    match.move('e7', 'e5');

    const pgn = match.toPgn({ date: '2026.07.01' });
    expect(pgn).toContain('[White "Alex"]');
    expect(pgn).toContain('[Black "Sam"]');
    expect(pgn).toContain('[TimeControl "60+2"]');
    expect(pgn).toContain('[Date "2026.07.01"]');
    // white: 60s - 1s + 2s increment = 61s = 0:01:01
    expect(pgn).toContain('1. e4 {[%clk 0:01:01]}');
    // black restates the move number after the comment interrupts the line
    expect(pgn).toContain('1... e5 {[%clk 0:01:01]}');
    expect(pgn.trim().endsWith('*')).toBe(true); // game still in progress
  });

  it('omits %clk entirely for an untimed game (no misleading 0:00:00)', () => {
    const match = newMatch(); // timeControl: null
    match.move('e2', 'e4');
    match.move('e7', 'e5');
    const pgn = match.toPgn();
    expect(pgn).not.toContain('%clk');
    expect(pgn).toContain('1. e4 1... e5');
  });

  it('includes the final result tag once the game has ended', () => {
    const match = newMatch();
    match.move('f2', 'f3');
    match.move('e7', 'e5');
    match.move('g2', 'g4');
    match.move('d8', 'h4');
    const pgn = match.toPgn();
    expect(pgn).toContain('[Result "0-1"]');
    expect(pgn.trim().endsWith('0-1')).toBe(true);
  });
});
