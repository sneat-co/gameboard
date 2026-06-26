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
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TeamSide } from '../../new-game/game-contract';
import { GameService } from '../../game.service';
import { EventType, GameEvent, GameState } from '../game-state';
import {
  emptyState,
  ScoreboardViewComponent,
} from '../scoreboard/scoreboard-view.component';

/**
 * ConsolePageComponent — the operator console for `g/:gameID/console`
 * (timekeeper + scorekeeper). One surface: the live scoreboard (the shared
 * {@link ScoreboardViewComponent}, so the operator sees exactly what spectators
 * see — board == fold) plus the control groups.
 *
 * Each control is a REAL `GameService.append(...)` through the stack
 * (gameboardd → dalgo → Firestore emulator → fold); after every append the
 * folded state is re-read via `GET /state` (decision 8 polling pattern), and a
 * 2 s interval also refreshes for any out-of-band updates. Mirrors the legacy
 * `app.component.ts` console section + action methods exactly (including the
 * 600000/540000 clock values and the data-testids), so the salvaged
 * full-game journey ports near-verbatim.
 *
 * Route note (decision 5): this route is intentionally NOT auth-guarded. No
 * role-gating UI, and there is no blocking sign-in — gameboardd's devIdentity
 * authorizes writes, so the operator console is reachable and functional
 * without a real signed-in session (which is exactly what lets the real-stack
 * E2E drive the full lifecycle). Authenticated-write fidelity is a
 * prod/sneat-go concern; here the console proves the UI → API → emulator → fold
 * span. Any future sign-in affordance must stay non-blocking like new-game.
 */
@Component({
  selector: 'gameboard-console-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonContent,
    IonButton,
    ScoreboardViewComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Console</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Live state — the same rendering spectators see (board == fold). -->
      <gameboard-scoreboard-view [state]="state()" />

      <section class="console">
        <h3>Timekeeper</h3>
        <div class="controls">
          <ion-button data-testid="go-live" (click)="status('live')"
            >Go live</ion-button
          >
          <ion-button data-testid="period-1" (click)="period(1)"
            >Period 1</ion-button
          >
          <ion-button data-testid="clock-start" (click)="clockStart()"
            >Start clock</ion-button
          >
          <ion-button data-testid="clock-stop" (click)="clockStop()"
            >Stop clock</ion-button
          >
          <ion-button data-testid="possession-away" (click)="possession('away')"
            >Possession away</ion-button
          >
          <ion-button data-testid="timeout-home" (click)="timeout('home')"
            >Timeout home</ion-button
          >
          <ion-button
            color="danger"
            data-testid="final"
            (click)="status('final')"
            >Final</ion-button
          >
        </div>

        <h3>Scorekeeper</h3>
        <div class="controls">
          <ion-button data-testid="home-ft" (click)="score('home', 1)"
            >Home FT</ion-button
          >
          <ion-button data-testid="home-2" (click)="score('home', 2)"
            >Home +2</ion-button
          >
          <ion-button data-testid="home-3" (click)="score('home', 3)"
            >Home +3</ion-button
          >
          <ion-button data-testid="away-2" (click)="score('away', 2)"
            >Away +2</ion-button
          >
          <ion-button data-testid="away-foul" (click)="foul('away')"
            >Away foul</ion-button
          >
          <ion-button data-testid="sub-home" (click)="sub('home')"
            >Sub home</ion-button
          >
          <ion-button
            data-testid="home-2-by-p1"
            (click)="scoreBy('home', 2, 'p1', 'p2')"
            >Home +2 (p1, assist p2)</ion-button
          >
        </div>
      </section>
    </ion-content>
  `,
  styles: `
    .console {
      max-width: 60rem;
      margin: 1rem auto 0;
    }
    .console h3 {
      margin: 1.25rem 0 0.5rem;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  `,
})
export class ConsolePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly gameService = inject(GameService);

  /** Game id from the `:gameID` route param. */
  private readonly gameID = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('gameID') ?? '')),
    { initialValue: '' },
  );

  /** Server-folded state; refreshed after every append and on each poll tick. */
  protected readonly state = signal<GameState>(emptyState());

  /** Monotonic substitution counter → playerOn `p1`, `p2`, `p3`, … (legacy). */
  private subSeq = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Initial fetch whenever the route gameID resolves or changes.
    effect(() => {
      const id = this.gameID();
      if (id) void this.refresh(id);
    });

    // Poll every 2 s for live updates (decision 8).
    const timer = setInterval(() => {
      const id = this.gameID();
      if (id) void this.refresh(id);
    }, 2000);

    destroyRef.onDestroy(() => clearInterval(timer));
  }

  /** Append a real event then immediately re-read the folded state. */
  private async dispatch(
    type: EventType,
    payload: Partial<GameEvent> = {},
  ): Promise<void> {
    const id = this.gameID();
    if (!id) return;
    await this.gameService.append(id, type, payload);
    await this.refresh(id);
  }

  private async refresh(gameID: string): Promise<void> {
    try {
      this.state.set(await this.gameService.getState(gameID));
    } catch {
      // Ignore transient errors — the next poll / action will retry.
    }
  }

  // --- Timekeeper actions (mirror legacy app.component.ts) -----------------

  protected status(s: 'live' | 'final'): Promise<void> {
    return this.dispatch('status', { status: s });
  }
  protected period(n: number): Promise<void> {
    return this.dispatch('period', { period: n });
  }
  protected clockStart(): Promise<void> {
    return this.dispatch('clock', {
      clockAction: 'start',
      gameClockMs: 600000,
    });
  }
  protected clockStop(): Promise<void> {
    return this.dispatch('clock', { clockAction: 'stop', gameClockMs: 540000 });
  }
  protected possession(side: TeamSide): Promise<void> {
    return this.dispatch('possession', { side });
  }
  protected timeout(side: TeamSide): Promise<void> {
    return this.dispatch('timeout', { side });
  }

  // --- Scorekeeper actions ------------------------------------------------

  protected score(side: TeamSide, points: number): Promise<void> {
    return this.dispatch('score', { side, points });
  }
  protected scoreBy(
    side: TeamSide,
    points: number,
    scorerID: string,
    assistID?: string,
  ): Promise<void> {
    return this.dispatch('score', { side, points, scorerID, assistID });
  }
  protected foul(side: TeamSide): Promise<void> {
    return this.dispatch('team-foul', { side });
  }
  protected sub(side: TeamSide): Promise<void> {
    this.subSeq++;
    return this.dispatch('substitution', { side, playerOn: `p${this.subSeq}` });
  }
}
