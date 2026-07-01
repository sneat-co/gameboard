import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { SPORTS } from './game-invite-contract';
import { listGameInvites } from './game-invite-store';
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
 * "My games" for the game-invites feature — `game-invites` — the organized
 * games saved on this device (see game-invite-store.ts). Distinct from the
 * existing auth-guarded `/my/games` (the two-team scoreboard `GameRecord`
 * list read from Firestore); this list is local-storage-backed like the chess
 * games list, so it works with no sign-in, matching the rest of this feature.
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

      @if (games().length === 0) {
        <ion-text color="medium">
          <p data-testid="empty-games">
            No organized games on this device yet. Tap
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
  protected readonly games = signal(
    listGameInvites().map((doc) => ({
      doc,
      emoji: SPORTS.find((s) => s.id === doc.sport)?.emoji ?? '🎮',
      fillLabel: computeRosterFillForDoc(doc).fillLabel,
    })),
  );

  protected formatSchedule(ms: number): string {
    return formatSchedule(ms);
  }
}
