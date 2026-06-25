import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonMenuButton,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import {
  CREATOR_ROLES,
  CreatorRole,
  Side,
} from '@sneat/extension-gameboard-contract';
import { NewGameService } from './new-game.service';

// New game screen — the on-ramp to a GameBoard.live game.
// Implements the approved `sports/gameboard-live/new-game` Feature / prototype:
// two team names + colours and a date/time are all that's required; venue,
// competition and the creator's self-declared role are optional.
//
// Fully signal-driven + OnPush so it works under zoneless change detection
// (no reliance on zone.js): every field is a signal, two-way binding is
// expressed as `[ngModel]="field()" (ngModelChange)="field.set($event)"`.
@Component({
  selector: 'gameboard-new-game-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonInput,
    IonChip,
    IonNote,
    IonButton,
    IonSpinner,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>New game</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-card>
        <ion-card-header>
          <ion-card-title>🏀 New game</ion-card-title>
          <ion-note
            >Two team names and a time is all you need — everything else is
            optional.</ion-note
          >
        </ion-card-header>
        <ion-card-content>
          <!-- Home -->
          <ion-item>
            <input
              type="color"
              aria-label="Home team colour"
              [ngModel]="homeColour()"
              (ngModelChange)="homeColour.set($event)"
              slot="start"
              class="colour"
            />
            <ion-input
              label="Home team"
              labelPlacement="stacked"
              placeholder="e.g. Limerick Celtics"
              [ngModel]="homeName()"
              (ngModelChange)="homeName.set($event)"
            />
          </ion-item>

          <!-- Away -->
          <ion-item>
            <input
              type="color"
              aria-label="Away team colour"
              [ngModel]="awayColour()"
              (ngModelChange)="awayColour.set($event)"
              slot="start"
              class="colour"
            />
            <ion-input
              label="Away team"
              labelPlacement="stacked"
              placeholder="e.g. Ennis Tigers"
              [ngModel]="awayName()"
              (ngModelChange)="awayName.set($event)"
            />
          </ion-item>

          <!-- Schedule -->
          <ion-item>
            <ion-input
              label="Date"
              labelPlacement="stacked"
              type="date"
              [ngModel]="date()"
              (ngModelChange)="date.set($event)"
            />
            <ion-input
              label="Time"
              labelPlacement="stacked"
              type="time"
              [ngModel]="time()"
              (ngModelChange)="time.set($event)"
            />
          </ion-item>

          <!-- Optional -->
          <ion-item>
            <ion-input
              label="Venue"
              labelPlacement="stacked"
              placeholder="gym or address (optional)"
              [ngModel]="venue()"
              (ngModelChange)="venue.set($event)"
            />
          </ion-item>
          <ion-item>
            <ion-input
              label="Competition"
              labelPlacement="stacked"
              placeholder="e.g. U14 Girls · Round 5 (optional)"
              [ngModel]="competition()"
              (ngModelChange)="competition.set($event)"
            />
          </ion-item>

          <!-- Role -->
          <div class="role">
            <ion-note>Your role <em>(self-declared)</em></ion-note>
            <div class="chips">
              @for (r of roles; track r) {
                <ion-chip
                  [color]="role() === r ? 'primary' : 'medium'"
                  [outline]="role() !== r"
                  (click)="role.set(r)"
                  >{{ label(r) }}</ion-chip
                >
              }
            </div>
          </div>

          <ion-button
            expand="block"
            class="ion-margin-top"
            [disabled]="!canCreate() || submitting()"
            (click)="create()"
          >
            @if (submitting()) {
              <ion-spinner name="dots" />
            } @else {
              Create game ›
            }
          </ion-button>
        </ion-card-content>
      </ion-card>
    </ion-content>
  `,
  styles: `
    .colour {
      width: 2rem;
      height: 2rem;
      border: none;
      background: none;
      padding: 0;
    }
    .role {
      margin-top: 1rem;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      margin-top: 0.5rem;
    }
  `,
})
export class NewGamePageComponent {
  private readonly api = inject(NewGameService);
  private readonly toasts = inject(ToastController);

  readonly roles = CREATOR_ROLES;

  // Two team names + colours, schedule, optional metadata, self-declared role —
  // all signals for zoneless-safe change detection.
  readonly homeName = signal('');
  readonly homeColour = signal('#1f9d55');
  readonly awayName = signal('');
  readonly awayColour = signal('#2563eb');
  readonly date = signal('');
  readonly time = signal('');
  readonly venue = signal('');
  readonly competition = signal('');
  readonly role = signal<CreatorRole>('coach');
  readonly submitting = signal(false);

  readonly canCreate = computed(
    () => this.homeName().trim().length > 0 && this.awayName().trim().length > 0,
  );

  label(r: CreatorRole): string {
    return r
      .split('-')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join('-');
  }

  async create(): Promise<void> {
    if (!this.canCreate() || this.submitting()) return;
    this.submitting.set(true);
    const home: Side = { name: this.homeName().trim(), colour: this.homeColour() };
    const away: Side = { name: this.awayName().trim(), colour: this.awayColour() };
    const scheduledMs =
      this.date() && this.time() ? Date.parse(`${this.date()}T${this.time()}`) : 0;
    try {
      const game = await this.api.createGame(home, away, scheduledMs);
      await this.notify(`Game created · #${game.id}`, 'success');
      // TODO: navigate to the game scoreboard once that route exists.
    } catch {
      await this.notify('Could not create the game. Please try again.', 'danger');
    } finally {
      this.submitting.set(false);
    }
  }

  private async notify(
    message: string,
    color: 'success' | 'danger',
  ): Promise<void> {
    const toast = await this.toasts.create({ message, color, duration: 3000 });
    await toast.present();
  }
}
