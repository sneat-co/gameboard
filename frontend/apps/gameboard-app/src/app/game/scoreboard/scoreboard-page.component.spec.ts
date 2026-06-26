import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { GameService } from '../../game.service';
import type { GameState } from '../game-state';
import { ScoreboardPageComponent } from './scoreboard-page.component';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    status: 'live',
    period: 1,
    gameClockMs: 540000, // 9:00
    clockRunning: true,
    scores: { home: 6, away: 2 },
    teamFouls: { home: 1, away: 5 }, // away has 5 → home bonus
    timeoutsUsed: { home: 0, away: 0 },
    possession: 'away',
    onCourt: { home: ['p1', 'p2'], away: [] },
    playerPoints: {},
    playerAssists: {},
    ...overrides,
  };
}

/** Configure TestBed for ScoreboardPageComponent with the given state and
 *  optional query params. The gameID param is always 'test-game-1'. */
function configure(
  state: GameState,
  queryParams: Record<string, string> = {},
): void {
  const mockGameService = {
    getState: () => Promise.resolve(state),
  };

  TestBed.configureTestingModule({
    imports: [ScoreboardPageComponent],
    providers: [
      { provide: GameService, useValue: mockGameService },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ gameID: 'test-game-1' })),
          queryParamMap: of(convertToParamMap(queryParams)),
        },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

describe('ScoreboardPageComponent', () => {
  describe('score and clock display', () => {
    beforeEach(() => configure(makeState()));

    it('renders the home and away scores', async () => {
      const fixture = TestBed.createComponent(ScoreboardPageComponent);
      fixture.detectChanges();
      // Allow the async getState() promise to resolve.
      await fixture.whenStable();
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(
        host.querySelector('[data-testid="score-home"]')?.textContent?.trim(),
      ).toBe('6');
      expect(
        host.querySelector('[data-testid="score-away"]')?.textContent?.trim(),
      ).toBe('2');
    });

    it('renders status and period', async () => {
      const fixture = TestBed.createComponent(ScoreboardPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(
        host.querySelector('[data-testid="status"]')?.textContent?.trim(),
      ).toBe('live');
      expect(
        host.querySelector('[data-testid="period"]')?.textContent?.trim(),
      ).toBe('1');
    });

    it('formats the game clock as m:ss', async () => {
      const fixture = TestBed.createComponent(ScoreboardPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      // 540 000 ms → 9:00
      expect(
        host.querySelector('[data-testid="clock"]')?.textContent?.trim(),
      ).toBe('9:00');
    });

    it('shows ▶ when clock is running', async () => {
      const fixture = TestBed.createComponent(ScoreboardPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(
        host
          .querySelector('[data-testid="clock-running"]')
          ?.textContent?.trim(),
      ).toBe('▶');
    });

    it('shows ⏸ when clock is stopped', async () => {
      configure(makeState({ clockRunning: false }));
      const fixture = TestBed.createComponent(ScoreboardPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(
        host
          .querySelector('[data-testid="clock-running"]')
          ?.textContent?.trim(),
      ).toBe('⏸');
    });
  });

  describe('bonus flip', () => {
    it('shows home-bonus when away fouls reach 5', async () => {
      configure(makeState({ teamFouls: { home: 0, away: 5 } }));
      const fixture = TestBed.createComponent(ScoreboardPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('[data-testid="home-bonus"]')).toBeTruthy();
    });

    it('hides home-bonus when away fouls are below 5', async () => {
      configure(makeState({ teamFouls: { home: 0, away: 4 } }));
      const fixture = TestBed.createComponent(ScoreboardPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('[data-testid="home-bonus"]')).toBeFalsy();
    });
  });

  describe('possession', () => {
    it('shows the possession side', async () => {
      configure(makeState({ possession: 'away' }));
      const fixture = TestBed.createComponent(ScoreboardPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(
        host.querySelector('[data-testid="possession"]')?.textContent?.trim(),
      ).toBe('away');
    });

    it('shows — when possession is empty', async () => {
      configure(makeState({ possession: '' }));
      const fixture = TestBed.createComponent(ScoreboardPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(
        host.querySelector('[data-testid="possession"]')?.textContent?.trim(),
      ).toBe('—');
    });
  });

  describe('minor-safe on-court labels', () => {
    it('shows jersey number only for a no-consent minor (p2)', async () => {
      configure(makeState({ onCourt: { home: ['p2'], away: [] } }));
      const fixture = TestBed.createComponent(ScoreboardPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const onCourt = host.querySelector('[data-testid="oncourt-home"]');
      expect(onCourt?.textContent).toContain('#23');
      expect(onCourt?.textContent).not.toContain('Jordan Minor');
    });

    it('shows the name for an adult (p1)', async () => {
      configure(makeState({ onCourt: { home: ['p1'], away: [] } }));
      const fixture = TestBed.createComponent(ScoreboardPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const onCourt = host.querySelector('[data-testid="oncourt-home"]');
      expect(onCourt?.textContent).toContain('Alex Adult');
    });

    it('shows the name for a consented minor (p3)', async () => {
      configure(makeState({ onCourt: { home: ['p3'], away: [] } }));
      const fixture = TestBed.createComponent(ScoreboardPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const onCourt = host.querySelector('[data-testid="oncourt-home"]');
      expect(onCourt?.textContent).toContain('Sam Consented');
    });

    it('shows both adult name and minor jersey when both are on court', async () => {
      configure(makeState({ onCourt: { home: ['p1', 'p2'], away: [] } }));
      const fixture = TestBed.createComponent(ScoreboardPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const onCourt = host.querySelector('[data-testid="oncourt-home"]');
      expect(onCourt?.textContent).toContain('Alex Adult');
      expect(onCourt?.textContent).toContain('#23');
      expect(onCourt?.textContent).not.toContain('Jordan Minor');
    });
  });

  describe('big-screen layout', () => {
    it('adds .big class to scoreboard when display=big', async () => {
      configure(makeState(), { display: 'big' });
      const fixture = TestBed.createComponent(ScoreboardPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const board = host.querySelector('[data-testid="scoreboard"]');
      expect(board?.classList.contains('big')).toBe(true);
    });

    it('does not add .big class when display param is absent', async () => {
      configure(makeState());
      const fixture = TestBed.createComponent(ScoreboardPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      const board = host.querySelector('[data-testid="scoreboard"]');
      expect(board?.classList.contains('big')).toBe(false);
    });
  });
});
