// HTTP-backed client for the game-invites backend (gameboard/backend/gameboard
// game_invite.go + game_invite_service.go, served at /v0/api4gameboard/
// game-invites/*, already mounted through the wildcard route sneat-go's
// gameboard module registers — see backstage/docs/roadmaps/
// gameboard-game-invites.md §8.2 Phase 1).
//
// This REPLACES localStorage as this feature's persistence: the same-shaped
// prototype functions in game-invite-store.ts (createGameInvite,
// getGameInvite, listGameInvites, addRosterPlayer, setRsvp) are kept
// UNCHANGED in that file (never delete code) but are no longer imported by
// the organize/roster/rsvp/my-games pages — this service is. Mirrors
// GameService (../game.service.ts) for the sibling two-team scoreboard game:
// SneatApiService carries the signed-in user's Firebase ID token for writes
// that require one; public reads use getAsAnonymous.
import { inject, Injectable } from '@angular/core';
import { SneatApiService } from '@sneat/api';
import { firstValueFrom } from 'rxjs';
import { GameInviteDoc, RsvpStatus } from './game-invite-contract';
import { CreateGameInviteInput } from './game-invite-store';

/**
 * True when an error is SneatApiService's synchronous "no Firebase ID token"
 * guard, thrown before any network call. Same substring match GameService
 * uses (game.service.ts isNotAuthenticatedError) for the same reason: it's
 * the literal string `@sneat/api`'s errorIfNotAuthenticated() throws.
 */
function isNotAuthenticatedError(err: unknown): boolean {
  return typeof err === 'string' && err.includes('not authenticated');
}

/** Body of POST .../game-invites and .../game-invites/{id}/roster — a roster
 * player before a playerId is assigned. */
interface RosterPlayerBody {
  readonly name: string;
  readonly jersey?: string;
  readonly guardianName?: string;
}

/** Body of POST .../game-invites/by-token/{token}/rsvp. */
interface SubmitRsvpBody {
  readonly playerId: string;
  readonly status: RsvpStatus;
  readonly respondedBy: string;
  readonly note?: string;
}

/** Response of GET .../game-invites/by-token/{token} — the game (full public
 * read) plus which roster player, if any, the link specifically targets. */
export interface GameInviteByTokenResponse {
  readonly game: GameInviteDoc;
  readonly targetPlayerId?: string;
}

@Injectable({ providedIn: 'root' })
export class GameInviteService {
  private readonly api = inject(SneatApiService);

  /**
   * Organize a new game/practice for the caller's own team.
   * `POST /v0/api4gameboard/game-invites` — AUTHENTICATED (the backend stamps
   * organizerUID from the bearer token; an anonymous caller gets 401, so the
   * organize-game page must gate this call on sign-in — see
   * organize-game-page.component.ts's isSignedIn()/signIn(), mirroring
   * new-game-page's anon-first-then-gated-create pattern).
   */
  public createGameInvite(input: CreateGameInviteInput): Promise<GameInviteDoc> {
    return firstValueFrom(
      this.api.post<GameInviteDoc>('api4gameboard/game-invites', {
        sport: input.sport,
        teamName: input.teamName,
        opponentName: input.opponentName,
        scheduledMs: input.scheduledMs,
        venue: input.venue,
        playersNeeded: input.playersNeeded,
        recurring: input.recurring,
        organizerName: input.organizerName,
        roster: input.roster,
      }),
    );
  }

  /**
   * Read a game invite by id (the organizer/roster console read).
   * `GET .../game-invites/{id}` — PUBLIC/no-login (account-gate: "reads are
   * free"), so it uses getAsAnonymous.
   */
  public getGameInvite(gameId: string): Promise<GameInviteDoc> {
    return firstValueFrom(
      this.api.getAsAnonymous<GameInviteDoc>(
        `api4gameboard/game-invites/${encodeURIComponent(gameId)}`,
      ),
    );
  }

  /**
   * Add one player to an existing game invite's roster.
   * `POST .../game-invites/{id}/roster` — PUBLIC/anon-friendly by design: both
   * the roster console's "add a player" and the RSVP page's "not on the
   * list? add my kid" call this with no sign-in (mirrors the backend's
   * addRosterPlayer handler doc comment).
   */
  public addRosterPlayer(
    gameId: string,
    player: RosterPlayerBody,
  ): Promise<GameInviteDoc> {
    return firstValueFrom(
      this.api.postAsAnonymous<GameInviteDoc>(
        `api4gameboard/game-invites/${encodeURIComponent(gameId)}/roster`,
        player,
      ),
    );
  }

  /**
   * Resolve an invite-link token to the game it points at (+ which roster
   * player, if any, it targets). `GET .../game-invites/by-token/{token}` —
   * PUBLIC/anonymous, the RSVP page's entry read.
   */
  public getGameInviteByToken(
    token: string,
  ): Promise<GameInviteByTokenResponse> {
    return firstValueFrom(
      this.api.getAsAnonymous<GameInviteByTokenResponse>(
        `api4gameboard/game-invites/by-token/${encodeURIComponent(token)}`,
      ),
    );
  }

  /**
   * Submit a parent-proxy RSVP against a link token: `respondedBy` (the
   * PARENT, the actor) is always distinct from `playerId` (the CONTACT, the
   * kid the response is about) — see parent-proxy.ts.
   *
   * `POST .../game-invites/by-token/{token}/rsvp` — ANONYMOUS-FRIENDLY: works
   * with no session (the whole point of the anon-first RSVP page). If the
   * responder IS signed in, the request is sent authenticated first so the
   * backend can enrich the participant index (their "my games" list picks
   * this game up); an absent/expired session falls back to an anonymous post
   * — same try/fallback shape as GameService.appendEvent.
   */
  public async submitRsvpByToken(
    token: string,
    body: SubmitRsvpBody,
  ): Promise<GameInviteDoc> {
    const path = `api4gameboard/game-invites/by-token/${encodeURIComponent(token)}/rsvp`;
    try {
      return await firstValueFrom(this.api.post<GameInviteDoc>(path, body));
    } catch (err) {
      if (!isNotAuthenticatedError(err)) {
        throw err;
      }
      return firstValueFrom(
        this.api.postAsAnonymous<GameInviteDoc>(path, body),
      );
    }
  }

  /**
   * List the games the caller organizes + has RSVP'd to while signed in.
   * `GET /v0/api4gameboard/game-invites` — AUTHENTICATED (an anonymous
   * visitor has no stable identity to list "my games" against); callers
   * should gate this on isSignedIn() rather than let it throw
   * "not authenticated" (see game-invites-list-page.component.ts).
   */
  public listMyGameInvites(): Promise<GameInviteDoc[]> {
    return firstValueFrom(
      this.api.get<GameInviteDoc[]>('api4gameboard/game-invites'),
    );
  }
}
