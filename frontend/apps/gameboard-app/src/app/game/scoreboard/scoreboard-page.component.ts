import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { GameService } from '../../game.service';
import { GameState } from '../game-state';
import {
  emptyState,
  ScoreboardViewComponent,
} from './scoreboard-view.component';

// Re-export the shared roster/limit/empty-state helpers from their canonical
// home (the presentational view) so existing importers keep working.
export {
  DEMO_ROSTER,
  FOUL_LIMIT,
  emptyState,
} from './scoreboard-view.component';

/**
 * ScoreboardPageComponent — public, no-login scoreboard for `g/:gameID`.
 *
 * Owns route/data concerns only: reads `:gameID`, polls `GET /state` every 2 s
 * for live updates (decision 8), and renders the server-folded state via the
 * shared {@link ScoreboardViewComponent} (the single source of rendering truth,
 * also embedded by the operator console). Adds `?display=big` big-screen layout.
 */
@Component({
  selector: 'gameboard-scoreboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    ScoreboardViewComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>GameBoard</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <gameboard-scoreboard-view [state]="state()" [bigScreen]="bigScreen()" />
    </ion-content>
  `,
})
export class ScoreboardPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly gameService = inject(GameService);

  /** Game id from `:gameID` route param. */
  private readonly gameID = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('gameID') ?? '')),
    { initialValue: '' },
  );

  /** True when `?display=big` is in the query string. */
  protected readonly bigScreen = toSignal(
    this.route.queryParamMap.pipe(map((q) => q.get('display') === 'big')),
    { initialValue: false },
  );

  /** Server-folded state; starts empty and is refreshed on every poll tick. */
  protected readonly state = signal<GameState>(emptyState());

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Initial fetch whenever the route gameID resolves or changes.
    effect(() => {
      const id = this.gameID();
      if (id) void this.refresh(id);
    });

    // Poll every 2 s for live score updates (decision 8).
    const timer = setInterval(() => {
      const id = this.gameID();
      if (id) void this.refresh(id);
    }, 2000);

    destroyRef.onDestroy(() => clearInterval(timer));
  }

  private async refresh(gameID: string): Promise<void> {
    try {
      const s = await this.gameService.getState(gameID);
      this.state.set(s);
    } catch {
      // Ignore transient errors — the next poll will retry.
    }
  }
}
