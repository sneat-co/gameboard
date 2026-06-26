import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { GameState, publicPlayerLabel } from '../game-state';
import {
  DEMO_ROSTER,
  emptyState,
} from '../scoreboard/scoreboard-view.component';

/**
 * RecapPageComponent — public, no-login post-game recap screen for
 * `g/:gameID/recap`.
 *
 * Renders the deterministic fold's final score and box score (points → assists),
 * minor-safe, mirroring the `<section class="recap">` block of the legacy
 * `app.component.ts` and the `recap.spec.ts` assertions.
 *
 * Design decisions (logged as required):
 *   - Polls at 2 s interval (same as scoreboard, decision 8 consistency): handles
 *     the edge case where the browser arrives before the final event is fully
 *     folded. An initial `getState` fires immediately on route resolve (via the
 *     gameID effect); the interval keeps the view live until `status=final`.
 *   - Score-by-period OMITTED: `GameState` has no per-period breakdown field.
 *     Deferred — not in the contract; adding it would require a contract change.
 *   - Per-player minutes OMITTED: `GameState` has no `playerMinutes` field.
 *     Deferred — same reason.
 *
 * Box-score sort: points desc, then label asc (mirrors legacy `boxScore()`).
 * Minor-safe label: `publicPlayerLabel` over `DEMO_ROSTER`
 * (no-consent minor → `#jersey`, never the name — decision 7).
 */
@Component({
  selector: 'gameboard-recap-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Game Recap</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="final-score">
        <h2>
          Final:
          <span data-testid="score-home">{{ state().scores.home }}</span>
          &ndash;
          <span data-testid="score-away">{{ state().scores.away }}</span>
        </h2>
        <p>
          Status: <b data-testid="status">{{ state().status }}</b>
        </p>
      </div>

      <section data-testid="recap" class="recap">
        <h3>Box score (points &rarr; assists)</h3>
        <ul>
          @for (line of boxScore(); track line.id) {
            <li data-testid="recap-line">
              {{ line.label }}: {{ line.pts }} pts, {{ line.ast }} ast
            </li>
          }
        </ul>
      </section>
    </ion-content>
  `,
  styles: `
    .final-score {
      text-align: center;
      padding: 1rem 0;
    }

    .final-score h2 {
      font-family: var(--gb-font-score, monospace);
      font-size: 2.5rem;
    }

    .recap {
      max-width: 40rem;
      margin: 0 auto;
    }

    .recap ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .recap li {
      padding: 0.4rem 0;
      border-bottom: 1px solid var(--ion-color-light, #eee);
    }
  `,
})
export class RecapPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly gameService = inject(GameService);

  /** Game id from the `:gameID` route param. */
  private readonly gameID = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('gameID') ?? '')),
    { initialValue: '' },
  );

  /** Server-folded state; refreshed every 2 s (polls until final fold arrives). */
  protected readonly state = signal<GameState>(emptyState());

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Single load whenever the route gameID resolves or changes.
    effect(() => {
      const id = this.gameID();
      if (id) void this.load(id);
    });

    // Lightweight poll at 2 s interval — handles the edge case where the
    // browser arrives before the final event is fully folded (decision 8
    // consistency: same interval as scoreboard).
    const timer = setInterval(() => {
      const id = this.gameID();
      if (id) void this.load(id);
    }, 2000);

    destroyRef.onDestroy(() => clearInterval(timer));
  }

  private async load(gameID: string): Promise<void> {
    try {
      const s = await this.gameService.getState(gameID);
      this.state.set(s);
    } catch {
      // Ignore transient errors; the next poll will retry.
    }
  }

  /**
   * Minor-safe public label for a player id.
   * Falls back to the raw id when the player is not in the demo roster.
   */
  private label(id: string): string {
    const p = DEMO_ROSTER[id];
    return p ? publicPlayerLabel(p) : id;
  }

  /**
   * Box-score lines (points → assists), sorted by points desc then label asc.
   * Ports `boxScore()` from the legacy `app.component.ts` exactly.
   * Only players who appear in `playerPoints` OR `playerAssists` are listed.
   *
   * NOTE: score-by-period and per-player minutes are OMITTED — those fields do
   * not exist in `GameState`. Both are deferred pending a contract extension.
   */
  protected readonly boxScore = computed(() => {
    const s = this.state();
    const ids = new Set([
      ...Object.keys(s.playerPoints),
      ...Object.keys(s.playerAssists),
    ]);
    return [...ids]
      .map((id) => ({
        id,
        label: this.label(id),
        pts: s.playerPoints[id] ?? 0,
        ast: s.playerAssists[id] ?? 0,
      }))
      .sort((a, b) => b.pts - a.pts || a.label.localeCompare(b.label));
  });
}
