import { describe, expect, it } from 'vitest';
import { buildProxyResponse, isLikelyProxyResponse } from './parent-proxy';

describe('buildProxyResponse (parent-proxy RSVP mapping)', () => {
  it('records the CONTACT (playerId) and the ACTOR (respondedBy) separately', () => {
    const r = buildProxyResponse(
      'kid-1',
      'going',
      'Maria (mom)',
      undefined,
      1000,
    );
    expect(r.playerId).toBe('kid-1');
    expect(r.respondedBy).toBe('Maria (mom)');
    expect(r.status).toBe('going');
    expect(r.respondedAt).toBe(1000);
  });

  it('trims the guardian name and drops an empty note', () => {
    const r = buildProxyResponse('kid-1', 'maybe', '  Maria  ', '   ');
    expect(r.respondedBy).toBe('Maria');
    expect(r.note).toBeUndefined();
  });

  it('keeps a trimmed note when provided', () => {
    const r = buildProxyResponse('kid-1', 'out', 'Maria', '  flu, sorry!  ');
    expect(r.note).toBe('flu, sorry!');
  });

  it('falls back to "A parent" when no guardian name is given', () => {
    const r = buildProxyResponse('kid-1', 'going', '   ');
    expect(r.respondedBy).toBe('A parent');
  });

  it('defaults respondedAt to now when not supplied', () => {
    const before = Date.now();
    const r = buildProxyResponse('kid-1', 'going', 'Maria');
    expect(r.respondedAt).toBeGreaterThanOrEqual(before);
  });
});

describe('isLikelyProxyResponse', () => {
  it('is true when the responder name differs from the player name (a parent responding for a kid)', () => {
    const r = buildProxyResponse('kid-1', 'going', 'Maria (mom)');
    expect(isLikelyProxyResponse('Lily', r)).toBe(true);
  });

  it('is false when the responder name matches the player name (self-RSVP, e.g. an adult league)', () => {
    const r = buildProxyResponse('p1', 'going', 'Sam');
    expect(isLikelyProxyResponse('Sam', r)).toBe(false);
  });

  it('is case/whitespace insensitive for the match', () => {
    const r = buildProxyResponse('p1', 'going', '  sam  ');
    expect(isLikelyProxyResponse('Sam', r)).toBe(false);
  });
});
