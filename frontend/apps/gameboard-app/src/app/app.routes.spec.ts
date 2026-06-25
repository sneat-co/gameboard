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

  it('auth-guards the /my profile route', () => {
    const my = appRoutes.find((r) => r.path === 'my');
    expect(my?.canActivate?.length).toBeGreaterThan(0);
    expect(typeof my?.data?.['authGuardPipe']).toBe('function');
  });

  it('mounts the space-scoped routes lazily', () => {
    const space = appRoutes.find(
      (r) => r.path === 'space/:spaceType/:spaceID',
    );
    expect(space).toBeDefined();
    expect(typeof space?.loadChildren).toBe('function');
  });
});
