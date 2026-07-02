// Draft persistence for the organize-game form — same rationale and shape as
// ../new-game/new-game-draft.ts's NewGameDraft: the backend's
// POST /v0/api4gameboard/game-invites now requires an authenticated organizer
// (game_invite.go's createGameInvite handler), so an anonymous coach who taps
// "Create game" is routed through sign-in first (see
// organize-game-page.component.ts's create()). Without this draft, that
// round-trip would silently discard everything they'd typed — this keeps the
// anon-first spirit (fill in freely, sign in only at the moment of actually
// persisting) even though persisting itself is no longer anonymous.

import { RecurringSchedule, Sport } from './game-invite-contract';

/** One in-progress roster row before a playerId is assigned. */
export interface OrganizeGameDraftPlayer {
  name: string;
  jersey: string;
  guardianName: string;
}

/** Serialized shape of the in-progress organize-game form. All fields
 * optional so a partial/older draft still rehydrates what it can. */
export interface OrganizeGameDraft {
  sport: Sport;
  teamName: string;
  opponentName: string;
  date: string;
  time: string;
  venue: string;
  playersNeeded: number;
  recurring: RecurringSchedule;
  roster: OrganizeGameDraftPlayer[];
}

/** Single most-recent draft key. Namespaced to avoid clashing with
 * new-game's own draft key or other apps served under the same origin. */
export const ORGANIZE_GAME_DRAFT_KEY = 'gameboard.game-invites.organize-draft';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // localStorage can throw (e.g. disabled cookies / privacy mode).
    return null;
  }
}

/** Read the saved draft, or null when none exists / it can't be parsed. */
export function loadOrganizeGameDraft(): Partial<OrganizeGameDraft> | null {
  const raw = storage()?.getItem(ORGANIZE_GAME_DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Partial<OrganizeGameDraft>)
      : null;
  } catch {
    return null;
  }
}

/** Persist the in-progress form as the single most-recent draft. */
export function saveOrganizeGameDraft(draft: OrganizeGameDraft): void {
  storage()?.setItem(ORGANIZE_GAME_DRAFT_KEY, JSON.stringify(draft));
}

/** Drop the saved draft (e.g. after the game is created). */
export function clearOrganizeGameDraft(): void {
  storage()?.removeItem(ORGANIZE_GAME_DRAFT_KEY);
}
