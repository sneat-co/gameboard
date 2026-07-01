import { describe, expect, it } from 'vitest';
import {
  buildInviteLink,
  decodeInviteToken,
  encodeInviteToken,
} from './invite-token';

describe('invite-token encode/decode', () => {
  it('round-trips a targeted (gameId + playerId) payload', () => {
    const token = encodeInviteToken({ gameId: 'g1', playerId: 'p1' });
    expect(decodeInviteToken(token)).toEqual({ gameId: 'g1', playerId: 'p1' });
  });

  it('round-trips an open (gameId only) payload with no playerId key', () => {
    const token = encodeInviteToken({ gameId: 'g1' });
    const decoded = decodeInviteToken(token);
    expect(decoded).toEqual({ gameId: 'g1' });
    expect(decoded && 'playerId' in decoded).toBe(false);
  });

  it('produces a URL-safe token (no +, /, or = characters)', () => {
    // Names/ids with characters that base64-encode to '+', '/' would break an
    // un-escaped URL; assert the alphabet actually used is URL-safe.
    const token = encodeInviteToken({ gameId: '???>>>///+++', playerId: 'p1' });
    expect(token).not.toMatch(/[+/=]/);
    expect(decodeInviteToken(token)).toEqual({
      gameId: '???>>>///+++',
      playerId: 'p1',
    });
  });

  it('round-trips unicode content (e.g. an accented team/venue name)', () => {
    const token = encodeInviteToken({ gameId: 'gâmé-123', playerId: 'josé' });
    expect(decodeInviteToken(token)).toEqual({
      gameId: 'gâmé-123',
      playerId: 'josé',
    });
  });

  it('returns null for garbage / hand-edited tokens', () => {
    expect(decodeInviteToken('not-a-real-token!!')).toBeNull();
    expect(decodeInviteToken('')).toBeNull();
  });

  it('returns null when the decoded JSON has no gameId', () => {
    const token = encodeInviteToken as unknown as (p: unknown) => string;
    const bogus = token({ playerId: 'p1' });
    expect(decodeInviteToken(bogus)).toBeNull();
  });

  it('buildInviteLink composes the origin + the /game-invites/rsvp/:token route', () => {
    const link = buildInviteLink('https://gameboard.live', {
      gameId: 'g1',
      playerId: 'p1',
    });
    expect(link).toMatch(/^https:\/\/gameboard\.live\/game-invites\/rsvp\//);
    const token = link.split('/').pop() ?? '';
    expect(decodeInviteToken(token)).toEqual({ gameId: 'g1', playerId: 'p1' });
  });
});
