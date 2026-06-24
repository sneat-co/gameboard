import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppendResponse, GameEvent, GameState, newEventID, sourceFor, type EventType } from './contract';

/** Base URL of the gameboard backend (empty = same origin). */
export const API_BASE = new InjectionToken<string>('API_BASE');

/** Thin typed client over the api4gameboard HTTP surface. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE, { optional: true }) ?? '';

  private url(gameID: string, suffix: string): string {
    return `${this.base}/v0/api4gameboard/games/${encodeURIComponent(gameID)}/${suffix}`;
  }

  /** Append an event; fills eventID (idempotency key), source and wall clock. */
  append(gameID: string, type: EventType, payload: Partial<GameEvent> = {}): Promise<AppendResponse> {
    const event: GameEvent = {
      eventID: payload.eventID ?? newEventID(),
      type,
      source: payload.source ?? sourceFor(type),
      wallClockMs: payload.wallClockMs ?? Date.now(),
      period: payload.period ?? 0,
      gameClockMs: payload.gameClockMs ?? 0,
      ...payload,
    };
    return firstValueFrom(this.http.post<AppendResponse>(this.url(gameID, 'events'), event));
  }

  state(gameID: string): Promise<GameState> {
    return firstValueFrom(this.http.get<GameState>(this.url(gameID, 'state')));
  }

  events(gameID: string): Promise<GameEvent[]> {
    return firstValueFrom(this.http.get<GameEvent[]>(this.url(gameID, 'events')));
  }
}
