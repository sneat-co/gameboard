import { TestBed } from '@angular/core/testing';
import { SneatApiService } from '@sneat/api';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { GameInviteDoc } from './game-invite-contract';
import { GameInviteService } from './game-invite.service';

// Mirrors game.service.spec.ts's shape: GameInviteService is a thin
// SneatApiService wrapper (mirrors GameService for the sibling two-team
// scoreboard game), so these tests focus on which endpoint/verb each method
// calls and the anonymous-fallback behaviour for the RSVP write.

const NOT_AUTH = 'User is not authenticated yet - no Firebase ID token';

const DOC: GameInviteDoc = {
  gameId: 'g1',
  sport: 'basketball',
  teamName: 'U14 Girls',
  scheduledMs: 1_000_000,
  playersNeeded: 10,
  recurring: { enabled: false },
  organizerName: 'Coach Alex',
  roster: [],
  responses: {},
  createdAt: 1,
  updatedAt: 1,
};

function configure(overrides: {
  post?: ReturnType<typeof vi.fn>;
  get?: ReturnType<typeof vi.fn>;
  getAsAnonymous?: ReturnType<typeof vi.fn>;
  postAsAnonymous?: ReturnType<typeof vi.fn>;
}) {
  const post = overrides.post ?? vi.fn().mockReturnValue(of(DOC));
  const get = overrides.get ?? vi.fn().mockReturnValue(of([DOC]));
  const getAsAnonymous =
    overrides.getAsAnonymous ?? vi.fn().mockReturnValue(of(DOC));
  const postAsAnonymous =
    overrides.postAsAnonymous ?? vi.fn().mockReturnValue(of(DOC));
  TestBed.configureTestingModule({
    providers: [
      GameInviteService,
      {
        provide: SneatApiService,
        useValue: { post, get, getAsAnonymous, postAsAnonymous },
      },
    ],
  });
  return { post, get, getAsAnonymous, postAsAnonymous };
}

describe('GameInviteService', () => {
  it('createGameInvite POSTs to game-invites (authenticated)', async () => {
    const { post } = configure({});
    const svc = TestBed.inject(GameInviteService);

    const result = await svc.createGameInvite({
      sport: 'basketball',
      teamName: 'U14 Girls',
      scheduledMs: 1000,
      playersNeeded: 10,
      recurring: { enabled: false },
      organizerName: 'Coach',
      roster: [{ name: 'Ann' }],
    });

    expect(post).toHaveBeenCalledWith(
      'api4gameboard/game-invites',
      expect.objectContaining({ teamName: 'U14 Girls', playersNeeded: 10 }),
    );
    expect(result.gameId).toBe('g1');
  });

  it('getGameInvite reads via getAsAnonymous (public)', async () => {
    const { getAsAnonymous } = configure({});
    const svc = TestBed.inject(GameInviteService);

    const result = await svc.getGameInvite('g1');

    expect(getAsAnonymous).toHaveBeenCalledWith('api4gameboard/game-invites/g1');
    expect(result.teamName).toBe('U14 Girls');
  });

  it('addRosterPlayer POSTs anonymously (public/anon-friendly)', async () => {
    const { postAsAnonymous } = configure({});
    const svc = TestBed.inject(GameInviteService);

    await svc.addRosterPlayer('g1', { name: 'Cy', guardianName: 'Dana' });

    expect(postAsAnonymous).toHaveBeenCalledWith(
      'api4gameboard/game-invites/g1/roster',
      { name: 'Cy', guardianName: 'Dana' },
    );
  });

  it('getGameInviteByToken reads via getAsAnonymous', async () => {
    const { getAsAnonymous } = configure({
      getAsAnonymous: vi
        .fn()
        .mockReturnValue(of({ game: DOC, targetPlayerId: 'p1' })),
    });
    const svc = TestBed.inject(GameInviteService);

    const res = await svc.getGameInviteByToken('tok123');

    expect(getAsAnonymous).toHaveBeenCalledWith(
      'api4gameboard/game-invites/by-token/tok123',
    );
    expect(res.targetPlayerId).toBe('p1');
  });

  it('listMyGameInvites GETs (authenticated)', async () => {
    const { get } = configure({});
    const svc = TestBed.inject(GameInviteService);

    const games = await svc.listMyGameInvites();

    expect(get).toHaveBeenCalledWith('api4gameboard/game-invites');
    expect(games).toEqual([DOC]);
  });

  describe('submitRsvpByToken (parent-proxy write)', () => {
    it('uses authenticated post when a session is present', async () => {
      const { post, postAsAnonymous } = configure({});
      const svc = TestBed.inject(GameInviteService);

      const result = await svc.submitRsvpByToken('tok123', {
        playerId: 'p1',
        status: 'going',
        respondedBy: "Ann's mom",
      });

      expect(post).toHaveBeenCalledWith(
        'api4gameboard/game-invites/by-token/tok123/rsvp',
        expect.objectContaining({ playerId: 'p1', status: 'going' }),
      );
      expect(postAsAnonymous).not.toHaveBeenCalled();
      expect(result.gameId).toBe('g1');
    });

    it('falls back to anonymous post when not authenticated', async () => {
      const { post, postAsAnonymous } = configure({
        post: vi.fn().mockReturnValue(throwError(() => NOT_AUTH)),
      });
      const svc = TestBed.inject(GameInviteService);

      const result = await svc.submitRsvpByToken('tok123', {
        playerId: 'p1',
        status: 'maybe',
        respondedBy: 'A parent',
      });

      expect(post).toHaveBeenCalled();
      expect(postAsAnonymous).toHaveBeenCalledWith(
        'api4gameboard/game-invites/by-token/tok123/rsvp',
        expect.objectContaining({ playerId: 'p1', status: 'maybe' }),
      );
      expect(result.gameId).toBe('g1');
    });

    it('rethrows non-auth errors without falling back', async () => {
      const { postAsAnonymous } = configure({
        post: vi.fn().mockReturnValue(throwError(() => new Error('boom'))),
      });
      const svc = TestBed.inject(GameInviteService);

      await expect(
        svc.submitRsvpByToken('tok123', {
          playerId: 'p1',
          status: 'out',
          respondedBy: 'A parent',
        }),
      ).rejects.toThrow('boom');
      expect(postAsAnonymous).not.toHaveBeenCalled();
    });
  });
});
