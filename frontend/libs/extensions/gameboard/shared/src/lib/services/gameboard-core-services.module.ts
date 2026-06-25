import { NgModule } from '@angular/core';
import {
  IGameboardAppStateService,
  GameboardAppStateService,
} from './gameboard-app-state.service';

// Provides the template UI-state service. The concrete ListService is no longer
// provided here — it is bound to the GAMEBOARD_SERVICE contract token by
// provideGameboardInternal() at app bootstrap (the app is the composition root).
@NgModule({
  providers: [
    {
      provide: IGameboardAppStateService,
      useClass: GameboardAppStateService,
    },
  ],
})
export class GameboardCoreServicesModule {}
