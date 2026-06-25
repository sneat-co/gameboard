import { inject, Injectable } from '@angular/core';
import { SneatApiService } from '@sneat/api';
import { firstValueFrom } from 'rxjs';
import { GameRecord, Side } from '@sneat/extension-gameboard-contract';

/** Thin typed client over the api4gameboard create-game endpoint. */
@Injectable({ providedIn: 'root' })
export class NewGameService {
  // SneatApiService attaches the signed-in user's Firebase ID token
  // (Authorization: Bearer …) the same way the sneat & lists apps do — the
  // backend requires an authenticated user for writes.
  private readonly api = inject(SneatApiService);

  /**
   * Create a game from two inline sides + an optional scheduled time.
   * Mirrors `POST /v0/api4gameboard/games` (the `/v0/` prefix comes from
   * SneatApiService's base URL). Venue/competition/role are collected in the UI
   * but not yet accepted by the backend (new-game plan tasks 3–4); only
   * home/away/scheduledMs are sent today.
   */
  createGame(home: Side, away: Side, scheduledMs = 0): Promise<GameRecord> {
    return firstValueFrom(
      this.api.post<GameRecord>('api4gameboard/games', { home, away, scheduledMs }),
    );
  }
}
