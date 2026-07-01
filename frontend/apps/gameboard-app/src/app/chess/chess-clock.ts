// The chess clock — first-class per the gameboard-chess roadmap: this is what
// makes GameBoard.live a genuine over-the-board (OTB) companion, not just a
// board. Pure, timer-free engine: the caller (a component's own rAF/interval
// loop) drives it forward with `tick(deltaMs)`. No `Date.now()`, no globals,
// no side effects — fully deterministic and unit-testable without fake timers.

export type ChessColor = 'w' | 'b';

/** Base time + Fischer increment (+ optional US/Bronstein-style delay). */
export interface ChessTimeControl {
  /** Starting time per side, in milliseconds. */
  baseMs: number;
  /** Added to the side that just moved, in milliseconds (Fischer increment). */
  incrementMs: number;
  /** Grace period per move before the clock actually counts down (US delay).
   * 0/undefined = off. Not added on top of the base time like increment is —
   * it's just "free" time consumed first each turn. */
  delayMs?: number;
}

export interface TimeControlPreset {
  readonly id: string;
  readonly label: string;
  readonly control: ChessTimeControl;
}

/** The time-control presets offered on the new-game screen (MVP scope item 3). */
export const TIME_CONTROL_PRESETS: readonly TimeControlPreset[] = [
  {
    id: 'blitz-3-2',
    label: '3+2 Blitz',
    control: { baseMs: 3 * 60_000, incrementMs: 2_000 },
  },
  {
    id: 'blitz-5-0',
    label: '5+0 Blitz',
    control: { baseMs: 5 * 60_000, incrementMs: 0 },
  },
  {
    id: 'rapid-10-5',
    label: '10+5 Rapid',
    control: { baseMs: 10 * 60_000, incrementMs: 5_000 },
  },
  {
    id: 'rapid-15-10',
    label: '15+10 Rapid',
    control: { baseMs: 15 * 60_000, incrementMs: 10_000 },
  },
];

export type ClockStatus = 'idle' | 'running' | 'paused' | 'flagged';

export interface ChessClockSnapshot {
  readonly whiteMs: number;
  readonly blackMs: number;
  readonly active: ChessColor | null;
  readonly status: ClockStatus;
  readonly flaggedSide: ChessColor | null;
}

/** Format milliseconds as the PGN `%clk` annotation value: `H:MM:SS`. */
export function msToClk(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Format milliseconds for the big tap-to-switch clock button: `M:SS`, or
 * `H:MM:SS` once an hour or more remains. */
export function formatClockDisplay(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * A two-sided chess clock. `start()` begins the game with white to move;
 * `switchTurn()` is called when a move completes (applies increment to the
 * mover, hands the clock to the other side, resets that side's delay
 * allowance); `tick(deltaMs)` advances the active side's remaining time and
 * detects flag-fall (time reaches 0 → `status` becomes `'flagged'`).
 */
export class ChessClockEngine {
  private whiteMs: number;
  private blackMs: number;
  private whiteDelayMs: number;
  private blackDelayMs: number;
  private active: ChessColor | null = null;
  private status: ClockStatus = 'idle';
  private flaggedSide: ChessColor | null = null;

  constructor(private readonly control: ChessTimeControl) {
    this.whiteMs = control.baseMs;
    this.blackMs = control.baseMs;
    this.whiteDelayMs = control.delayMs ?? 0;
    this.blackDelayMs = control.delayMs ?? 0;
  }

  public snapshot(): ChessClockSnapshot {
    return {
      whiteMs: this.whiteMs,
      blackMs: this.blackMs,
      active: this.active,
      status: this.status,
      flaggedSide: this.flaggedSide,
    };
  }

  /** Start the clock, `firstToMove` (white by default) becomes active. Only
   * valid from `'idle'` — a no-op otherwise (guards against double-start). */
  public start(firstToMove: ChessColor = 'w'): void {
    if (this.status !== 'idle') return;
    this.active = firstToMove;
    this.status = 'running';
  }

  /** Advance the running side's clock by `deltaMs` of elapsed wall-clock time.
   * A no-op unless `status === 'running'`. Consumes any remaining per-move
   * delay allowance before touching the main time budget. */
  public tick(deltaMs: number): void {
    if (this.status !== 'running' || !this.active || deltaMs <= 0) return;
    let remaining = deltaMs;
    if (this.active === 'w') {
      if (this.whiteDelayMs > 0) {
        const consumed = Math.min(this.whiteDelayMs, remaining);
        this.whiteDelayMs -= consumed;
        remaining -= consumed;
      }
      if (remaining > 0) {
        this.whiteMs = Math.max(0, this.whiteMs - remaining);
        if (this.whiteMs === 0) this.flag('w');
      }
    } else {
      if (this.blackDelayMs > 0) {
        const consumed = Math.min(this.blackDelayMs, remaining);
        this.blackDelayMs -= consumed;
        remaining -= consumed;
      }
      if (remaining > 0) {
        this.blackMs = Math.max(0, this.blackMs - remaining);
        if (this.blackMs === 0) this.flag('b');
      }
    }
  }

  /** The active side just completed a move: apply the increment to them, then
   * hand the clock to the other side (resetting their delay allowance). A
   * no-op unless the clock is running. */
  public switchTurn(): void {
    if (this.status !== 'running' || !this.active) return;
    if (this.active === 'w') {
      this.whiteMs += this.control.incrementMs;
      this.active = 'b';
      this.blackDelayMs = this.control.delayMs ?? 0;
    } else {
      this.blackMs += this.control.incrementMs;
      this.active = 'w';
      this.whiteDelayMs = this.control.delayMs ?? 0;
    }
  }

  public pause(): void {
    if (this.status === 'running') this.status = 'paused';
  }

  public resume(): void {
    if (this.status === 'paused') this.status = 'running';
  }

  public isFlagged(): boolean {
    return this.status === 'flagged';
  }

  private flag(side: ChessColor): void {
    this.flaggedSide = side;
    this.status = 'flagged';
  }
}
