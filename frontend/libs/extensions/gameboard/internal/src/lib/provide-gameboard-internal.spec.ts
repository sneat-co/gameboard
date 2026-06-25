import { GAMEBOARD_SERVICE } from '@sneat/extension-gameboard-contract';
import { ListService } from './services';
import { provideGameboardInternal } from './provide-gameboard-internal';

describe('provideGameboardInternal', () => {
  it('provides ListService and binds it to GAMEBOARD_SERVICE', () => {
    const providers = provideGameboardInternal();
    expect(providers).toContain(ListService);
    expect(providers).toContainEqual({
      provide: GAMEBOARD_SERVICE,
      useExisting: ListService,
    });
  });
});
