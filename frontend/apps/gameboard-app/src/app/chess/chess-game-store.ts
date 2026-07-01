// Persistence for chess games (MVP scope item 6 — "Save the game").
//
// Fable: swap to Firestore /spaces/{spaceID}/ext/gameboard/chessGames/{gameId}
// — this module's public surface (`ChessGameStore`, `saveChessGame`,
// `listChessGames`, `getChessGame`, `deleteChessGame`) is written as the exact
// interface a Firestore-backed implementation would expose (see
// GameService.watchMyGames in ../game.service.ts for the established
// AngularFire pattern this repo already uses: `collection()` +
// `collectionData()` + client-side sort, guarded by `createdBy == uid`).
// Swapping the implementation behind these functions for a Firestore one,
// once a per-game spaceID/auth context is threaded through, is the only
// change required — no caller (chess-play-page, chess-games-list-page) needs
// to change.
//
// Kept as plain localStorage-backed functions (not a class/service) to match
// this app's existing draft-persistence convention (see
// ../new-game/new-game-draft.ts).

import type { ChessColor, ChessTimeControl } from './chess-clock';
import type { ChessEndReason, ChessResult } from './chess-match';
import type { ChessMoveRecord } from './pgn';

export type ChessGameMode = 'pass-and-play' | 'vs-computer' | 'otb';
export type ChessGameStatus = 'in-progress' | 'complete';

/** The Firestore-document-shaped chess game record. Field names deliberately
 * mirror the roadmap's target Firestore doc
 * (`/spaces/{spaceID}/ext/gameboard/chessGames/{gameId}`) so the swap is a
 * pure storage-layer change. */
export interface ChessGameDoc {
  readonly gameId: string;
  readonly mode: ChessGameMode;
  readonly players: { readonly white: string; readonly black: string };
  readonly timeControl: ChessTimeControl | null;
  readonly timeControlLabel: string;
  readonly moves: readonly ChessMoveRecord[];
  readonly fen: string;
  readonly pgn: string;
  readonly status: ChessGameStatus;
  readonly result: ChessResult;
  readonly endReason: ChessEndReason;
  readonly flaggedOrResignedSide?: ChessColor | null;
  /** Present only for `mode: 'vs-computer'` — persisted (not just passed via
   * router state) so the vs-computer config survives a page reload. */
  readonly vsComputer?: {
    readonly levelId: 'easy' | 'medium' | 'hard';
    readonly humanColor: ChessColor;
  };
  readonly createdAt: number;
  readonly updatedAt: number;
}

const STORAGE_KEY = 'gameboard.chess.games';

/** A fresh id for a new chess game (32-char dashless hex, matching
 * game-state.ts's newEventID convention). */
export function newChessGameId(): string {
  const buf = new Uint8Array(16);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // localStorage can throw (privacy mode / disabled cookies).
    return null;
  }
}

function readAll(): Record<string, ChessGameDoc> {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, ChessGameDoc>)
      : {};
  } catch {
    return {};
  }
}

function writeAll(games: Record<string, ChessGameDoc>): void {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(games));
}

/** Create/overwrite a game record (called on every move + at game end, so an
 * in-progress OTB game survives a page reload). */
export function saveChessGame(doc: ChessGameDoc): void {
  const all = readAll();
  all[doc.gameId] = doc;
  writeAll(all);
}

/** All saved games, newest-first — backs the games-list page. */
export function listChessGames(): ChessGameDoc[] {
  return Object.values(readAll()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getChessGame(gameId: string): ChessGameDoc | null {
  return readAll()[gameId] ?? null;
}

export function deleteChessGame(gameId: string): void {
  const all = readAll();
  delete all[gameId];
  writeAll(all);
}

/** Minimal explicit interface (documented above) that a future Firestore
 * implementation would satisfy — not used internally (the functions above ARE
 * the implementation), kept so the seam is visible in one place. */
export interface ChessGameStore {
  save(doc: ChessGameDoc): void | Promise<void>;
  list(): ChessGameDoc[] | Promise<ChessGameDoc[]>;
  get(gameId: string): ChessGameDoc | null | Promise<ChessGameDoc | null>;
  remove(gameId: string): void | Promise<void>;
}
