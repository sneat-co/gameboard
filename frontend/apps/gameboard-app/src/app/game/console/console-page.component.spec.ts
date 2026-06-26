import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { GameService } from '../../game.service';
import type { GameState } from '../game-state';
import { ConsolePageComponent } from './console-page.component';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GAME_ID = 'test-game-1';

function makeState(overrides: Partial<GameState> = {}): GameState {
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
    ...overrides,
  };
}

interface Stubs {
  append: ReturnType<typeof vi.fn>;
  getState: ReturnType<typeof vi.fn>;
}

function configure(state: GameState = makeState()): Stubs {
  const append = vi
    .fn()
    .mockResolvedValue({ eventID: 'e1', applied: true, status: 'ok' });
  const getState = vi.fn().mockResolvedValue(state);

  TestBed.configureTestingModule({
    imports: [ConsolePageComponent],
    providers: [
      { provide: GameService, useValue: { append, getState } },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ gameID: GAME_ID })),
          queryParamMap: of(convertToParamMap({})),
        },
      },
    ],
  });

  return { append, getState };
}

async function render(): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(ConsolePageComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

async function click(host: HTMLElement, testid: string): Promise<void> {
  const el = host.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  expect(el, `control [data-testid="${testid}"] must exist`).toBeTruthy();
  el?.click();
  // Let the async dispatch (append → getState) settle.
  await Promise.resolve();
  await Promise.resolve();
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

describe('ConsolePageComponent', () => {
  it('renders the embedded scoreboard view and both control groups', async () => {
    configure();
    const host = await render();
    expect(host.querySelector('[data-testid="scoreboard"]')).toBeTruthy();
    // A few representative controls from each group.
    expect(host.querySelector('[data-testid="go-live"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="home-2"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="home-2-by-p1"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="final"]')).toBeTruthy();
  });

  it('reads the folded state on load (initial getState)', async () => {
    const { getState } = configure();
    await render();
    expect(getState).toHaveBeenCalledWith(GAME_ID);
  });

  it('go-live appends ("status", {status:"live"}) then re-reads state', async () => {
    const { append, getState } = configure();
    const host = await render();
    const callsBefore = getState.mock.calls.length;
    await click(host, 'go-live');
    expect(append).toHaveBeenCalledWith(GAME_ID, 'status', { status: 'live' });
    // State re-read after the append (decision 8).
    expect(getState.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('home-2 appends ("score", {side:"home", points:2})', async () => {
    const { append } = configure();
    const host = await render();
    await click(host, 'home-2');
    expect(append).toHaveBeenCalledWith(GAME_ID, 'score', {
      side: 'home',
      points: 2,
    });
  });

  it('home-3 / home-ft / away-2 append the right points', async () => {
    const { append } = configure();
    const host = await render();
    await click(host, 'home-3');
    await click(host, 'home-ft');
    await click(host, 'away-2');
    expect(append).toHaveBeenCalledWith(GAME_ID, 'score', {
      side: 'home',
      points: 3,
    });
    expect(append).toHaveBeenCalledWith(GAME_ID, 'score', {
      side: 'home',
      points: 1,
    });
    expect(append).toHaveBeenCalledWith(GAME_ID, 'score', {
      side: 'away',
      points: 2,
    });
  });

  it('home-2-by-p1 appends an attributed score with scorer + assist', async () => {
    const { append } = configure();
    const host = await render();
    await click(host, 'home-2-by-p1');
    expect(append).toHaveBeenCalledWith(GAME_ID, 'score', {
      side: 'home',
      points: 2,
      scorerID: 'p1',
      assistID: 'p2',
    });
  });

  it('period-1 / clock-start / clock-stop append the legacy clock values', async () => {
    const { append } = configure();
    const host = await render();
    await click(host, 'period-1');
    await click(host, 'clock-start');
    await click(host, 'clock-stop');
    expect(append).toHaveBeenCalledWith(GAME_ID, 'period', { period: 1 });
    expect(append).toHaveBeenCalledWith(GAME_ID, 'clock', {
      clockAction: 'start',
      gameClockMs: 600000,
    });
    expect(append).toHaveBeenCalledWith(GAME_ID, 'clock', {
      clockAction: 'stop',
      gameClockMs: 540000,
    });
  });

  it('away-foul / timeout-home / possession-away append the right side', async () => {
    const { append } = configure();
    const host = await render();
    await click(host, 'away-foul');
    await click(host, 'timeout-home');
    await click(host, 'possession-away');
    expect(append).toHaveBeenCalledWith(GAME_ID, 'team-foul', { side: 'away' });
    expect(append).toHaveBeenCalledWith(GAME_ID, 'timeout', { side: 'home' });
    expect(append).toHaveBeenCalledWith(GAME_ID, 'possession', {
      side: 'away',
    });
  });

  it('sub-home appends a sequential playerOn (p1, p2, p3, …)', async () => {
    const { append } = configure();
    const host = await render();
    await click(host, 'sub-home');
    await click(host, 'sub-home');
    await click(host, 'sub-home');
    expect(append).toHaveBeenNthCalledWith(1, GAME_ID, 'substitution', {
      side: 'home',
      playerOn: 'p1',
    });
    expect(append).toHaveBeenNthCalledWith(2, GAME_ID, 'substitution', {
      side: 'home',
      playerOn: 'p2',
    });
    expect(append).toHaveBeenNthCalledWith(3, GAME_ID, 'substitution', {
      side: 'home',
      playerOn: 'p3',
    });
  });

  it('final appends ("status", {status:"final"})', async () => {
    const { append } = configure();
    const host = await render();
    await click(host, 'final');
    expect(append).toHaveBeenCalledWith(GAME_ID, 'status', { status: 'final' });
  });
});
