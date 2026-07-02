import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonNote,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { SneatAuthStateService } from '@sneat/auth-core';
import { GameInviteDoc, SPORTS } from './game-invite-contract';
import { GameInviteService } from './game-invite.service';
import { computeRosterFillForDoc } from './roster-fill';

/** Format an epoch-ms as a short local date/time, or '' when unset. */
function formatSchedule(ms: number): string {
  if (!ms) return 'Date TBD';
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * "My games" for the game-invites feature — `game-invites` — the games the
 * signed-in user organizes or has RSVP'd to (GameInviteService.
 * listMyGameInvites → GET /v0/api4gameboard/game-invites, AUTHENTICATED per
 * game_invite.go's listMyGameInvites handler). Distinct from the existing
 * auth-guarded `/my/games` (the two-team scoreboard `GameRecord` list read
 * from Firestore directly).
 *
 * Unlike the organize/roster/RSVP pages, this list has NO anon-first path —
 * "my games" needs a stable identity to list against, so a signed-out
 * visitor sees a sign-in prompt instead of an empty list (the necessary
 * consequence of swapping the per-device localStorage list for a real
 * per-account backend list).
 */
@Component({
  selector: 'gameboard-game-invites-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonContent,
    IonButton,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonSpinner,
    IonText,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>My rosters</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-button
        expand="block"
        routerLink="/game-invites/new"
        data-testid="new-game"
      >
        🏀 Organize a game
      </ion-button>

      @if (!isSignedIn()) {
        <ion-text color="medium">
          <p data-testid="signin-required">
            Sign in to see the games you organize or have RSVP'd to.
          </p>
        </ion-text>
        <ion-button
          expand="block"
          fill="outline"
          (click)="signIn()"
          data-testid="signin"
        >
          Sign in
        </ion-button>
      } @else if (loading()) {
        <ion-spinner name="dots" data-testid="loading" />
      } @else if (games().length === 0) {
        <ion-text color="medium">
          <p data-testid="empty-games">
            No organized games yet. Tap
            <strong>Organize a game</strong> to invite your roster.
          </p>
        </ion-text>
      } @else {
        <ion-list data-testid="games-list">
          @for (game of games(); track game.doc.gameId) {
            <ion-item
              button
              [routerLink]="['/game-invites', game.doc.gameId]"
              data-testid="game-row"
            >
              <ion-label>
                <h2>
                  {{ game.emoji }} {{ game.doc.teamName
                  }}{{
                    game.doc.opponentName ? ' vs ' + game.doc.opponentName : ''
                  }}
                </h2>
                <ion-note
                  >{{ formatSchedule(game.doc.scheduledMs) }} ·
                  {{ game.fillLabel }}</ion-note
                >
              </ion-label>
            </ion-item>
          }
        </ion-list>
      }
    </ion-content>
  `,
  styles: `
    ion-note {
      display: block;
    }
  `,
})
export class GameInvitesListPageComponent {
  private readonly router = inject(Router);
  private readonly authStateService = inject(SneatAuthStateService);
  private readonly gameInviteService = inject(GameInviteService);

  protected readonly isSignedIn = toSignal(
    this.authStateService.authStatus.pipe(map((s) => s === 'authenticated')),
    { initialValue: false },
  );

  protected readonly loading = signal(true);
  protected readonly games = signal<
    { doc: GameInviteDoc; emoji: string; fillLabel: string }[]
  >([]);

  constructor() {
    effect(() => {
      if (!this.isSignedIn()) {
        this.games.set([]);
        this.loading.set(false);
        return;
      }
      this.loading.set(true);
      this.gameInviteService.listMyGameInvites().then(
        (docs) => {
          this.games.set(
            docs.map((doc) => ({
              doc,
              emoji: SPORTS.find((s) => s.id === doc.sport)?.emoji ?? '🎮',
              fillLabel: computeRosterFillForDoc(doc).fillLabel,
            })),
          );
          this.loading.set(false);
        },
        () => {
          this.games.set([]);
          this.loading.set(false);
        },
      );
    });
  }

  protected signIn(): void {
    void this.router.navigate(['/login'], {
      fragment: '/game-invites',
      queryParams: { reason: 'Sign in to see your organized games.' },
    });
  }

  protected formatSchedule(ms: number): string {
    return formatSchedule(ms);
  }
}
