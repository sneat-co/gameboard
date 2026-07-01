import { beforeEach, describe, expect, it } from 'vitest';
import {
  addRosterPlayer,
  createGameInvite,
  CreateGameInviteInput,
  deleteGameInvite,
  getGameInvite,
  getMyInviteeName,
  listGameInvites,
  setMyInviteeName,
  setRsvp,
} from './game-invite-store';

function makeInput(
  overrides: Partial<CreateGameInviteInput> = {},
): CreateGameInviteInput {
  return {
    sport: 'basketball',
    teamName: 'U14 Girls',
    scheduledMs: 1_000_000,
    playersNeeded: 10,
    recurring: { enabled: false },
    organizerName: 'Coach Alex',
    roster: [{ name: 'Ann' }, { name: 'Bo' }],
    ...overrides,
  };
}

describe('game-invite-store (localStorage-backed)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a game, assigning a fresh id to the game and to each roster player', () => {
    const doc = createGameInvite(makeInput());
    expect(doc.gameId).toBeTruthy();
    expect(doc.roster).toHaveLength(2);
    expect(doc.roster[0].playerId).toBeTruthy();
    expect(doc.roster[1].playerId).toBeTruthy();
    expect(doc.roster[0].playerId).not.toBe(doc.roster[1].playerId);
    expect(doc.responses).toEqual({});
  });

  it('trims free-text fields and drops empty optionals', () => {
    const doc = createGameInvite(
      makeInput({
        opponentName: '   ',
        venue: '  Court 3  ',
        organizerName: '  ',
      }),
    );
    expect(doc.opponentName).toBeUndefined();
    expect(doc.venue).toBe('Court 3');
    // Blank organizer name falls back to a sensible default rather than ''.
    expect(doc.organizerName).toBe('Coach');
  });

  it('round-trips a created game by id', () => {
    const doc = createGameInvite(makeInput());
    expect(getGameInvite(doc.gameId)).toEqual(doc);
  });

  it('returns null for an unknown id', () => {
    expect(getGameInvite('missing')).toBeNull();
  });

  it('lists all saved games newest-first', () => {
    const a = createGameInvite(makeInput({ teamName: 'A' }));
    const b = createGameInvite(makeInput({ teamName: 'B' }));
    const ids = listGameInvites().map((g) => g.gameId);
    expect(ids[0]).toBe(b.gameId);
    expect(ids[1]).toBe(a.gameId);
  });

  it('deletes a game', () => {
    const doc = createGameInvite(makeInput());
    deleteGameInvite(doc.gameId);
    expect(getGameInvite(doc.gameId)).toBeNull();
  });

  it('tolerates corrupted storage content by treating it as empty', () => {
    localStorage.setItem('gameboard.game-invites.games', '{not json');
    expect(listGameInvites()).toEqual([]);
  });

  describe('addRosterPlayer', () => {
    it('appends a new player with a fresh id and bumps updatedAt', () => {
      const doc = createGameInvite(makeInput());
      const before = doc.updatedAt;
      const updated = addRosterPlayer(doc.gameId, {
        name: 'Cy',
        guardianName: 'Dana (mom)',
      });
      expect(updated?.roster).toHaveLength(3);
      const added = updated?.roster[2];
      expect(added?.name).toBe('Cy');
      expect(added?.guardianName).toBe('Dana (mom)');
      expect(added?.playerId).toBeTruthy();
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(before);
    });

    it('returns null for an unknown game', () => {
      expect(addRosterPlayer('missing', { name: 'Cy' })).toBeNull();
    });
  });

  describe('setRsvp (RSVP state transitions)', () => {
    it('records a first RSVP for a roster player', () => {
      const doc = createGameInvite(makeInput());
      const playerId = doc.roster[0].playerId;
      const updated = setRsvp(doc.gameId, playerId, 'going', "Ann's mom");
      expect(updated?.responses[playerId]).toMatchObject({
        playerId,
        status: 'going',
        respondedBy: "Ann's mom",
      });
    });

    it('updates an existing RSVP in place (changing mind from maybe to going)', () => {
      const doc = createGameInvite(makeInput());
      const playerId = doc.roster[0].playerId;
      setRsvp(doc.gameId, playerId, 'maybe', "Ann's mom");
      const updated = setRsvp(doc.gameId, playerId, 'going', "Ann's mom");
      expect(Object.keys(updated?.responses ?? {})).toHaveLength(1);
      expect(updated?.responses[playerId].status).toBe('going');
    });

    it("leaves other players' responses untouched", () => {
      const doc = createGameInvite(makeInput());
      const [p1, p2] = doc.roster.map((p) => p.playerId);
      setRsvp(doc.gameId, p1, 'going', 'Parent 1');
      const updated = setRsvp(doc.gameId, p2, 'out', 'Parent 2');
      expect(updated?.responses[p1].status).toBe('going');
      expect(updated?.responses[p2].status).toBe('out');
    });

    it('returns null when the player is not on the roster', () => {
      const doc = createGameInvite(makeInput());
      expect(setRsvp(doc.gameId, 'nonexistent', 'going', 'Parent')).toBeNull();
    });

    it('returns null for an unknown game', () => {
      expect(setRsvp('missing', 'p1', 'going', 'Parent')).toBeNull();
    });

    it('persists an optional note', () => {
      const doc = createGameInvite(makeInput());
      const playerId = doc.roster[0].playerId;
      const updated = setRsvp(
        doc.gameId,
        playerId,
        'out',
        'Parent',
        'sick this week',
      );
      expect(updated?.responses[playerId].note).toBe('sick this week');
    });
  });

  describe('invitee identity (anon-first, remembered locally)', () => {
    it('is empty until set', () => {
      expect(getMyInviteeName()).toBe('');
    });

    it('round-trips a saved name, trimmed', () => {
      setMyInviteeName('  Maria  ');
      expect(getMyInviteeName()).toBe('Maria');
    });

    it('ignores a blank name (keeps the previous value)', () => {
      setMyInviteeName('Maria');
      setMyInviteeName('   ');
      expect(getMyInviteeName()).toBe('Maria');
    });
  });
});
