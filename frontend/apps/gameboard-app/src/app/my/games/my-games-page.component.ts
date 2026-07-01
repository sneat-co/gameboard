import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { distinctUntilChanged, map, of, switchMap } from 'rxjs';
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
import { GameService, MyGame } from '../../game.service';

/** Format an optional scheduled epoch-ms as a short local date/time, or '' . */
function formatSchedule(ms?: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * MyGamesPageComponent — `my/games`, the signed-in user's home for the games
 * they created. The landing "Sign in" link returns here after login.
 *
 * The list is read live from Firestore (GameService.watchMyGames, filtered by
 * createdBy == uid). Each row links to that game's settings — the organizer's
 * management view — and a prominent "New game" button starts the create flow,
 * which redirects to the new game's settings on success (so the loop closes:
 * my/games → new-game → g/:id/settings → back to my/games shows the new game).
 *
 * Route is auth-guarded, so a uid is always available once rendered.
 */
@Component({
  selector: 'gameboard-my-games-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
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
    IonSpinner,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>My games</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-button
        expand="block"
        routerLink="/new-game"
        data-testid="new-game"
      >
        New game
      </ion-button>

      @if (games(); as games) {
        @if (games.length === 0) {
          <ion-text color="medium">
            <p data-testid="empty-games">
              You haven't created any games yet. Tap <strong>New game</strong> to
              start your first one.
            </p>
          </ion-text>
        } @else {
          <ion-list data-testid="games-list">
            @for (game of games; track game.gameID) {
              <ion-item
                button
                [routerLink]="['/g', game.gameID, 'settings']"
                data-testid="game-row"
              >
                <ion-label>
                  <h2>{{ game.home.name }} vs {{ game.away.name }}</h2>
                  <ion-note>
                    {{ game.status }}{{ scheduleSuffix(game) }}
                  </ion-note>
                </ion-label>
              </ion-item>
            }
          </ion-list>
        }
      } @else {
        <div class="loading" data-testid="loading">
          <ion-spinner name="dots"></ion-spinner>
        </div>
      }
    </ion-content>
  `,
  styles: `
    .loading {
      display: flex;
      justify-content: center;
      margin-top: 2rem;
    }
    ion-note {
      display: block;
    }
  `,
})
export class MyGamesPageComponent {
  private readonly authStateService = inject(SneatAuthStateService);
  private readonly gameService = inject(GameService);

  /**
   * Live games for the signed-in user. `undefined` = still loading; `[]` =
   * loaded but the user has created none.
   */
  protected readonly games = toSignal(
    this.authStateService.authUser.pipe(
      map((u) => u?.uid ?? null),
      distinctUntilChanged(),
      switchMap((uid) =>
        uid ? this.gameService.watchMyGames(uid) : of<MyGame[]>([]),
      ),
    ),
    { initialValue: undefined },
  );

  /** ` · <date>` suffix for the row note when the game has a schedule. */
  protected scheduleSuffix(game: MyGame): string {
    const when = formatSchedule(game.scheduledMs);
    return when ? ` · ${when}` : '';
  }
}
