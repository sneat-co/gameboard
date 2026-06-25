import { inject, Injectable } from '@angular/core';
import { SneatApiService } from '@sneat/api';
import { firstValueFrom } from 'rxjs';
import { GameRecord, Side } from './new-game/game-contract';

/**
 * GameService is the single client for the gameboard game API. It calls through
 * SneatApiService so every request carries the signed-in user's Firebase ID
 * token (Authorization: Bearer …), the same way the sneat & lists apps do — the
 * backend requires an authenticated user for writes. Read-side operations
 * (scoreboard state/events, public/no-login) should use api.getAsAnonymous().
 */
@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly api = inject(SneatApiService);

  /**
   * Create a game from two inline sides + an optional scheduled time.
   * `POST /v0/api4gameboard/games` (the `/v0/` prefix comes from SneatApiService's
   * base URL). Venue/competition/role are collected in the UI but not yet
   * accepted by the backend; only home/away/scheduledMs are sent today.
   */
  createGame(home: Side, away: Side, scheduledMs = 0): Promise<GameRecord> {
    return firstValueFrom(
      this.api.post<GameRecord>('api4gameboard/games', { home, away, scheduledMs }),
    );
  }
}
