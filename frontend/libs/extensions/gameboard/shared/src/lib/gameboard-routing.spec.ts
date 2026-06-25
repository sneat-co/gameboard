import { templateRoutes } from './gameboard-routing';

describe('templateRoutes', () => {
  it('exposes the lists overview route', () => {
    expect(templateRoutes.some((r) => r.path === 'lists')).toBe(true);
  });

  it('exposes the list detail route with listType + listID params', () => {
    expect(
      templateRoutes.some((r) => r.path === 'list/:listType/:listID'),
    ).toBe(true);
  });

  it('lazy-loads every route via loadComponent', () => {
    for (const route of templateRoutes) {
      expect(typeof route.loadComponent).toBe('function');
    }
  });
});
