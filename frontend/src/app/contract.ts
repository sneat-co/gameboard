// Wire types for the gameboard API — a thin client mirror of
// gameboard-ext/typespec/api4gameboard.tsp. The app is a thin client: the
// scoreboard renders server-folded state (GET /state), so it does NOT re-fold
// (the Go↔TS reducer parity already lives in @sneat/extension-gameboard-contract).
//
// Productionization note: replace this local mirror with an import of the
// published @sneat/extension-gameboard-contract once that lib is on the registry.

export type TeamSide = 'home' | 'away';
export type EventType =
  | 'status' | 'period' | 'clock' | 'score' | 'team-foul'
  | 'timeout' | 'substitution' | 'possession' | 'judge-ruling' | 'correction';
export type GameStatus =
  | 'scheduled' | 'live' | 'halftime' | 'overtime' | 'final' | 'cancelled';
export type ClockAction = 'start' | 'stop' | 'adjust';
export type Source = 'scorekeeper' | 'timekeeper' | 'judge' | 'consensus';

export interface GameEvent {
  eventID: string;
  type: EventType;
  source: Source;
  wallClockMs: number;
  period: number;
  gameClockMs: number;
  status?: GameStatus;
  clockAction?: ClockAction;
  side?: TeamSide;
  points?: number;
  scorerID?: string;
  assistID?: string;
  playerOn?: string;
  playerOff?: string;
  correctionOf?: string;
}

export interface GameState {
  status: GameStatus;
  period: number;
  gameClockMs: number;
  clockRunning: boolean;
  scores: Record<TeamSide, number>;
  teamFouls: Record<TeamSide, number>;
  timeoutsUsed: Record<TeamSide, number>;
  possession: TeamSide | '';
  onCourt: Record<TeamSide, string[]>;
}

export interface AppendResponse {
  eventID: string;
  applied: boolean;
  status: string;
}

/** Bonus once the opponent has reached the per-period foul limit. */
export function inBonus(s: GameState, side: TeamSide, limit: number): boolean {
  const opp: TeamSide = side === 'away' ? 'home' : 'away';
  return s.teamFouls[opp] >= limit;
}

/** Canonical source for an event type (mirrors the backend authority matrix). */
export function sourceFor(type: EventType): Source {
  switch (type) {
    case 'score':
    case 'team-foul':
    case 'substitution':
      return 'scorekeeper';
    case 'clock':
    case 'period':
    case 'possession':
    case 'timeout':
    case 'status':
      return 'timekeeper';
    default:
      return 'judge';
  }
}

/** Random dashless id for client-generated eventIDs (idempotency key).
 * Uses the WebCrypto global (present in browsers and Node 18+). */
export function newEventID(): string {
  const buf = new Uint8Array(16);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}
