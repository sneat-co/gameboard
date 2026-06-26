/**
 * Unit tests for RecapPageComponent (vitest, no I/O).
 *
 * Stubs GameService.getState with a fixed final GameState containing
 * playerPoints/playerAssists for p1/p2/p3. Asserts:
 *   - Box-score lines render in the right order (pts desc, then label asc).
 *   - Final score is displayed.
 *   - Minor-safe labels: p1 adult→name, p2 no-consent minor→#23 (never "Jordan
 *     Minor"), p3 consented minor→name.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RecapPageComponent } from './recap-page.component';
import { GameService } from '../../game.service';
import type { GameState } from '../game-state';

// ---------------------------------------------------------------------------
// Fixture state: p1=4pts, p2=0pts/2ast, p3=2pts — sorted: p1, p3, p2.
// ---------------------------------------------------------------------------
const FIXTURE_STATE: GameState = {
  status: 'final',
  period: 1,
  gameClockMs: 0,
  clockRunning: false,
  scores: { home: 6, away: 2 },
  teamFouls: { home: 0, away: 0 },
  timeoutsUsed: { home: 0, away: 0 },
  possession: '',
  onCourt: { home: [], away: [] },
  playerPoints: { p1: 4, p3: 2 },
  playerAssists: { p2: 2 },
};

describe('RecapPageComponent', () => {
  let fixture: ComponentFixture<RecapPageComponent>;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecapPageComponent],
      providers: [
        {
          provide: GameService,
          useValue: {
            getState: vi.fn().mockResolvedValue(FIXTURE_STATE),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(
              new Map([['gameID', 'test-game-1']]) as unknown as Parameters<
                typeof of
              >[0],
            ),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecapPageComponent);
    // Allow the effect/promise to run (one tick for the signal + one for the async getState).
    await fixture.whenStable();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
  });

  it('renders the final score from the fold', () => {
    const scoreHome = compiled.querySelector('[data-testid="score-home"]');
    const scoreAway = compiled.querySelector('[data-testid="score-away"]');
    expect(scoreHome?.textContent?.trim()).toBe('6');
    expect(scoreAway?.textContent?.trim()).toBe('2');
  });

  it('renders the game status', () => {
    const status = compiled.querySelector('[data-testid="status"]');
    expect(status?.textContent?.trim()).toBe('final');
  });

  it('renders the recap container with the recap testid', () => {
    const recap = compiled.querySelector('[data-testid="recap"]');
    expect(recap).toBeTruthy();
  });

  it('renders box-score lines with recap-line testid', () => {
    const lines = compiled.querySelectorAll('[data-testid="recap-line"]');
    expect(lines.length).toBe(3); // p1, p3, p2
  });

  it('renders p1 (adult) by name — Alex Adult: 4 pts', () => {
    const lines = compiled.querySelectorAll('[data-testid="recap-line"]');
    const texts = Array.from(lines).map((l) => l.textContent?.trim() ?? '');
    expect(texts[0]).toContain('Alex Adult: 4 pts');
  });

  it('renders p3 (consented minor) by name in second position', () => {
    const lines = compiled.querySelectorAll('[data-testid="recap-line"]');
    const texts = Array.from(lines).map((l) => l.textContent?.trim() ?? '');
    expect(texts[1]).toContain('Sam Consented: 2 pts');
  });

  it('renders p2 (no-consent minor) by jersey — #23: 0 pts, 2 ast', () => {
    const lines = compiled.querySelectorAll('[data-testid="recap-line"]');
    const texts = Array.from(lines).map((l) => l.textContent?.trim() ?? '');
    expect(texts[2]).toContain('#23: 0 pts, 2 ast');
  });

  it('never renders "Jordan Minor" — minor-safe public label', () => {
    expect(compiled.textContent).not.toContain('Jordan Minor');
  });

  it('sorts box score by points desc then label asc', () => {
    const lines = compiled.querySelectorAll('[data-testid="recap-line"]');
    const texts = Array.from(lines).map((l) => l.textContent?.trim() ?? '');
    // p1=4pts first, p3=2pts second, p2=0pts last
    expect(texts[0]).toMatch(/Alex Adult/);
    expect(texts[1]).toMatch(/Sam Consented/);
    expect(texts[2]).toMatch(/#23/);
  });
});
