// Pure UCI helpers for the vs-computer mode (MVP scope item 2). Kept separate
// from stockfish.service.ts (the Web Worker wrapper) so the protocol logic —
// building commands, parsing engine output — is unit-testable without a real
// Worker/WASM runtime (jsdom has neither).

export interface StockfishLevel {
  readonly id: 'easy' | 'medium' | 'hard';
  readonly label: string;
  /** UCI "Skill Level" option, 0 (weakest) – 20 (strongest). */
  readonly skill: number;
  /** Search depth cap passed to `go depth N` — bounds thinking time. */
  readonly depth: number;
}

/** Three difficulty levels (MVP scope item 2: "at least 2-3 strength levels").
 * Skill Level + a shallow depth cap keeps "Easy" genuinely beatable; "Hard" is
 * still far short of full-strength Stockfish (no depth/time limit) by design —
 * a MVP opponent, not a tournament engine. */
export const STOCKFISH_LEVELS: readonly StockfishLevel[] = [
  { id: 'easy', label: 'Easy', skill: 1, depth: 4 },
  { id: 'medium', label: 'Medium', skill: 8, depth: 8 },
  { id: 'hard', label: 'Hard', skill: 15, depth: 12 },
];

export function uciSetSkillCommand(level: StockfishLevel): string {
  return `setoption name Skill Level value ${level.skill}`;
}

export function uciPositionCommand(fen: string): string {
  return `position fen ${fen}`;
}

export function uciGoCommand(level: StockfishLevel): string {
  return `go depth ${level.depth}`;
}

export interface ParsedBestMove {
  readonly from: string;
  readonly to: string;
  readonly promotion?: string;
}

/** Parse a `bestmove e2e4 ponder e7e5` (or `bestmove e7e8q`) UCI line. Returns
 * `null` for any other engine output line (info/id/option/readyok/…) and for
 * the no-legal-move sentinel `bestmove (none)`. */
export function parseBestMoveLine(line: string): ParsedBestMove | null {
  const m = /^bestmove\s+([a-h][1-8])([a-h][1-8])([qrbn])?\b/.exec(line.trim());
  if (!m) return null;
  return { from: m[1], to: m[2], promotion: m[3] };
}
