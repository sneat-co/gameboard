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
});
