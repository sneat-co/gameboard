import {
  EnvironmentInjector,
  inject,
  Injectable,
  runInInjectionContext,
} from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  query,
  where,
} from '@angular/fire/firestore';
import { SneatApiService } from '@sneat/api';
import { firstValueFrom, map, Observable } from 'rxjs';
import { GameRecord, Side, UpdateGameSettings } from './new-game/game-contract';
import {
  AppendResponse,
  buildEvent,
  EventType,
  GameEvent,
  GameState,
} from './game/game-state';

/**
 * True when an error is SneatApiService's "no Firebase ID token" guard — the
 * synchronous rejection it raises from post/put/get when there is no signed-in
 * session (it refuses to send the request rather than returning a backend 401).
 *
 * The substring "not authenticated" matches the literal string thrown by
 * `@sneat/api`'s `errorIfNotAuthenticated()`:
 *   "User is not authenticated yet - no Firebase ID token"
 * If that wording ever changes in the library the full-game E2E (follow.spec.ts)
 * will fail loudly, surfacing the mismatch before it reaches production.
 */
function isNotAuthenticatedError(err: unknown): boolean {
  return typeof err === 'string' && err.includes('not authenticated');
}

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
/**
 * A game as read directly from Firestore for the "my games" list. Extends the
 * wire `GameRecord` with the server-stamped `createdBy`/`createdAt` audit fields
 * (present on the stored doc but not on the create/get HTTP contract) so the
 * list can filter by owner and order newest-first.
 */
export interface MyGame extends GameRecord {
  readonly createdBy?: string;
  // Firestore Timestamp on read; we only ever compare it via toMillis().
  readonly createdAt?: { toMillis?: () => number } | number | null;
}

/** Best-effort epoch-ms for a Firestore `createdAt` (Timestamp | number | null). */
function createdAtMs(createdAt: MyGame['createdAt']): number {
  if (!createdAt) return 0;
  if (typeof createdAt === 'number') return createdAt;
  return createdAt.toMillis?.() ?? 0;
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly api = inject(SneatApiService);
  private readonly afs = inject(Firestore);
  private readonly injector = inject(EnvironmentInjector);

  /**
   * Create a game from two inline sides + an optional scheduled time.
   * `POST /v0/api4gameboard/games`. Venue/competition/role are collected in the
   * UI but not yet accepted by the backend; only home/away/scheduledMs are sent.
   * The returned record's `.id` is the gameID for subsequent calls.
   */
  public createGame(
    home: Side,
    away: Side,
    scheduledMs = 0,
  ): Promise<GameRecord> {
    return firstValueFrom(
      this.api.post<GameRecord>('api4gameboard/games', {
        home,
        away,
        scheduledMs,
      }),
    );
  }

  /**
   * Live list of the games a user created, read DIRECTLY from Firestore
   * (`/ext/gameboard/games` where `createdBy == uid`) rather than via the Go
   * backend. The backend exposes no list endpoint and its production store
   * rejects queries (memcache wrapper), so the client queries Firestore itself —
   * the same place the backend writes the records.
   *
   * Only an equality filter is used so no composite index is required; the list
   * is ordered newest-first client-side. `idField: 'gameID'` fills `gameID` from
   * each doc's key.
   */
  public watchMyGames(uid: string): Observable<MyGame[]> {
    // AngularFire's collection()/collectionData() must run inside an Angular
    // injection context. This method is called lazily from a switchMap (on auth
    // emissions), i.e. OUTSIDE the construction-time context, so wrap it in the
    // service's EnvironmentInjector — otherwise AngularFire throws NG0203.
    return runInInjectionContext(this.injector, () => {
      const games = collection(this.afs, 'ext', 'gameboard', 'games');
      const myGames = query(games, where('createdBy', '==', uid));
      return collectionData(myGames, { idField: 'gameID' }).pipe(
        map((records) =>
          (records as MyGame[])
            .slice()
            .sort((a, b) => createdAtMs(b.createdAt) - createdAtMs(a.createdAt)),
        ),
      );
    });
  }

  /**
   * Read a single game record (schedule, location, sides, status).
   * `GET .../games/{id}` — public/no-login, so it uses getAsAnonymous.
   */
  public getGame(gameID: string): Promise<GameRecord> {
    return firstValueFrom(
      this.api.getAsAnonymous<GameRecord>(
        `api4gameboard/games/${encodeURIComponent(gameID)}`,
      ),
    );
  }

  /**
   * Edit a game's schedule and/or location (organizer only).
   * `PUT .../games/{id}` — authenticated; the backend restricts the write to
   * the game's creator and returns 403 otherwise. (SneatApiService has no
   * `patch`, so the partial-update endpoint is exposed as PUT.)
   */
  public updateGameSettings(
    gameID: string,
    settings: UpdateGameSettings,
  ): Promise<GameRecord> {
    return firstValueFrom(
      this.api.put<GameRecord>(
        `api4gameboard/games/${encodeURIComponent(gameID)}`,
        settings,
      ),
    );
  }

  /**
   * Append a fully-built event to a game's append-only log.
   * `POST .../games/{id}/events`. Idempotent on event.eventID.
   *
   * Signed-in users write authenticated (SneatApiService attaches the Firebase
   * token — decision 2). When there is NO session, SneatApiService.post refuses
   * to send the request (it throws "User is not authenticated…" before any
   * network call); in that case we retry with postAsAnonymous so the write still
   * reaches the backend. This is what makes the operator console usable without
   * a real signed-in session: gameboardd's devIdentity authorizes the write
   * (and it lets the real-stack E2E drive the full lifecycle). Production stays
   * authenticated for signed-in operators; only a token-less session falls back.
   *
   * Prefer append() for the typed convenience.
   */
  public async appendEvent(
    gameID: string,
    event: GameEvent,
  ): Promise<AppendResponse> {
    const path = `api4gameboard/games/${encodeURIComponent(gameID)}/events`;
    try {
      return await firstValueFrom(this.api.post<AppendResponse>(path, event));
    } catch (err) {
      if (!isNotAuthenticatedError(err)) {
        throw err;
      }
      return firstValueFrom(
        this.api.postAsAnonymous<AppendResponse>(path, event),
      );
    }
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
