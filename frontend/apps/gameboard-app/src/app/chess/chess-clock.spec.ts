import { describe, expect, it } from 'vitest';
import { ChessClockEngine, formatClockDisplay, msToClk } from './chess-clock';

describe('ChessClockEngine', () => {
  it('starts idle and begins with white active on start()', () => {
    const clock = new ChessClockEngine({ baseMs: 60_000, incrementMs: 0 });
    expect(clock.snapshot().status).toBe('idle');
    clock.start();
    const s = clock.snapshot();
    expect(s.status).toBe('running');
    expect(s.active).toBe('w');
    expect(s.whiteMs).toBe(60_000);
    expect(s.blackMs).toBe(60_000);
  });

  it('tick() decrements only the active side', () => {
    const clock = new ChessClockEngine({ baseMs: 60_000, incrementMs: 0 });
    clock.start();
    clock.tick(1_000);
    const s = clock.snapshot();
    expect(s.whiteMs).toBe(59_000);
    expect(s.blackMs).toBe(60_000);
  });

  it('switchTurn() applies the increment to the mover then swaps the active side', () => {
    const clock = new ChessClockEngine({ baseMs: 60_000, incrementMs: 2_000 });
    clock.start();
    clock.tick(5_000); // white spends 5s thinking
    clock.switchTurn(); // white moves, gains +2s, black becomes active
    let s = clock.snapshot();
    expect(s.whiteMs).toBe(60_000 - 5_000 + 2_000);
    expect(s.active).toBe('b');

    clock.tick(3_000);
    clock.switchTurn();
    s = clock.snapshot();
    expect(s.blackMs).toBe(60_000 - 3_000 + 2_000);
    expect(s.active).toBe('w');
  });

  it('is a no-op before start() and after pause()', () => {
    const clock = new ChessClockEngine({ baseMs: 60_000, incrementMs: 0 });
    clock.tick(5_000);
    clock.switchTurn();
    expect(clock.snapshot()).toEqual({
      whiteMs: 60_000,
      blackMs: 60_000,
      active: null,
      status: 'idle',
      flaggedSide: null,
    });

    clock.start();
    clock.pause();
    clock.tick(5_000);
    expect(clock.snapshot().whiteMs).toBe(60_000);
    clock.resume();
    clock.tick(1_000);
    expect(clock.snapshot().whiteMs).toBe(59_000);
  });

  it('flags the side whose time reaches zero and stops ticking further', () => {
    const clock = new ChessClockEngine({ baseMs: 3_000, incrementMs: 0 });
    clock.start();
    clock.tick(2_000);
    expect(clock.isFlagged()).toBe(false);
    clock.tick(5_000); // overshoot — clamps at 0, doesn't go negative
    const s = clock.snapshot();
    expect(s.whiteMs).toBe(0);
    expect(s.status).toBe('flagged');
    expect(s.flaggedSide).toBe('w');
    expect(clock.isFlagged()).toBe(true);

    // Flagged clock no longer responds to tick/switchTurn.
    clock.tick(1_000);
    clock.switchTurn();
    expect(clock.snapshot().active).toBe('w');
  });

  it('honours a per-move delay (US/Bronstein) before eating into the main budget', () => {
    const clock = new ChessClockEngine({
      baseMs: 10_000,
      incrementMs: 0,
      delayMs: 2_000,
    });
    clock.start();
    clock.tick(1_500); // fully absorbed by the delay
    expect(clock.snapshot().whiteMs).toBe(10_000);
    clock.tick(1_000); // 500ms left of delay, 500ms eats into the budget
    expect(clock.snapshot().whiteMs).toBe(9_500);
  });

  it('resets the new active side delay allowance on switchTurn()', () => {
    const clock = new ChessClockEngine({
      baseMs: 10_000,
      incrementMs: 0,
      delayMs: 2_000,
    });
    clock.start();
    clock.tick(5_000); // white burns through its delay + 3s of budget
    clock.switchTurn();
    clock.tick(1_500); // black's fresh 2s delay absorbs this fully
    expect(clock.snapshot().blackMs).toBe(10_000);
  });
});

describe('msToClk (PGN %clk annotation format)', () => {
  it('formats whole hours/minutes/seconds as H:MM:SS', () => {
    expect(msToClk(0)).toBe('0:00:00');
    expect(msToClk(59_000)).toBe('0:00:59');
    expect(msToClk(60_000)).toBe('0:01:00');
    expect(msToClk(3_600_000)).toBe('1:00:00');
    expect(msToClk(3_723_000)).toBe('1:02:03');
  });

  it('rounds fractional seconds', () => {
    expect(msToClk(1_499)).toBe('0:00:01');
    expect(msToClk(1_501)).toBe('0:00:02');
  });
});

describe('formatClockDisplay (tap-to-switch button)', () => {
  it('shows M:SS under an hour and H:MM:SS at/above an hour', () => {
    expect(formatClockDisplay(65_000)).toBe('1:05');
    expect(formatClockDisplay(9_000)).toBe('0:09');
    expect(formatClockDisplay(3_600_000)).toBe('1:00:00');
  });

  it('rounds up so the display never shows 0:00 while time remains', () => {
    expect(formatClockDisplay(400)).toBe('0:01');
  });
});
