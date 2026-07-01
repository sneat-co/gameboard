import { describe, expect, it } from 'vitest';
import { RosterPlayer, RsvpResponse } from './game-invite-contract';
import { computeRosterFill, computeRosterFillForDoc } from './roster-fill';

function player(playerId: string, name: string): RosterPlayer {
  return { playerId, name };
}

function response(
  playerId: string,
  status: RsvpResponse['status'],
): RsvpResponse {
  return { playerId, status, respondedBy: 'Parent', respondedAt: 1 };
}

describe('computeRosterFill', () => {
  it('groups every roster player as no-reply when there are no responses yet', () => {
    const roster = [player('p1', 'Ann'), player('p2', 'Bo')];
    const summary = computeRosterFill(roster, {}, 10);
    expect(summary.goingCount).toBe(0);
    expect(summary.noReply).toHaveLength(2);
    expect(summary.going).toHaveLength(0);
    expect(summary.fillLabel).toBe('0 of 10 going, need 10 more');
  });

  it('groups players into going/maybe/out/no-reply per their response', () => {
    const roster = [
      player('p1', 'Ann'),
      player('p2', 'Bo'),
      player('p3', 'Cy'),
      player('p4', 'Di'),
    ];
    const responses = {
      p1: response('p1', 'going'),
      p2: response('p2', 'maybe'),
      p3: response('p3', 'out'),
    };
    const summary = computeRosterFill(roster, responses, 4);
    expect(summary.going.map((r) => r.player.playerId)).toEqual(['p1']);
    expect(summary.maybe.map((r) => r.player.playerId)).toEqual(['p2']);
    expect(summary.out.map((r) => r.player.playerId)).toEqual(['p3']);
    expect(summary.noReply.map((r) => r.player.playerId)).toEqual(['p4']);
  });

  it('reports "need N more" while under the target and never negative', () => {
    const roster = [player('p1', 'Ann'), player('p2', 'Bo')];
    const responses = {
      p1: response('p1', 'going'),
      p2: response('p2', 'going'),
    };
    const summary = computeRosterFill(roster, responses, 5);
    expect(summary.fillLabel).toBe('2 of 5 going, need 3 more');
    expect(summary.isFull).toBe(false);
  });

  it('reports "full" once the going count reaches the target', () => {
    const roster = [player('p1', 'Ann'), player('p2', 'Bo')];
    const responses = {
      p1: response('p1', 'going'),
      p2: response('p2', 'going'),
    };
    const summary = computeRosterFill(roster, responses, 2);
    expect(summary.isFull).toBe(true);
    expect(summary.fillLabel).toBe('2 of 2 going — full');
  });

  it('still reports full correctly when going exceeds the target (over-invite)', () => {
    const roster = [
      player('p1', 'Ann'),
      player('p2', 'Bo'),
      player('p3', 'Cy'),
    ];
    const responses = {
      p1: response('p1', 'going'),
      p2: response('p2', 'going'),
      p3: response('p3', 'going'),
    };
    const summary = computeRosterFill(roster, responses, 2);
    expect(summary.isFull).toBe(true);
    expect(summary.fillLabel).toBe('3 of 2 going — full');
  });

  it('is deterministic — recomputing from the same inputs yields an equal summary', () => {
    const roster = [player('p1', 'Ann'), player('p2', 'Bo')];
    const responses = { p1: response('p1', 'going') };
    expect(computeRosterFill(roster, responses, 3)).toEqual(
      computeRosterFill(roster, responses, 3),
    );
  });

  it('falls back to a needed-less label when no target is set', () => {
    const roster = [player('p1', 'Ann')];
    const summary = computeRosterFill(
      roster,
      { p1: response('p1', 'going') },
      0,
    );
    expect(summary.fillLabel).toBe('1 going');
    expect(summary.isFull).toBe(false);
  });

  it('computeRosterFillForDoc folds straight from a GameInviteDoc', () => {
    const summary = computeRosterFillForDoc({
      gameId: 'g1',
      sport: 'basketball',
      teamName: 'U14 Girls',
      scheduledMs: 0,
      playersNeeded: 1,
      recurring: { enabled: false },
      organizerName: 'Coach',
      roster: [player('p1', 'Ann')],
      responses: { p1: response('p1', 'going') },
      createdAt: 0,
      updatedAt: 0,
    });
    expect(summary.fillLabel).toBe('1 of 1 going — full');
  });
});
