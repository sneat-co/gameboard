import { appRoutes } from './app.routes';

describe('appRoutes', () => {
  it('serves a public landing component at the root path', () => {
    const root = appRoutes.find((r) => r.path === '');
    expect(root?.pathMatch).toBe('full');
    // Root renders a landing component, NOT a redirect.
    expect(root?.redirectTo).toBeUndefined();
    expect(typeof root?.loadComponent).toBe('function');
  });

  it('leaves the root path public (anonymous-friendly, no auth guard)', () => {
    const root = appRoutes.find((r) => r.path === '');
    // A first-time/anonymous visitor must land here with zero friction.
    expect(root?.canActivate ?? []).toHaveLength(0);
  });

  it('serves the public scoreboard at g/:gameID without an auth guard', () => {
    const sb = appRoutes.find((r) => r.path === 'g/:gameID');
    expect(sb).toBeDefined();
    expect(sb?.canActivate ?? []).toHaveLength(0);
    expect(typeof sb?.loadComponent).toBe('function');
  });

  it('serves the operator console at g/:gameID/console WITHOUT an auth guard', () => {
    // Decision 5 + E2E requirement: the console must be reachable without a
    // signed-in session so the real-stack E2E (devIdentity-authorized writes)
    // can drive the full lifecycle. An AuthGuard redirect would break the chain.
    const console = appRoutes.find((r) => r.path === 'g/:gameID/console');
    expect(console).toBeDefined();
    expect(console?.canActivate ?? []).toHaveLength(0);
    expect(typeof console?.loadComponent).toBe('function');
  });

  it('auth-guards the /my profile route', () => {
    const my = appRoutes.find((r) => r.path === 'my');
    expect(my?.canActivate?.length).toBeGreaterThan(0);
    expect(typeof my?.data?.['authGuardPipe']).toBe('function');
  });

  it('mounts the space-scoped routes lazily', () => {
    const space = appRoutes.find((r) => r.path === 'space/:spaceType/:spaceID');
    expect(space).toBeDefined();
    expect(typeof space?.loadChildren).toBe('function');
  });

  describe('game-invites (basketball game invites MVP)', () => {
    it('serves the organize-game form without an auth guard (anonymous-friendly)', () => {
      const organize = appRoutes.find((r) => r.path === 'game-invites/new');
      expect(organize).toBeDefined();
      expect(organize?.canActivate ?? []).toHaveLength(0);
      expect(typeof organize?.loadComponent).toBe('function');
    });

    it('serves the anon-first parent-proxy RSVP page without an auth guard', () => {
      const rsvp = appRoutes.find((r) => r.path === 'game-invites/rsvp/:token');
      expect(rsvp).toBeDefined();
      expect(rsvp?.canActivate ?? []).toHaveLength(0);
      expect(typeof rsvp?.loadComponent).toBe('function');
    });

    it('serves the roster/coach console without an auth guard', () => {
      const roster = appRoutes.find((r) => r.path === 'game-invites/:gameId');
      expect(roster).toBeDefined();
      expect(roster?.canActivate ?? []).toHaveLength(0);
      expect(typeof roster?.loadComponent).toBe('function');
    });

    it('serves the my-rosters list without an auth guard', () => {
      const list = appRoutes.find((r) => r.path === 'game-invites');
      expect(list).toBeDefined();
      expect(list?.pathMatch).toBe('full');
      expect(list?.canActivate ?? []).toHaveLength(0);
    });

    it('declares game-invites/new and game-invites/rsvp/:token before the :gameId catch-all, so literal segments are not shadowed', () => {
      const newIdx = appRoutes.findIndex((r) => r.path === 'game-invites/new');
      const rsvpIdx = appRoutes.findIndex(
        (r) => r.path === 'game-invites/rsvp/:token',
      );
      const gameIdIdx = appRoutes.findIndex(
        (r) => r.path === 'game-invites/:gameId',
      );
      expect(newIdx).toBeGreaterThanOrEqual(0);
      expect(rsvpIdx).toBeGreaterThanOrEqual(0);
      expect(gameIdIdx).toBeGreaterThanOrEqual(0);
      expect(newIdx).toBeLessThan(gameIdIdx);
      expect(rsvpIdx).toBeLessThan(gameIdIdx);
    });
  });
});
