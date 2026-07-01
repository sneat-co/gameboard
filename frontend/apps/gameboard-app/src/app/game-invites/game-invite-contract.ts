// Client-side model for the basketball "organize → invite → RSVP → roster"
// loop (backstage/docs/roadmaps/gameboard-game-invites.md). This is a NEW
// aggregate distinct from the existing new-game/game-contract.ts `GameRecord`
// (a two-competing-teams scoreboard game): a GameInviteDoc is one team's own
// game/practice, its season roster, and the RSVP-driven fill count — the
// coach-organizes-for-their-roster scenario, not a live-scored match.
//
// Reuse decision (see the roadmap doc's §2 reuse table + gameboard's own
// spec/features/sports/gameboard-live/{new-game,role-invites,players-list}):
// this whole aggregate is meant to be composed from calendarius (schedule),
// eventius (occasion overlay), invitus (invite delivery/link), rsvp-express's
// sport-events vertical (attendance + role write-back), and sneat.team +
// linkage (roster + guardian edges). None of those are wireable client-side
// yet from this app, so each field group below is modelled with a
// `// Fable: swap to <facade>` marker at the point it would be replaced.

/** Sports the invite flow supports today. Basketball is the default and the
 * only one with real game-day semantics; the others are placeholders so the
 * picker generalizes the way new-game's own SPORTS list does. */
export type Sport =
  | 'basketball'
  | 'soccer'
  | 'gaelic-football'
  | 'hurling-camogie'
  | 'other';

export const SPORTS: readonly { id: Sport; label: string; emoji: string }[] = [
  { id: 'basketball', label: 'Basketball', emoji: '🏀' },
  { id: 'soccer', label: 'Football/Soccer', emoji: '⚽' },
  { id: 'gaelic-football', label: 'Gaelic Football', emoji: '☘️' },
  { id: 'hurling-camogie', label: 'Hurling/Camogie', emoji: '🏑' },
  { id: 'other', label: 'Other', emoji: '🎮' },
];

/** Attendance status per roster player. `no-reply` is never stored — it is the
 * derived default for any roster player with no RsvpResponse yet (see
 * roster-fill.ts). */
export type RsvpStatus = 'going' | 'maybe' | 'out';
export type RsvpDisplayStatus = RsvpStatus | 'no-reply';

/**
 * One kid on the team roster.
 *
 * Fable: swap to a `sneat-team` season-roster `contactus` person (jersey #,
 * position, DOB) linked to a parent via a `linkage` parent↔child /
 * guardian-role edge (backstage/spec/features/sports/sneat-team + roles).
 * Today `guardianName` is just the free-text label the organizer typed when
 * adding the player — there is no real contact or account behind it yet.
 */
export interface RosterPlayer {
  readonly playerId: string;
  readonly name: string;
  readonly jersey?: string;
  readonly guardianName?: string;
}

/**
 * One parent's RSVP for one roster kid.
 *
 * Fable: swap to rsvp-express's `sport-events` vertical writing
 * `{contact, role, attendance}` back onto the calendarius happening
 * (backstage/spec/.../rsvp-express/sport-events/README.md REQ:sport-writeback)
 * — the account-gated responder acting *for* a linked minor is the
 * parent-proxy REQ this roadmap doc's §2.2.2 adds on top of that vertical.
 * `respondedBy` is that proxy: the PARENT's display name (the actor/account),
 * distinct from `playerId` (the CONTACT — the kid — the response is about).
 */
export interface RsvpResponse {
  readonly playerId: string;
  readonly status: RsvpStatus;
  readonly respondedBy: string;
  readonly respondedAt: number;
  readonly note?: string;
}

/**
 * Models (does not yet execute) a weekly recurring practice/game — the
 * roadmap doc's §2.2.1 gap: Calendarius happenings already support
 * `Repeats: "weekly"`; this flag is the client-side placeholder for a
 * `sneat-team`-owned recurring happening new-game/organize-game could later
 * instantiate individual occurrences from.
 *
 * Fable: swap to a Calendarius `happening` with
 * `HappeningSlotTiming{Repeats: "weekly", Weekdays: [...]}`.
 */
export interface RecurringSchedule {
  readonly enabled: boolean;
  readonly weekday?: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
  readonly time?: string;
}

export const WEEKDAYS: readonly {
  id: NonNullable<RecurringSchedule['weekday']>;
  label: string;
}[] = [
  { id: 'sun', label: 'Sunday' },
  { id: 'mon', label: 'Monday' },
  { id: 'tue', label: 'Tuesday' },
  { id: 'wed', label: 'Wednesday' },
  { id: 'thu', label: 'Thursday' },
  { id: 'fri', label: 'Friday' },
  { id: 'sat', label: 'Saturday' },
];

/**
 * The persisted aggregate for one organized game + its roster + RSVPs.
 *
 * Fable: swap the (sport, scheduledMs, venue) fields to a Calendarius
 * `happening` + thin eventius overlay (schedule-and-place), and swap
 * `roster`/`responses` to the sneat-team roster + rsvp-express write-back
 * described on each field above. Persistence itself (see
 * game-invite-store.ts) is localStorage today, mirroring the chess
 * prototype's `chess-game-store.ts` convention, pending a real client-write
 * path for this aggregate.
 */
export interface GameInviteDoc {
  readonly gameId: string;
  readonly sport: Sport;
  readonly teamName: string;
  readonly opponentName?: string;
  readonly scheduledMs: number;
  readonly venue?: string;
  readonly playersNeeded: number;
  readonly recurring: RecurringSchedule;
  readonly organizerName: string;
  readonly roster: readonly RosterPlayer[];
  readonly responses: Readonly<Record<string, RsvpResponse>>;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** The one-line invite teaser shown on the RSVP page and copied alongside the
 * link, e.g. "🏀 Basketball, Sat 3pm at Court X — you in?" */
export function inviteTeaser(doc: GameInviteDoc): string {
  const sport = SPORTS.find((s) => s.id === doc.sport);
  const emoji = sport?.emoji ?? '🎮';
  const label = sport?.label ?? doc.sport;
  const when = doc.scheduledMs
    ? new Date(doc.scheduledMs).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'TBD';
  const where = doc.venue ? ` at ${doc.venue}` : '';
  return `${emoji} ${label}, ${when}${where} — you in?`;
}
