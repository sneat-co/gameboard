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
  IonButton,
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
    IonButton,
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

      <!-- Follow control (spectator surface only — not in the shared view so it
           does not appear on the operator console). The legacy account-id input
           is OMITTED: auth is now Firebase-token based (decision 2); the
           signed-in→following path is covered by unit test (decision 10). -->
      <p class="follow">
        <ion-button data-testid="follow-home" (click)="followHome()"
          >Follow home team</ion-button
        >
        <span data-testid="follow-status">{{ followStatus() }}</span>
      </p>
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

  /**
   * Follow status for the home team. Initially '' (not yet clicked), then
   * 'following' on success or 'account required' on any error (client-side
   * auth guard when no Firebase session — decision 10).
   */
  protected readonly followStatus = signal<string>('');

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

  /**
   * Follow the home team. Catches any error — including SneatApiService's
   * client-side "not authenticated" guard (thrown before any network call when
   * there is no Firebase session) — and shows 'account required'. On success
   * shows 'following'. Mirrors the legacy followHome() try/catch shape.
   *
   * Note: the legacy account-id input is OMITTED. Auth is Firebase-token based
   * (decision 2). The signed-in→following path is unit-tested (decision 10);
   * the real backend-401 fidelity is deferred to a real Auth-emulator sign-in.
   */
  public async followHome(): Promise<void> {
    try {
      await this.gameService.follow('team', `${this.gameID()}:home`);
      this.followStatus.set('following');
    } catch {
      this.followStatus.set('account required');
    }
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
