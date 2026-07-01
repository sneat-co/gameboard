import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteChessGame,
  getChessGame,
  listChessGames,
  saveChessGame,
  type ChessGameDoc,
} from './chess-game-store';

function makeDoc(overrides: Partial<ChessGameDoc> = {}): ChessGameDoc {
  return {
    gameId: 'g1',
    mode: 'pass-and-play',
    players: { white: 'Alex', black: 'Sam' },
    timeControl: null,
    timeControlLabel: 'Untimed',
    moves: [],
    fen: 'startpos',
    pgn: '',
    status: 'in-progress',
    result: '*',
    endReason: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('chess-game-store (localStorage-backed, Firestore-swappable)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips a saved game by id', () => {
    saveChessGame(makeDoc());
    expect(getChessGame('g1')).toEqual(makeDoc());
  });

  it('returns null for an unknown id', () => {
    expect(getChessGame('missing')).toBeNull();
  });

  it('overwrites on save with the same gameId (used on every move + at game end)', () => {
    saveChessGame(makeDoc({ status: 'in-progress', updatedAt: 1 }));
    saveChessGame(makeDoc({ status: 'complete', result: '1-0', updatedAt: 2 }));
    const saved = getChessGame('g1');
    expect(saved?.status).toBe('complete');
    expect(saved?.result).toBe('1-0');
  });

  it('lists all saved games newest-first', () => {
    saveChessGame(makeDoc({ gameId: 'g1', updatedAt: 1 }));
    saveChessGame(makeDoc({ gameId: 'g2', updatedAt: 3 }));
    saveChessGame(makeDoc({ gameId: 'g3', updatedAt: 2 }));
    expect(listChessGames().map((g) => g.gameId)).toEqual(['g2', 'g3', 'g1']);
  });

  it('deletes a game', () => {
    saveChessGame(makeDoc());
    deleteChessGame('g1');
    expect(getChessGame('g1')).toBeNull();
    expect(listChessGames()).toEqual([]);
  });

  it('tolerates corrupted storage content by treating it as empty', () => {
    localStorage.setItem('gameboard.chess.games', '{not json');
    expect(listChessGames()).toEqual([]);
    expect(getChessGame('g1')).toBeNull();
  });
});
