// Wire types for the gameboard API — a thin client mirror of
// gameboard-ext/typespec/api4gameboard.tsp. The app is a thin client: the
// scoreboard renders server-folded state (GET /state), so it does NOT re-fold
// (the Go↔TS reducer parity already lives in @sneat/extension-gameboard-contract).
//
// Productionization note: replace this local mirror with an import of the
// published @sneat/extension-gameboard-contract once that lib is on the registry.

export type TeamSide = 'home' | 'away';

/** Inline team descriptor stored per side on a game; spaceID null for ad-hoc. */
export interface Side {
  name: string;
  colour: string;
  spaceID?: string | null;
}
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

export interface GameRecord {
  gameID: string;
  home: Side;
  away: Side;
  scheduledMs: number;
  status: GameStatus;
}

/** Bonus once the opponent has reached the per-period foul limit. */
export function inBonus(s: GameState, side: TeamSide, limit: number): boolean {
  const opp: TeamSide = side === 'away' ? 'home' : 'away';
  return s.teamFouls[opp] >= limit;
}

/** A rostered player. Roster/consent come from the team space (sneat-team) in
 * production; modelled here for the public-rendering rule. */
export interface Player {
  id: string;
  jersey: string;
  name: string;
  isMinor: boolean;
  publishConsent: boolean;
}

/**
 * Minor-safe public label (verifies sports/gameboard-live#ac:minor-shown-minimally):
 * a MINOR without publish-consent is shown by JERSEY NUMBER ONLY on public
 * surfaces; everyone else (adults, or minors with consent) shows their name.
 */
export function publicPlayerLabel(p: Player): string {
  if (p.isMinor && !p.publishConsent) {
    return `#${p.jersey}`;
  }
  return p.name;
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
