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
import { GameState, inBonus, Player, publicPlayerLabel } from '../game-state';

/** Per-period team-foul limit before the opponent enters the bonus. */
export const FOUL_LIMIT = 5;

/**
 * Demo roster (STUB — production roster/consent come from the team space).
 * Keyed by the player id used in substitution events.
 * p1 = adult, p2 = no-consent minor (shows jersey only), p3 = consented minor.
 */
export const DEMO_ROSTER: Record<string, Player> = {
  p1: {
    id: 'p1',
    jersey: '7',
    name: 'Alex Adult',
    isMinor: false,
    publishConsent: false,
  },
  p2: {
    id: 'p2',
    jersey: '23',
    name: 'Jordan Minor',
    isMinor: true,
    publishConsent: false,
  },
  p3: {
    id: 'p3',
    jersey: '11',
    name: 'Sam Consented',
    isMinor: true,
    publishConsent: true,
  },
};

/** Returns the empty/initial game state used before the first poll resolves. */
function emptyState(): GameState {
  return {
    status: 'scheduled',
    period: 0,
    gameClockMs: 0,
    clockRunning: false,
    scores: { home: 0, away: 0 },
    teamFouls: { home: 0, away: 0 },
    timeoutsUsed: { home: 0, away: 0 },
    possession: '',
    onCourt: { home: [], away: [] },
    playerPoints: {},
    playerAssists: {},
  };
}

/**
 * ScoreboardPageComponent — public, no-login scoreboard for `g/:gameID`.
 *
 * Renders the server-folded `GET /state` and polls every 2 s for live updates.
 * Adds `?display=big` big-screen layout (dark "scoreboard moment" tokens).
 * Minor-safe: no-consent minors on court show `#jersey`, never their name.
 */
@Component({
  selector: 'gameboard-scoreboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>GameBoard</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div
        class="scoreboard"
        [class.big]="bigScreen()"
        data-testid="scoreboard"
      >
        <div class="score-row">
          <span class="score score-home" data-testid="score-home">{{
            state().scores.home
          }}</span>
          <span class="dash">&ndash;</span>
          <span class="score score-away" data-testid="score-away">{{
            state().scores.away
          }}</span>
        </div>

        <p class="clock-row">
          Status:
          <b data-testid="status">{{ state().status }}</b>
          &middot; Period:
          <b data-testid="period">{{ state().period }}</b>
          &middot; Clock:
          <b data-testid="clock">{{ clock() }}</b>
          <span data-testid="clock-running">{{
            state().clockRunning ? '▶' : '⏸'
          }}</span>
        </p>

        <p class="fouls-row">
          Fouls H/A:
          <b>{{ state().teamFouls.home }}</b
          >/<b>{{ state().teamFouls.away }}</b>
          @if (homeBonus()) {
            <span class="bonus" data-testid="home-bonus">HOME BONUS</span>
          }
          &middot; Timeouts used H/A:
          {{ state().timeoutsUsed.home }}/{{ state().timeoutsUsed.away }}
          &middot; Possession:
          <b data-testid="possession">{{ state().possession || '—' }}</b>
        </p>

        <p class="oncourt" data-testid="oncourt-home">
          On court (home):
          @for (id of state().onCourt.home; track id) {
            <span class="player">{{ label(id) }}</span>
          }
        </p>
      </div>
    </ion-content>
  `,
  styles: `
    .scoreboard {
      padding: 1rem;
      font-family: var(--gb-font-sans, inherit);
    }

    .scoreboard.big {
      background: radial-gradient(
        ellipse at top,
        var(--gb-score-bg-top) 0%,
        var(--gb-score-bg) 100%
      );
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #fff;
    }

    .score-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      justify-content: center;
    }

    .score {
      font-family: var(--gb-font-score, monospace);
      font-size: 4rem;
      line-height: 1;
    }

    .scoreboard.big .score-home {
      color: var(--gb-score-home);
    }

    .scoreboard.big .score-away {
      color: var(--gb-score-away);
    }

    .scoreboard.big .clock-row b[data-testid='clock'] {
      color: var(--gb-clock);
    }

    .dash {
      font-size: 3rem;
    }

    .bonus {
      display: inline-block;
      margin-left: 0.5rem;
      padding: 0.1rem 0.4rem;
      background: var(--gb-energy, #ff6a00);
      color: #fff;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: bold;
      letter-spacing: 0.05em;
    }

    .player {
      display: inline-block;
      margin: 0 0.25rem;
      font-weight: 500;
    }
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

  /** Formatted game clock m:ss from the folded gameClockMs. */
  protected readonly clock = computed(() => {
    const ms = this.state().gameClockMs;
    const total = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  });

  /** True when the away team has reached FOUL_LIMIT fouls (home enters bonus). */
  protected readonly homeBonus = computed(() =>
    inBonus(this.state(), 'home', FOUL_LIMIT),
  );

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

  /**
   * Minor-safe label for an on-court player id.
   * Falls back to the raw id when the player is not in the demo roster.
   */
  protected label(id: string): string {
    const p = DEMO_ROSTER[id];
    return p ? publicPlayerLabel(p) : id;
  }
}
