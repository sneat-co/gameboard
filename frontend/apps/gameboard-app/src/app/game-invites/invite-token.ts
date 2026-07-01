// Shareable invite-link encode/decode — the client-side stand-in for
// `invitus`'s `link` delivery channel (schema-valid, compose-only today per
// the roadmap doc's reuse table). A token is an opaque, URL-safe string that
// round-trips {gameId, playerId?}: `playerId` present = a per-player targeted
// invite (role-invites' "assign crew"/"invite roster" pattern — pre-fills who
// the link is for); absent = an open join link (role-invites'
// REQ:open-join-link — the recipient picks/adds themselves on the RSVP page).
//
// Fable: swap to invitus's `InviteDbo` (Type/Channel/TargetType/TargetIDs/
// Pin/Limit/Expires) once a real client-write path exists; this token is
// deliberately shaped like that future payload (gameId ~ TargetIDs[0],
// playerId ~ a second target) so the swap is a storage/issuance change, not a
// link-shape change.

export interface InviteTokenPayload {
  readonly gameId: string;
  readonly playerId?: string;
}

/** Base64url-encode a UTF-8 string without padding (URL/query-string safe). */
function toBase64Url(input: string): string {
  const base64 = globalThis.btoa(unescape(encodeURIComponent(input)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(token: string): string {
  const padded = token
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(token.length / 4) * 4, '=');
  return decodeURIComponent(escape(globalThis.atob(padded)));
}

/** Encode a payload into an opaque token for the invite link's last path
 * segment. */
export function encodeInviteToken(payload: InviteTokenPayload): string {
  return toBase64Url(JSON.stringify(payload));
}

/** Decode a token back to its payload, or `null` if it is malformed / not
 * ours (e.g. someone hand-edited the URL). Never throws. */
export function decodeInviteToken(token: string): InviteTokenPayload | null {
  try {
    const parsed = JSON.parse(fromBase64Url(token)) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as { gameId?: unknown }).gameId !== 'string'
    ) {
      return null;
    }
    const { gameId, playerId } = parsed as {
      gameId: string;
      playerId?: unknown;
    };
    return {
      gameId,
      ...(typeof playerId === 'string' ? { playerId } : {}),
    };
  } catch {
    return null;
  }
}

/** The full shareable URL for a payload, given the app's origin (e.g.
 * `location.origin`). */
export function buildInviteLink(
  origin: string,
  payload: InviteTokenPayload,
): string {
  return `${origin}/game-invites/rsvp/${encodeInviteToken(payload)}`;
}
