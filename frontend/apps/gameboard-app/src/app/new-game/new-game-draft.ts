// Draft persistence for the new-game form (anon-first-new-game Feature).
// A first-time/anonymous user must be able to fill the form, navigate away
// (notably the full-page redirect sign-in), and come back to find their input
// intact. We keep a single most-recent draft in localStorage — no backend, no
// account required. Persisting the actual game still needs an explicit
// authenticated action; this is purely the in-progress form state.

import { CreatorRole } from './game-contract';

/** Serialized shape of the in-progress new-game form. All fields optional so a
 * partial / older draft still rehydrates what it can. */
export interface NewGameDraft {
  sport: string;
  homeName: string;
  homeColour: string;
  awayName: string;
  awayColour: string;
  date: string;
  time: string;
  venue: string;
  competition: string;
  role: CreatorRole;
}

/** Single most-recent draft key. Namespaced to avoid clashing with other apps
 * served under the same origin. */
export const NEW_GAME_DRAFT_KEY = 'gameboard.new-game.draft';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // localStorage can throw (e.g. disabled cookies / privacy mode).
    return null;
  }
}

/** Read the saved draft, or null when none exists / it can't be parsed. */
export function loadNewGameDraft(): Partial<NewGameDraft> | null {
  const raw = storage()?.getItem(NEW_GAME_DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Partial<NewGameDraft>)
      : null;
  } catch {
    return null;
  }
}

/** Persist the in-progress form as the single most-recent draft. */
export function saveNewGameDraft(draft: NewGameDraft): void {
  storage()?.setItem(NEW_GAME_DRAFT_KEY, JSON.stringify(draft));
}

/** Drop the saved draft (e.g. after the game is created). */
export function clearNewGameDraft(): void {
  storage()?.removeItem(NEW_GAME_DRAFT_KEY);
}
