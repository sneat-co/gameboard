import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GameRecord, Side } from './game-contract';

/** Base URL of the gameboard backend (empty = same origin). */
export const GAMEBOARD_API_BASE = new InjectionToken<string>('GAMEBOARD_API_BASE');

/** Thin typed client over the api4gameboard create-game endpoint. */
@Injectable({ providedIn: 'root' })
export class NewGameService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(GAMEBOARD_API_BASE, { optional: true }) ?? '';

  /**
   * Create a game from two inline sides + an optional scheduled time.
   * Mirrors `POST /v0/api4gameboard/games`. Venue/competition/role are
   * collected in the UI but not yet accepted by the backend (new-game plan
   * tasks 3–4); only home/away/scheduledMs are sent today.
   */
  createGame(home: Side, away: Side, scheduledMs = 0): Promise<GameRecord> {
    return firstValueFrom(
      this.http.post<GameRecord>(`${this.base}/v0/api4gameboard/games`, {
        home,
        away,
        scheduledMs,
      }),
    );
  }
}
