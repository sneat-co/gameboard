// Minimal client mirror of the gameboard new-game wire contract
// (gameboard-ext/typespec/api4gameboard.tsp). Productionization: replace with an
// import from @sneat/extension-gameboard-contract once that lib is published.

export type TeamSide = 'home' | 'away';

/** Inline team descriptor stored per side on a game; spaceID null for ad-hoc. */
export interface Side {
  name: string;
  colour: string;
  spaceID?: string | null;
}

export interface GameRecord {
  gameID: string;
  home: Side;
  away: Side;
  status: string;
  scheduledMs?: number;
  location?: string;
}

/** Body of PUT /v0/api4gameboard/games/{gameID}; omitted fields are unchanged. */
export interface UpdateGameSettings {
  scheduledMs?: number;
  location?: string;
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
