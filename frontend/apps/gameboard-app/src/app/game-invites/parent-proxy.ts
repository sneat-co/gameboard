// The parent-proxy RSVP mapping — the youth-sport mechanic the roadmap doc's
// §2.2.2 identifies as the one genuine gap in the approved specs: sport-events
// (backstage/spec/.../rsvp-express/sport-events) records "a signed-in
// responder" without saying who that responder can act FOR. Here, the ACTOR
// (the account/identity that opens the link and taps a button) and the
// CONTACT (the roster player the response is about) are deliberately kept as
// two separate values — never collapsed into one "who responded" field —
// because a minor player has no account of their own; the parent is the
// account, the kid is the subject.
//
// Fable: swap to sport-events' planned guardian-mediated response REQ, which
// writes {contact: <kid's contactus id>, role, attendance} onto the
// calendarius happening while the acting account is the linked parent's
// (satisfying account-gate's "actors are accounts" invariant without the kid
// needing one). `buildProxyResponse` below is that same shape, pre-wiring.

import { RsvpResponse, RsvpStatus } from './game-invite-contract';

/**
 * Build the RsvpResponse for a parent (`respondedBy`, the actor) RSVPing on
 * behalf of a specific roster kid (`playerId`, the contact/subject).
 * `respondedBy` is trimmed and defaults to "A parent" if left blank, so a
 * response is never attributed to an empty string.
 */
export function buildProxyResponse(
  playerId: string,
  status: RsvpStatus,
  guardianName: string,
  note?: string,
  respondedAt: number = Date.now(),
): RsvpResponse {
  const respondedBy = guardianName.trim() || 'A parent';
  return {
    playerId,
    status,
    respondedBy,
    respondedAt,
    ...(note?.trim() ? { note: note.trim() } : {}),
  };
}

/** True when a response was recorded by someone other than the player named
 * (a heuristic for "this looks like a proxy response" — real guardian-edge
 * verification is owned by `linkage`/`sneat-team roles`, not this client). */
export function isLikelyProxyResponse(
  playerName: string,
  response: RsvpResponse,
): boolean {
  return (
    response.respondedBy.trim().toLowerCase() !==
    playerName.trim().toLowerCase()
  );
}
