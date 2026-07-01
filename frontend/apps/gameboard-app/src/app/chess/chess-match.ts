// ChessMatch — combines chess.js (legal moves, SAN, FEN, check/mate/stalemate/
// draw detection) with the ChessClockEngine and produces the OTB game record
// (move list with per-move clock times, exportable as PGN). This is the single
// class every play surface (pass-and-play, vs-computer, OTB record mode) drives
// through, so "how a move/result is handled" only has to be right once.

import { Chess, type Move } from 'chess.js';
import {
  ChessClockEngine,
  type ChessColor,
  type ChessTimeControl,
} from './chess-clock';
import {
  buildPgnWithClocks,
  timeControlToPgnField,
  todayAsPgnDate,
  type ChessMoveRecord,
  type PgnHeaders,
} from './pgn';

export type ChessResult = '1-0' | '0-1' | '1/2-1/2' | '*';

export type ChessEndReason =
  | 'checkmate'
  | 'stalemate'
  | 'draw'
  | 'resignation'
  | 'flag'
  | null;

export interface ChessMatchOptions {
  /** `null` = untimed (no clock is created at all). */
  readonly timeControl: ChessTimeControl | null;
  readonly whiteLabel: string;
  readonly blackLabel: string;
  /** Restore an in-progress/finished game (OTB record resume, or replay). */
  readonly fen?: string;
  readonly moves?: readonly ChessMoveRecord[];
}

/** A move attempt's outcome, returned by {@link ChessMatch.move}. */
export interface MoveAttemptResult {
  readonly ok: boolean;
  readonly san?: string;
}

export class ChessMatch {
  public readonly chess: Chess;
  public readonly clock: ChessClockEngine | null;
  private moveRecords: ChessMoveRecord[];
  private endReason: ChessEndReason = null;
  private resignedBy: ChessColor | null = null;

  constructor(private readonly options: ChessMatchOptions) {
    this.chess = new Chess(options.fen);
    this.clock = options.timeControl
      ? new ChessClockEngine(options.timeControl)
      : null;
    this.moveRecords = [...(options.moves ?? [])];
  }

  /** Start the clock (white to move first). A no-op for an untimed match. */
  public start(): void {
    this.clock?.start('w');
  }

  /** Advance the running clock by `deltaMs`; flags the active side on
   * timeout. Call from the host component's own tick loop (rAF/interval). */
  public tick(deltaMs: number): void {
    if (this.isOver()) return;
    this.clock?.tick(deltaMs);
    if (this.clock?.isFlagged()) {
      this.endReason = 'flag';
    }
  }

  public get turn(): ChessColor {
    return this.chess.turn() as ChessColor;
  }

  public get history(): readonly ChessMoveRecord[] {
    return this.moveRecords;
  }

  public fen(): string {
    return this.chess.fen();
  }

  public isCheck(): boolean {
    return this.chess.isCheck();
  }

  /** Legal destination squares, keyed by origin square — the shape chessground
   * wants for `movable.dests`. */
  public legalMovesBySquare(): Map<string, string[]> {
    const dests = new Map<string, string[]>();
    for (const m of this.chess.moves({ verbose: true }) as Move[]) {
      const arr = dests.get(m.from) ?? [];
      arr.push(m.to);
      dests.set(m.from, arr);
    }
    return dests;
  }

  /** Attempt a move. Returns `{ ok: false }` for an illegal move or once the
   * game has ended — never throws (chess.js's own throw-on-illegal is caught
   * here so callers get a plain result instead of a try/catch). Applies the
   * clock's increment/turn-switch on success and detects game-over.
   *
   * `promotion` defaults to `'q'` (auto-queen) — chess.js ignores the field
   * for non-promoting moves (only promotion candidates carry a `promotion`
   * key internally), so it's safe to always pass it. Under-promotion (to a
   * rook/bishop/knight) isn't exposed in the MVP UI — a documented rough
   * edge; every move from the board auto-queens. */
  public move(from: string, to: string, promotion = 'q'): MoveAttemptResult {
    if (this.isOver()) return { ok: false };
    let result: Move;
    try {
      result = this.chess.move({ from, to, promotion });
    } catch {
      return { ok: false };
    }

    const moverColor = result.color as ChessColor;
    this.clock?.switchTurn();
    const clockMsAfterMove = this.clock
      ? moverColor === 'w'
        ? this.clock.snapshot().whiteMs
        : this.clock.snapshot().blackMs
      : undefined;

    const idx = this.moveRecords.length;
    this.moveRecords.push({
      san: result.san,
      color: moverColor,
      clockMsAfterMove,
      moveNumber: Math.floor(idx / 2) + 1,
    });

    if (this.chess.isGameOver()) {
      this.clock?.pause();
      if (this.chess.isCheckmate()) this.endReason = 'checkmate';
      else if (this.chess.isStalemate()) this.endReason = 'stalemate';
      else this.endReason = 'draw';
    }

    return { ok: true, san: result.san };
  }

  /** A player resigns. A no-op once the game has already ended. */
  public resign(color: ChessColor): void {
    if (this.isOver()) return;
    this.endReason = 'resignation';
    this.resignedBy = color;
    this.clock?.pause();
  }

  public isOver(): boolean {
    return this.endReason !== null || this.chess.isGameOver();
  }

  public endReasonValue(): ChessEndReason {
    if (this.endReason) return this.endReason;
    if (this.chess.isCheckmate()) return 'checkmate';
    if (this.chess.isStalemate()) return 'stalemate';
    if (this.chess.isGameOver()) return 'draw';
    return null;
  }

  /** `1-0` / `0-1` / `1/2-1/2` / `*` (game still in progress). */
  public result(): ChessResult {
    const reason = this.endReasonValue();
    if (reason === 'flag') {
      const flaggedSide = this.clock?.snapshot().flaggedSide;
      return flaggedSide === 'w' ? '0-1' : flaggedSide === 'b' ? '1-0' : '*';
    }
    if (reason === 'resignation') {
      return this.resignedBy === 'w' ? '0-1' : '1-0';
    }
    if (reason === 'checkmate') {
      // The side to move now is the side that got mated.
      return this.chess.turn() === 'w' ? '0-1' : '1-0';
    }
    if (reason === 'stalemate' || reason === 'draw') {
      return '1/2-1/2';
    }
    return '*';
  }

  /** Human-readable end-of-game summary, e.g. "Black wins by checkmate". */
  public resultSummary(): string {
    const reason = this.endReasonValue();
    const result = this.result();
    if (!reason) return 'In progress';
    if (reason === 'stalemate') return 'Draw by stalemate';
    if (reason === 'draw') return 'Draw';
    const winner =
      result === '1-0' ? this.options.whiteLabel : this.options.blackLabel;
    if (reason === 'checkmate') return `${winner} wins by checkmate`;
    if (reason === 'resignation') return `${winner} wins by resignation`;
    if (reason === 'flag') return `${winner} wins on time`;
    return 'Game over';
  }

  /** PGN export with `%clk` per-move annotations (MVP scope item 4). */
  public toPgn(headers: Partial<PgnHeaders> = {}): string {
    const full: PgnHeaders = {
      event: headers.event,
      site: headers.site,
      date: headers.date ?? todayAsPgnDate(),
      round: headers.round,
      white: headers.white ?? this.options.whiteLabel,
      black: headers.black ?? this.options.blackLabel,
      result: headers.result ?? this.result(),
      timeControl:
        headers.timeControl ?? timeControlToPgnField(this.options.timeControl),
    };
    return buildPgnWithClocks(this.moveRecords, full);
  }
}
