import { describe, expect, it } from 'vitest';
import {
  inBonus,
  newEventID,
  publicPlayerLabel,
  sourceFor,
  type GameState,
  type Player,
} from './game-state';

function state(home: number, away: number): GameState {
  return {
    status: 'live',
    period: 1,
    gameClockMs: 0,
    clockRunning: true,
    scores: { home: 0, away: 0 },
    teamFouls: { home, away },
    timeoutsUsed: { home: 0, away: 0 },
    possession: '',
    onCourt: { home: [], away: [] },
    playerPoints: {},
    playerAssists: {},
  };
}

describe('contract helpers', () => {
  it('sourceFor maps event types to the authorized source', () => {
    expect(sourceFor('score')).toBe('scorekeeper');
    expect(sourceFor('team-foul')).toBe('scorekeeper');
    expect(sourceFor('substitution')).toBe('scorekeeper');
    expect(sourceFor('clock')).toBe('timekeeper');
    expect(sourceFor('status')).toBe('timekeeper');
    expect(sourceFor('possession')).toBe('timekeeper');
    expect(sourceFor('correction')).toBe('judge');
    expect(sourceFor('judge-ruling')).toBe('judge');
  });

  it('inBonus flips when the opponent reaches the foul limit', () => {
    expect(inBonus(state(0, 5), 'home', 5)).toBe(true); // away has 5 → home bonus
    expect(inBonus(state(0, 4), 'home', 5)).toBe(false);
    expect(inBonus(state(5, 0), 'away', 5)).toBe(true);
  });

  it('newEventID is a 32-char dashless hex id and unique', () => {
    const a = newEventID();
    const b = newEventID();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });

  it('publicPlayerLabel hides a no-consent minor behind their jersey number', () => {
    const base: Player = {
      id: 'x',
      jersey: '23',
      name: 'Jordan Minor',
      isMinor: true,
      publishConsent: false,
    };
    expect(publicPlayerLabel(base)).toBe('#23'); // minor, no consent → jersey only
    expect(publicPlayerLabel({ ...base, publishConsent: true })).toBe(
      'Jordan Minor',
    ); // minor w/ consent → name
    expect(publicPlayerLabel({ ...base, isMinor: false })).toBe('Jordan Minor'); // adult → name
  });
});
