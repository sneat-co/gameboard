import { inject, Injectable } from '@angular/core';
import { SneatApiService } from '@sneat/api';
import { firstValueFrom } from 'rxjs';
import { GameRecord, Side } from './new-game/game-contract';
import {
  AppendResponse,
  buildEvent,
  EventType,
  GameEvent,
  GameState,
} from './game/game-state';

/**
 * GameService is the single client for the gameboard game API. It calls through
 * SneatApiService so every request carries the signed-in user's Firebase ID
 * token (Authorization: Bearer …), the same way the sneat & lists apps do — the
 * backend requires an authenticated user for writes. Read-side operations
 * (scoreboard state/events, public/no-login) use api.getAsAnonymous().
 *
 * Endpoints are passed WITHOUT the `/v0/` prefix; SneatApiService prepends it
 * (the same way createGame does).
 */
@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly api = inject(SneatApiService);

  /**
   * Create a game from two inline sides + an optional scheduled time.
   * `POST /v0/api4gameboard/games`. Venue/competition/role are collected in the
   * UI but not yet accepted by the backend; only home/away/scheduledMs are sent.
   * The returned record's `.id` is the gameID for subsequent calls.
   */
  public createGame(home: Side, away: Side, scheduledMs = 0): Promise<GameRecord> {
    return firstValueFrom(
      this.api.post<GameRecord>('api4gameboard/games', { home, away, scheduledMs }),
    );
  }

  /**
   * Append a fully-built event to a game's append-only log (authenticated;
   * SneatApiService attaches the Firebase token). `POST .../games/{id}/events`.
   * Idempotent on event.eventID. Prefer append() for the typed convenience.
   */
  public appendEvent(gameID: string, event: GameEvent): Promise<AppendResponse> {
    return firstValueFrom(
      this.api.post<AppendResponse>(
        `api4gameboard/games/${encodeURIComponent(gameID)}/events`,
        event,
      ),
    );
  }

  /**
   * Typed convenience: build (via the single buildEvent path) then append an
   * event in one call, e.g. append(gameID, 'score', { side, points }).
   */
  public append(
    gameID: string,
    type: EventType,
    payload: Partial<GameEvent> = {},
  ): Promise<AppendResponse> {
    return this.appendEvent(gameID, buildEvent(type, payload));
  }

  /**
   * Read the deterministic server-folded state (the public scoreboard read).
   * `GET .../games/{id}/state` — public/no-login, so it uses getAsAnonymous.
   */
  public getState(gameID: string): Promise<GameState> {
    return firstValueFrom(
      this.api.getAsAnonymous<GameState>(
        `api4gameboard/games/${encodeURIComponent(gameID)}/state`,
      ),
    );
  }

  /**
   * Follow a game/team/player (authenticated; the Firebase token replaces the
   * legacy X-Account-Id stub — the backend rejects anonymous follows with 401).
   * `POST /v0/api4gameboard/follows`.
   */
  public follow(
    targetType: 'game' | 'team' | 'player',
    targetID: string,
  ): Promise<unknown> {
    return firstValueFrom(
      this.api.post('api4gameboard/follows', { targetType, targetID }),
    );
  }
}
