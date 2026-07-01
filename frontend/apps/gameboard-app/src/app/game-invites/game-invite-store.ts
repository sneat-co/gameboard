// Persistence for organized games + their roster + RSVPs.
//
// Fable: swap to the real chain the roadmap doc's reuse table lays out —
// Calendarius happening (schedule) + eventius overlay + invitus (invite
// delivery) + rsvp-express sport-events write-back (roster/RSVP) + sneat.team
// (roster/roles) — once each has a client-write path from this app. Until
// then this module's public surface (`createGameInvite`, `saveGameInvite`,
// `listGameInvites`, `getGameInvite`, `addRosterPlayer`, `setRsvp`,
// `deleteGameInvite`) is written as the shape a real backend-backed
// implementation would expose, exactly mirroring the established convention
// in ../chess/chess-game-store.ts (itself modelled on GameService.watchMyGames
// in ../game.service.ts) — kept as plain localStorage-backed functions, not a
// class/service, to match that precedent.

import {
  GameInviteDoc,
  RecurringSchedule,
  RosterPlayer,
  RsvpResponse,
  RsvpStatus,
  Sport,
} from './game-invite-contract';
import { buildProxyResponse } from './parent-proxy';

const STORAGE_KEY = 'gameboard.game-invites.games';
const IDENTITY_KEY = 'gameboard.game-invites.myName';

function randomId(): string {
  const buf = new Uint8Array(16);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Fresh id for a new organized game — same 32-char dashless hex convention as
 * game-state.ts's newEventID / chess-game-store's newChessGameId. */
export function newGameId(): string {
  return randomId();
}

/** Fresh id for a new roster player. */
export function newPlayerId(): string {
  return randomId();
}

// Monotonically-increasing timestamp so two records created within the same
// millisecond (common in tests, and possible in real fast double-taps) still
// sort deterministically newest-first — Date.now() alone can tie.
let lastNowMs = 0;
function monotonicNowMs(): number {
  const now = Date.now();
  lastNowMs = now > lastNowMs ? now : lastNowMs + 1;
  return lastNowMs;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // localStorage can throw (privacy mode / disabled cookies).
    return null;
  }
}

function readAll(): Record<string, GameInviteDoc> {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, GameInviteDoc>)
      : {};
  } catch {
    return {};
  }
}

function writeAll(games: Record<string, GameInviteDoc>): void {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(games));
}

/** Create/overwrite a game-invite record wholesale. */
export function saveGameInvite(doc: GameInviteDoc): void {
  const all = readAll();
  all[doc.gameId] = doc;
  writeAll(all);
}

/** All saved games, newest-first. */
export function listGameInvites(): GameInviteDoc[] {
  return Object.values(readAll()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getGameInvite(gameId: string): GameInviteDoc | null {
  return readAll()[gameId] ?? null;
}

export function deleteGameInvite(gameId: string): void {
  const all = readAll();
  delete all[gameId];
  writeAll(all);
}

export interface CreateGameInviteInput {
  readonly sport: Sport;
  readonly teamName: string;
  readonly opponentName?: string;
  readonly scheduledMs: number;
  readonly venue?: string;
  readonly playersNeeded: number;
  readonly recurring: RecurringSchedule;
  readonly organizerName: string;
  /** Initial roster; each entry is assigned a fresh playerId. */
  readonly roster: readonly Omit<RosterPlayer, 'playerId'>[];
}

/** Create a new organized game (the "organize a game" step). Persists
 * immediately and returns the created doc (its `gameId` is what the roster
 * console and invite links key off). */
export function createGameInvite(input: CreateGameInviteInput): GameInviteDoc {
  const now = monotonicNowMs();
  const doc: GameInviteDoc = {
    gameId: newGameId(),
    sport: input.sport,
    teamName: input.teamName.trim(),
    opponentName: input.opponentName?.trim() || undefined,
    scheduledMs: input.scheduledMs,
    venue: input.venue?.trim() || undefined,
    playersNeeded: input.playersNeeded,
    recurring: input.recurring,
    organizerName: input.organizerName.trim() || 'Coach',
    roster: input.roster.map((p) => ({
      playerId: newPlayerId(),
      name: p.name.trim(),
      jersey: p.jersey?.trim() || undefined,
      guardianName: p.guardianName?.trim() || undefined,
    })),
    responses: {},
    createdAt: now,
    updatedAt: now,
  };
  saveGameInvite(doc);
  return doc;
}

/** Add one player to an existing game's roster (used both by the organizer's
 * roster console and by the open-join/"add my kid" path on the RSVP page).
 * Returns the updated doc, or null if the game doesn't exist. */
export function addRosterPlayer(
  gameId: string,
  player: Omit<RosterPlayer, 'playerId'>,
): GameInviteDoc | null {
  const doc = getGameInvite(gameId);
  if (!doc) return null;
  const newPlayer: RosterPlayer = {
    playerId: newPlayerId(),
    name: player.name.trim(),
    jersey: player.jersey?.trim() || undefined,
    guardianName: player.guardianName?.trim() || undefined,
  };
  const updated: GameInviteDoc = {
    ...doc,
    roster: [...doc.roster, newPlayer],
    updatedAt: monotonicNowMs(),
  };
  saveGameInvite(updated);
  return updated;
}

/** Record (or update) one roster player's RSVP — the parent-proxy write-back.
 * `playerId` must already be on the roster (use addRosterPlayer first for a
 * walk-in). Returns the updated doc, or null if the game/player don't exist. */
export function setRsvp(
  gameId: string,
  playerId: string,
  status: RsvpStatus,
  respondedBy: string,
  note?: string,
): GameInviteDoc | null {
  const doc = getGameInvite(gameId);
  if (!doc) return null;
  if (!doc.roster.some((p) => p.playerId === playerId)) return null;
  const response: RsvpResponse = buildProxyResponse(
    playerId,
    status,
    respondedBy,
    note,
  );
  const updated: GameInviteDoc = {
    ...doc,
    responses: { ...doc.responses, [playerId]: response },
    updatedAt: monotonicNowMs(),
  };
  saveGameInvite(updated);
  return updated;
}

/** The invitee's own display name, remembered locally across visits so a
 * parent doesn't retype it for every kid/game they RSVP for (anon-first — no
 * account required). */
export function getMyInviteeName(): string {
  return storage()?.getItem(IDENTITY_KEY) ?? '';
}

export function setMyInviteeName(name: string): void {
  const trimmed = name.trim();
  if (trimmed) storage()?.setItem(IDENTITY_KEY, trimmed);
}

/** Minimal explicit interface a future backend-backed implementation would
 * satisfy — not used internally (the functions above ARE the
 * implementation), kept so the seam is visible in one place (mirrors
 * ChessGameStore in ../chess/chess-game-store.ts). */
export interface GameInviteStore {
  create(input: CreateGameInviteInput): GameInviteDoc | Promise<GameInviteDoc>;
  list(): GameInviteDoc[] | Promise<GameInviteDoc[]>;
  get(gameId: string): GameInviteDoc | null | Promise<GameInviteDoc | null>;
  addPlayer(
    gameId: string,
    player: Omit<RosterPlayer, 'playerId'>,
  ): GameInviteDoc | null | Promise<GameInviteDoc | null>;
  rsvp(
    gameId: string,
    playerId: string,
    status: RsvpStatus,
    respondedBy: string,
    note?: string,
  ): GameInviteDoc | null | Promise<GameInviteDoc | null>;
  remove(gameId: string): void | Promise<void>;
}
