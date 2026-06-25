import { Provider } from '@angular/core';
import { GAMEBOARD_SERVICE } from '@sneat/extension-gameboard-contract';
import { ListService } from './services';

// Registers the concrete ListService and binds it to the GAMEBOARD_SERVICE token so
// consumers depend only on the IGameboardService contract. Wired in at app bootstrap
// (consumers do not import this factory directly).
export function provideGameboardInternal(): Provider[] {
  return [ListService, { provide: GAMEBOARD_SERVICE, useExisting: ListService }];
}
