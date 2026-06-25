// Gameboard new-game wire contract — the TS side of api4gameboard.tsp
// (gameboard-ext). Lives in the `contract` tier per the extension-library
// architecture. NOTE: still pending reconciliation with the gameboard-ext
// `@sneat/extension-gameboard-contract` package (the *-ext repo).

export type TeamSide = 'home' | 'away';

/** Inline team descriptor stored per side on a game; spaceID null for ad-hoc. */
export interface Side {
  name: string;
  colour: string;
  spaceID?: string | null;
}

export interface GameRecord {
  id: string;
  home: Side;
  away: Side;
  status: string;
  scheduledMs?: number;
}

/** Self-declared creator role (new-game spec REQ:creator-affiliation). */
export type CreatorRole =
  | 'coach'
  | 'player'
  | 'score-keeper'
  | 'timekeeper'
  | 'judge'
  | 'spectator';

export const CREATOR_ROLES: readonly CreatorRole[] = [
  'coach',
  'player',
  'score-keeper',
  'timekeeper',
  'judge',
  'spectator',
];
