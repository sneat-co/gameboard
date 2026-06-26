import { TestBed } from '@angular/core/testing';
import { SneatApiService } from '@sneat/api';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { GameService } from './game.service';

// Focused on the appendEvent auth-fallback logic (Slice 3): signed-in operators
// write authenticated (decision 2); a token-less session (dev / real-stack E2E)
// transparently retries anonymously so gameboardd's devIdentity can authorize
// the write. Non-auth errors must NOT trigger the fallback.

const OK = { eventID: 'e1', applied: true, status: 'ok' };
const NOT_AUTH = 'User is not authenticated yet - no Firebase ID token';

function configure(post: ReturnType<typeof vi.fn>): {
  post: ReturnType<typeof vi.fn>;
  postAsAnonymous: ReturnType<typeof vi.fn>;
} {
  const postAsAnonymous = vi.fn().mockReturnValue(of(OK));
  TestBed.configureTestingModule({
    providers: [
      GameService,
      { provide: SneatApiService, useValue: { post, postAsAnonymous } },
    ],
  });
  return { post, postAsAnonymous };
}

describe('GameService.appendEvent', () => {
  it('uses authenticated post when a session is present', async () => {
    const { post, postAsAnonymous } = configure(
      vi.fn().mockReturnValue(of(OK)),
    );
    const svc = TestBed.inject(GameService);

    const res = await svc.append('g1', 'score', { side: 'home', points: 2 });

    expect(post).toHaveBeenCalledWith(
      'api4gameboard/games/g1/events',
      expect.objectContaining({ type: 'score', side: 'home', points: 2 }),
    );
    expect(postAsAnonymous).not.toHaveBeenCalled();
    expect(res.applied).toBe(true);
  });

  it('falls back to anonymous post when not authenticated', async () => {
    const { post, postAsAnonymous } = configure(
      vi.fn().mockReturnValue(throwError(() => NOT_AUTH)),
    );
    const svc = TestBed.inject(GameService);

    const res = await svc.append('g1', 'status', { status: 'live' });

    expect(post).toHaveBeenCalled();
    expect(postAsAnonymous).toHaveBeenCalledWith(
      'api4gameboard/games/g1/events',
      expect.objectContaining({ type: 'status', status: 'live' }),
    );
    expect(res.applied).toBe(true);
  });

  it('rethrows non-auth errors without falling back', async () => {
    const { postAsAnonymous } = configure(
      vi.fn().mockReturnValue(throwError(() => new Error('boom'))),
    );
    const svc = TestBed.inject(GameService);

    await expect(
      svc.append('g1', 'score', { side: 'home', points: 2 }),
    ).rejects.toThrow('boom');
    expect(postAsAnonymous).not.toHaveBeenCalled();
  });
});
