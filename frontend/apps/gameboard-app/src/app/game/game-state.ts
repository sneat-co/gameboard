// Wire types for the gameboard event-timeline API — the event/state half of the
// thin client mirror of gameboard-ext/typespec/api4gameboard.tsp. The app is a
// thin client: the scoreboard renders server-folded state (GET /state), so it
// does NOT re-fold (the Go↔TS reducer parity already lives in the backend).
//
// SINGLE SOURCE OF TRUTH: `TeamSide` (and `Side`) are defined once, in
// ../new-game/game-contract, and imported here — they are NOT redefined in this
// module. Only `TeamSide` is referenced by the event/state half below.
//
// Productionization note: replace this local mirror with an import of the
// published @sneat/extension-gameboard-contract once that lib is on the registry.

import { TeamSide } from '../new-game/game-contract';

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
  playerPoints: Record<string, number>;
  playerAssists: Record<string, number>;
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

/**
 * Builds a complete GameEvent payload from an event type + partial fields,
 * filling the client-derived defaults exactly like the legacy api.service.ts
 * `append()`: `eventID` via newEventID() (idempotency key), `source` via
 * sourceFor(type), `wallClockMs` via Date.now(), `period`/`gameClockMs`
 * defaulting to 0 — each only when not already supplied. This is the ONE
 * payload-building code path; GameService.append() and console callers both go
 * through it. */
export function buildEvent(type: EventType, payload: Partial<GameEvent> = {}): GameEvent {
  return {
    eventID: payload.eventID ?? newEventID(),
    type,
    source: payload.source ?? sourceFor(type),
    wallClockMs: payload.wallClockMs ?? Date.now(),
    period: payload.period ?? 0,
    gameClockMs: payload.gameClockMs ?? 0,
    ...payload,
  };
}
