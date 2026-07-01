// PGN generation WITH per-move clock annotations (`%clk`) — the OTB record's
// export/storage format (gameboard-chess MVP scope item 4). Format follows the
// convention lichess/chess.com use: a `{[%clk H:MM:SS]}` comment after every
// half-move, which — per the PGN spec — forces the move-number token to be
// restated with "..." for the black half-move that follows a comment.

import type { ChessColor, ChessTimeControl } from './chess-clock';
import { msToClk } from './chess-clock';
import type { ChessResult } from './chess-match';

export interface ChessMoveRecord {
  readonly san: string;
  readonly color: ChessColor;
  /** The mover's own clock, in ms, immediately AFTER this move (increment
   * already applied) — this is what `%clk` records. `undefined` for an
   * untimed game (no clock at all) — the PGN then omits `%clk` entirely
   * rather than printing a misleading `0:00:00`. */
  readonly clockMsAfterMove: number | undefined;
  /** Full-move number (shared by a white half-move and the black reply). */
  readonly moveNumber: number;
}

export interface PgnHeaders {
  readonly event?: string;
  readonly site?: string;
  /** `YYYY.MM.DD`, PGN's own date format. */
  readonly date?: string;
  readonly round?: string;
  readonly white?: string;
  readonly black?: string;
  readonly result?: ChessResult;
  /** Pre-formatted PGN `TimeControl` field value, e.g. `"180+2"`. */
  readonly timeControl?: string;
}

/** PGN's `TimeControl` header value: `<baseSeconds>+<incrementSeconds>`, or
 * `-` for an untimed game. */
export function timeControlToPgnField(tc: ChessTimeControl | null): string {
  if (!tc) return '-';
  return `${Math.round(tc.baseMs / 1000)}+${Math.round(tc.incrementMs / 1000)}`;
}

/** Today's date as a PGN `Date` header value (`YYYY.MM.DD`), UTC-based so it's
 * deterministic regardless of local timezone. */
export function todayAsPgnDate(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

/** Build a full PGN string (headers + movetext with `%clk` comments) from the
 * move list produced by {@link ChessMatch}. */
export function buildPgnWithClocks(
  moves: readonly ChessMoveRecord[],
  headers: PgnHeaders,
): string {
  const result = headers.result ?? '*';
  const tags: [string, string][] = [
    ['Event', headers.event ?? 'GameBoard.live casual game'],
    ['Site', headers.site ?? 'gameboard.live'],
    ['Date', headers.date ?? todayAsPgnDate()],
    ['Round', headers.round ?? '-'],
    ['White', headers.white ?? 'White'],
    ['Black', headers.black ?? 'Black'],
    ['Result', result],
  ];
  if (headers.timeControl) tags.push(['TimeControl', headers.timeControl]);

  const tagLines = tags
    .map(([k, v]) => `[${k} "${escapePgnTag(v)}"]`)
    .join('\n');

  const body = moves
    .map((mv) => {
      const clk =
        mv.clockMsAfterMove != null
          ? ` {[%clk ${msToClk(mv.clockMsAfterMove)}]}`
          : '';
      return mv.color === 'w'
        ? `${mv.moveNumber}. ${mv.san}${clk}`
        : `${mv.moveNumber}... ${mv.san}${clk}`;
    })
    .concat(result)
    .join(' ');

  return `${tagLines}\n\n${body}\n`;
}

function escapePgnTag(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
