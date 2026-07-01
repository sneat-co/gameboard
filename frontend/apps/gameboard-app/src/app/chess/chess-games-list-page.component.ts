// Games list — `/chess/games` (MVP scope item 6: "A games list page showing
// saved games (with result + PGN view) is part of MVP"). Reads from the same
// localStorage-backed store the play page writes to
// (chess-game-store.ts — see its header comment for the Firestore swap seam).
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
import { listChessGames, type ChessGameDoc } from './chess-game-store';

function statusLabel(g: ChessGameDoc): string {
  if (g.status === 'in-progress') return 'In progress';
  if (g.result === '1/2-1/2') return 'Draw';
  if (g.result === '1-0') return `${g.players.white} won`;
  if (g.result === '0-1') return `${g.players.black} won`;
  return 'Finished';
}

@Component({
  selector: 'gameboard-chess-games-list-page',
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
        <ion-title>Chess games</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-button expand="block" routerLink="/chess" data-testid="new-game">
        New game
      </ion-button>

      @if (games().length === 0) {
        <ion-text color="medium">
          <p data-testid="empty-games">
            No saved chess games yet — start a pass-and-play, vs-computer, or
            OTB game to see it here.
          </p>
        </ion-text>
      } @else {
        <ion-list data-testid="games-list">
          @for (g of games(); track g.gameId) {
            <ion-item
              button
              [routerLink]="['/chess/play', g.gameId]"
              data-testid="game-row"
            >
              <ion-label>
                <h2>{{ g.players.white }} vs {{ g.players.black }}</h2>
                <ion-note>
                  {{ g.mode }} · {{ g.timeControlLabel }} ·
                  {{ statusLabel(g) }}
                </ion-note>
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
export class ChessGamesListPageComponent {
  protected readonly games = signal<ChessGameDoc[]>(listChessGames());

  protected statusLabel(g: ChessGameDoc): string {
    return statusLabel(g);
  }
}
