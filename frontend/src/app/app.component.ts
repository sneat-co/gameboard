import { Component, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { GameState, inBonus, publicPlayerLabel, type Player, type TeamSide } from './contract';

const FOUL_LIMIT = 5; // team fouls per period before the bonus

// Demo roster (STUB — production roster/consent come from the team space,
// sneat-team). Keyed by the player id used in substitution events.
const DEMO_ROSTER: Record<string, Player> = {
  p1: { id: 'p1', jersey: '7', name: 'Alex Adult', isMinor: false, publishConsent: false },
  p2: { id: 'p2', jersey: '23', name: 'Jordan Minor', isMinor: true, publishConsent: false },
  p3: { id: 'p3', jersey: '11', name: 'Sam Consented', isMinor: true, publishConsent: true },
};

@Component({
  selector: 'gb-root',
  standalone: true,
  template: `
    <h1>GameBoard.live</h1>

    @if (!gameID()) {
      <section class="new-game" data-testid="new-game">
        <h3>New game</h3>
        <input data-testid="home-name" [value]="homeName" (input)="homeName = asValue($event)" placeholder="Home team" />
        <input data-testid="away-name" [value]="awayName" (input)="awayName = asValue($event)" placeholder="Away team" />
        <button data-testid="create-game" (click)="createGame()">Create game</button>
      </section>
    } @else {

    <section class="scoreboard" [class.big]="bigScreen" data-testid="scoreboard">
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
      <p data-testid="oncourt-home">
        On court (home):
        @for (id of state().onCourt.home; track id) {
          <span class="player">{{ label(id) }}</span>
        }
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

    }
  `,
  imports: [],
})
export class AppComponent {
  private readonly api = inject(ApiService);

  readonly gameID = signal<string>(
    (globalThis as { __GB_GAME__?: string }).__GB_GAME__ ?? '',
  );
  /** Big-screen (TV/projector) layout when ?display=big. */
  readonly bigScreen = new URLSearchParams(globalThis.location?.search ?? '').get('display') === 'big';

  homeName = '';
  awayName = '';

  readonly state = signal<GameState>(emptyState());
  private subSeq = 0;

  constructor() {
    if (this.gameID()) {
      void this.refresh();
    }
  }

  asValue(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  async createGame(): Promise<void> {
    const home = this.homeName.trim() || 'Home';
    const away = this.awayName.trim() || 'Away';
    const rec = await this.api.createGame({ name: home, colour: '#c00' }, { name: away, colour: '#00c' });
    this.gameID.set(rec.gameID);
    await this.refresh();
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

  /** Minor-safe public label for an on-court player id (jersey only for a
   * no-consent minor; falls back to the raw id if not in the roster). */
  label(id: string): string {
    const p = DEMO_ROSTER[id];
    return p ? publicPlayerLabel(p) : id;
  }

  private async refresh(): Promise<void> {
    this.state.set(await this.api.state(this.gameID()));
  }

  private async append(p: Promise<unknown>): Promise<void> {
    await p;
    await this.refresh();
  }

  status(s: 'live' | 'final'): Promise<void> {
    return this.append(this.api.append(this.gameID(), 'status', { status: s }));
  }
  period(n: number): Promise<void> {
    return this.append(this.api.append(this.gameID(), 'period', { period: n }));
  }
  clockStart(): Promise<void> {
    return this.append(this.api.append(this.gameID(), 'clock', { clockAction: 'start', gameClockMs: 600000 }));
  }
  clockStop(): Promise<void> {
    return this.append(this.api.append(this.gameID(), 'clock', { clockAction: 'stop', gameClockMs: 540000 }));
  }
  possession(side: TeamSide): Promise<void> {
    return this.append(this.api.append(this.gameID(), 'possession', { side }));
  }
  timeout(side: TeamSide): Promise<void> {
    return this.append(this.api.append(this.gameID(), 'timeout', { side }));
  }
  score(side: TeamSide, points: number): Promise<void> {
    return this.append(this.api.append(this.gameID(), 'score', { side, points }));
  }
  foul(side: TeamSide): Promise<void> {
    return this.append(this.api.append(this.gameID(), 'team-foul', { side }));
  }
  sub(side: TeamSide): Promise<void> {
    this.subSeq++;
    return this.append(this.api.append(this.gameID(), 'substitution', { side, playerOn: `p${this.subSeq}` }));
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
