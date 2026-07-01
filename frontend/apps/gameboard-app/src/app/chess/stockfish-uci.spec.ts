import { describe, expect, it } from 'vitest';
import {
  parseBestMoveLine,
  STOCKFISH_LEVELS,
  uciGoCommand,
  uciPositionCommand,
  uciSetSkillCommand,
} from './stockfish-uci';

describe('stockfish UCI helpers', () => {
  it('builds the setoption/position/go commands from a level', () => {
    const medium = STOCKFISH_LEVELS.find((l) => l.id === 'medium');
    if (!medium) throw new Error('expected a medium level');
    expect(uciSetSkillCommand(medium)).toBe(
      'setoption name Skill Level value 8',
    );
    expect(uciPositionCommand('startpos-fen')).toBe(
      'position fen startpos-fen',
    );
    expect(uciGoCommand(medium)).toBe('go depth 8');
  });

  it('offers 3 distinct strength levels with increasing skill/depth', () => {
    expect(STOCKFISH_LEVELS.length).toBeGreaterThanOrEqual(3);
    const skills = STOCKFISH_LEVELS.map((l) => l.skill);
    expect(skills).toEqual([...skills].sort((a, b) => a - b));
    expect(new Set(skills).size).toBe(STOCKFISH_LEVELS.length);
  });

  it('parses a bestmove line with a ponder move', () => {
    expect(parseBestMoveLine('bestmove e2e4 ponder e7e5')).toEqual({
      from: 'e2',
      to: 'e4',
      promotion: undefined,
    });
  });

  it('parses a bestmove line with promotion', () => {
    expect(parseBestMoveLine('bestmove e7e8q')).toEqual({
      from: 'e7',
      to: 'e8',
      promotion: 'q',
    });
  });

  it('returns null for non-bestmove engine output', () => {
    expect(
      parseBestMoveLine('info depth 4 score cp 20 pv e2e4 e7e5'),
    ).toBeNull();
    expect(parseBestMoveLine('readyok')).toBeNull();
    expect(parseBestMoveLine('uciok')).toBeNull();
  });

  it('returns null for the no-legal-move sentinel', () => {
    expect(parseBestMoveLine('bestmove (none)')).toBeNull();
  });
});
