// Deterministic fold of a roster + its RSVP responses into the coach's
// fill/availability view — the same "single authoritative fold, many
// surfaces" pattern the approved `players-list` spec uses for live stats
// (spec/features/sports/gameboard-live/players-list/README.md
// REQ:player-stat-fold), applied here to attendance instead of points/fouls.
// Pure and stateless: recomputing from the same roster+responses always
// yields the same summary (no reads, no randomness).

import {
  GameInviteDoc,
  RosterPlayer,
  RsvpDisplayStatus,
  RsvpResponse,
} from './game-invite-contract';

export interface RosterFillRow {
  readonly player: RosterPlayer;
  readonly status: RsvpDisplayStatus;
  readonly response: RsvpResponse | null;
}

export interface RosterFillSummary {
  readonly total: number;
  readonly needed: number;
  readonly goingCount: number;
  readonly going: readonly RosterFillRow[];
  readonly maybe: readonly RosterFillRow[];
  readonly out: readonly RosterFillRow[];
  readonly noReply: readonly RosterFillRow[];
  readonly isFull: boolean;
  /** e.g. "8 of 12 going, need 4 more" / "10 of 10 going — full". */
  readonly fillLabel: string;
}

/** Fold a roster + response map into the grouped, deterministic fill summary.
 * A roster player with no entry in `responses` displays as `no-reply` — that
 * status is never persisted, only derived here. */
export function computeRosterFill(
  roster: readonly RosterPlayer[],
  responses: Readonly<Record<string, RsvpResponse>>,
  playersNeeded: number,
): RosterFillSummary {
  const rows: RosterFillRow[] = roster.map((player) => {
    const response = responses[player.playerId] ?? null;
    return { player, status: response?.status ?? 'no-reply', response };
  });

  const going = rows.filter((r) => r.status === 'going');
  const maybe = rows.filter((r) => r.status === 'maybe');
  const out = rows.filter((r) => r.status === 'out');
  const noReply = rows.filter((r) => r.status === 'no-reply');

  const goingCount = going.length;
  const isFull = playersNeeded > 0 && goingCount >= playersNeeded;
  const remaining = Math.max(0, playersNeeded - goingCount);
  const fillLabel =
    playersNeeded > 0
      ? isFull
        ? `${goingCount} of ${playersNeeded} going — full`
        : `${goingCount} of ${playersNeeded} going, need ${remaining} more`
      : `${goingCount} going`;

  return {
    total: roster.length,
    needed: playersNeeded,
    goingCount,
    going,
    maybe,
    out,
    noReply,
    isFull,
    fillLabel,
  };
}

/** Convenience overload straight from a doc. */
export function computeRosterFillForDoc(doc: GameInviteDoc): RosterFillSummary {
  return computeRosterFill(doc.roster, doc.responses, doc.playersNeeded);
}
