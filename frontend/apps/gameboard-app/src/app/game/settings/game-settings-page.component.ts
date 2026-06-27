import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { GameService } from '../../game.service';
import { GameRecord } from '../../new-game/game-contract';

/** Format an epoch-ms instant as local `YYYY-MM-DD` + `HH:mm` for the inputs. */
function msToDateTime(ms: number): { date: string; time: string } {
  if (!ms) return { date: '', time: '' };
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/**
 * GameSettingsPageComponent — organizer tool for `g/:gameID/settings`.
 *
 * The new-game flow redirects here after a game is created so the organizer can
 * finish setup: edit the schedule (date + time) and venue. The route is
 * auth-guarded (sign-in required).
 *
 * Authorization is backend-enforced: the PUT endpoint restricts the write to the
 * game's creator and returns 403 otherwise; a non-organizer who reaches the page
 * sees the form but gets a clear "only the organizer can edit" message on save.
 * (A client-side read-only gate for non-organizers, plus a crew section, are the
 * next slice — the data model lands then.)
 */
@Component({
  selector: 'gameboard-game-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonNote,
    IonButton,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/"></ion-back-button>
        </ion-buttons>
        <ion-title>Game settings</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (notFound()) {
        <p data-testid="not-found">Game not found.</p>
      } @else {
        <ion-list>
          <ion-item>
            <ion-label position="stacked">Date</ion-label>
            <ion-input
              data-testid="settings-date"
              type="date"
              [ngModel]="date()"
              (ngModelChange)="date.set($event)"
            ></ion-input>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Time</ion-label>
            <ion-input
              data-testid="settings-time"
              type="time"
              [ngModel]="time()"
              (ngModelChange)="time.set($event)"
            ></ion-input>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Venue / location</ion-label>
            <ion-input
              data-testid="settings-location"
              placeholder="e.g. Central Park, Field 3"
              [ngModel]="location()"
              (ngModelChange)="location.set($event)"
            ></ion-input>
          </ion-item>
        </ion-list>

        <ion-note class="crew-note" data-testid="crew-coming-soon">
          Crew &amp; invites — coming soon.
        </ion-note>

        <ion-button
          expand="block"
          data-testid="settings-save"
          [disabled]="submitting()"
          (click)="save()"
        >
          {{ submitting() ? 'Saving…' : 'Save' }}
        </ion-button>
      }
    </ion-content>
  `,
  styles: `
    .crew-note {
      display: block;
      margin: 1rem 0;
      color: var(--ion-color-medium, #777);
    }
  `,
})
export class GameSettingsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly gameService = inject(GameService);
  private readonly toasts = inject(ToastController);

  /** Game id from the `:gameID` route param. */
  private readonly gameID = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('gameID') ?? '')),
    { initialValue: '' },
  );

  protected readonly date = signal('');
  protected readonly time = signal('');
  protected readonly location = signal('');
  protected readonly submitting = signal(false);
  protected readonly notFound = signal(false);

  constructor() {
    effect(() => {
      const id = this.gameID();
      if (id) void this.load(id);
    });
  }

  private async load(gameID: string): Promise<void> {
    try {
      const game: GameRecord = await this.gameService.getGame(gameID);
      const { date, time } = msToDateTime(game.scheduledMs ?? 0);
      this.date.set(date);
      this.time.set(time);
      this.location.set(game.location ?? '');
      this.notFound.set(false);
    } catch {
      this.notFound.set(true);
    }
  }

  protected async save(): Promise<void> {
    const id = this.gameID();
    if (!id || this.submitting()) return;
    this.submitting.set(true);
    const scheduledMs =
      this.date() && this.time()
        ? Date.parse(`${this.date()}T${this.time()}`)
        : 0;
    try {
      await this.gameService.updateGameSettings(id, {
        scheduledMs,
        location: this.location().trim(),
      });
      await this.notify('Settings saved.', 'success');
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 403) {
        await this.notify('Only the organizer can edit this game.', 'warning');
      } else {
        await this.notify('Could not save settings. Please try again.', 'danger');
      }
    } finally {
      this.submitting.set(false);
    }
  }

  private async notify(
    message: string,
    color: 'success' | 'warning' | 'danger',
  ): Promise<void> {
    const toast = await this.toasts.create({ message, color, duration: 3000 });
    await toast.present();
  }
}
