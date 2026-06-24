import { Component, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { GameState, inBonus, type TeamSide } from './contract';

const FOUL_LIMIT = 5; // team fouls per period before the bonus

@Component({
  selector: 'gb-root',
  standalone: true,
  template: `
    <h1>GameBoard.live</h1>

    <section class="scoreboard" data-testid="scoreboard">
      <div>
        <span class="score" data-testid="score-home">{{ state().scores.home }}</span>
        <span> – </span>
        <span class="score" data-testid="score-away">{{ state().scores.away }}</span>
      </div>
      <p>
        Status: <b data-testid="status">{{ state().status }}</b> ·
        Period: <b data-testid="period">{{ state().period }}</b> ·
        Clock: <b data-testid="clock">{{ clock() }}</b>
        <span data-testid="clock-running">{{ state().clockRunning ? '▶' : '⏸' }}</span>
      </p>
      <p>
        Fouls H/A: <b>{{ state().teamFouls.home }}</b>/<b>{{ state().teamFouls.away }}</b>
        @if (homeBonus()) {<span class="bonus" data-testid="home-bonus">HOME BONUS</span>}
        · Timeouts used H/A: {{ state().timeoutsUsed.home }}/{{ state().timeoutsUsed.away }}
        · Possession: <b data-testid="possession">{{ state().possession || '—' }}</b>
      </p>
    </section>

    <section class="console">
      <h3>Timekeeper</h3>
      <button data-testid="go-live" (click)="status('live')">Go live</button>
      <button data-testid="period-1" (click)="period(1)">Period 1</button>
      <button data-testid="clock-start" (click)="clockStart()">Start clock</button>
      <button data-testid="clock-stop" (click)="clockStop()">Stop clock</button>
      <button data-testid="possession-away" (click)="possession('away')">Possession away</button>
      <button data-testid="timeout-home" (click)="timeout('home')">Timeout home</button>
      <button data-testid="final" (click)="status('final')">Final</button>

      <h3>Scorekeeper</h3>
      <button data-testid="home-ft" (click)="score('home', 1)">Home FT</button>
      <button data-testid="home-2" (click)="score('home', 2)">Home +2</button>
      <button data-testid="home-3" (click)="score('home', 3)">Home +3</button>
      <button data-testid="away-2" (click)="score('away', 2)">Away +2</button>
      <button data-testid="away-foul" (click)="foul('away')">Away foul</button>
      <button data-testid="sub-home" (click)="sub('home')">Sub home</button>
    </section>
  `,
  imports: [],
})
export class AppComponent {
  private readonly api = inject(ApiService);
  readonly gameID = (globalThis as { __GB_GAME__?: string }).__GB_GAME__ ?? 'demo';

  readonly state = signal<GameState>(emptyState());
  private subSeq = 0;

  constructor() {
    void this.refresh();
  }

  clock(): string {
    const ms = this.state().gameClockMs;
    const total = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  homeBonus(): boolean {
    return inBonus(this.state(), 'home', FOUL_LIMIT);
  }

  private async refresh(): Promise<void> {
    this.state.set(await this.api.state(this.gameID));
  }

  private async append(p: Promise<unknown>): Promise<void> {
    await p;
    await this.refresh();
  }

  status(s: 'live' | 'final'): Promise<void> {
    return this.append(this.api.append(this.gameID, 'status', { status: s }));
  }
  period(n: number): Promise<void> {
    return this.append(this.api.append(this.gameID, 'period', { period: n }));
  }
  clockStart(): Promise<void> {
    return this.append(this.api.append(this.gameID, 'clock', { clockAction: 'start', gameClockMs: 600000 }));
  }
  clockStop(): Promise<void> {
    return this.append(this.api.append(this.gameID, 'clock', { clockAction: 'stop', gameClockMs: 540000 }));
  }
  possession(side: TeamSide): Promise<void> {
    return this.append(this.api.append(this.gameID, 'possession', { side }));
  }
  timeout(side: TeamSide): Promise<void> {
    return this.append(this.api.append(this.gameID, 'timeout', { side }));
  }
  score(side: TeamSide, points: number): Promise<void> {
    return this.append(this.api.append(this.gameID, 'score', { side, points }));
  }
  foul(side: TeamSide): Promise<void> {
    return this.append(this.api.append(this.gameID, 'team-foul', { side }));
  }
  sub(side: TeamSide): Promise<void> {
    this.subSeq++;
    return this.append(this.api.append(this.gameID, 'substitution', { side, playerOn: `p${this.subSeq}` }));
  }
}

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
  };
}
