import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { SneatAuthStateService } from '@sneat/auth-core';
import {
  RecurringSchedule,
  SPORTS,
  Sport,
  WEEKDAYS,
} from './game-invite-contract';
import { createGameInvite } from './game-invite-store';

/** One roster row while the organizer is still building the team list, before
 * a playerId is assigned (that happens on submit, in the store). */
interface DraftPlayer {
  name: string;
  jersey: string;
  guardianName: string;
}

// Organize-game page — the on-ramp to the "invite the roster → parents RSVP →
// roster fills" loop (backstage/docs/roadmaps/gameboard-game-invites.md MVP
// item 1). Distinct from ../new-game (two competing teams + a scoreboard
// game): this is a coach setting up THEIR team's game/practice + roster, the
// youth-basketball anchor scenario. Anon-first like new-game/chess (no auth
// guard) so a coach can try it with zero friction; a non-blocking sign-in
// hint is shown for parity with new-game's UX, but — because this whole
// feature is a localStorage-backed prototype (see game-invite-store.ts) —
// creating does not require signing in the way the real account-gated
// new-game flow does (see spec REQ:account-creator, which the real facade
// swap would enforce).
@Component({
  selector: 'gameboard-organize-game-page',
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
    IonLabel,
    IonList,
    IonNote,
    IonButton,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonSpinner,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Organize a game</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-card>
        <ion-card-header>
          <ion-card-title
            >{{ selectedSport().emoji }} New
            {{ selectedSport().label }} game</ion-card-title
          >
          <ion-note
            >Team, date/time, and who's on the roster — invite links and
            reminders come next.</ion-note
          >
        </ion-card-header>
        <ion-card-content>
          <ion-item>
            <ion-select
              label="Sport"
              labelPlacement="stacked"
              interface="popover"
              [ngModel]="sport()"
              (ngModelChange)="sport.set($event)"
            >
              @for (s of sports; track s.id) {
                <ion-select-option [value]="s.id"
                  >{{ s.emoji }} {{ s.label }}</ion-select-option
                >
              }
            </ion-select>
          </ion-item>

          @if (!isSignedIn()) {
            <ion-item lines="none" class="signin-hint">
              <ion-note
                >Have a
                <a
                  href="https://sneat.team/"
                  target="_blank"
                  rel="noopener noreferrer"
                  >sneat.team</a
                >
                account?</ion-note
              >
              <ion-button
                slot="end"
                fill="outline"
                size="small"
                (click)="signIn()"
                >Sign in</ion-button
              >
            </ion-item>
          }

          <ion-item>
            <ion-input
              label="Your team"
              labelPlacement="stacked"
              placeholder="e.g. U14 Girls"
              [ngModel]="teamName()"
              (ngModelChange)="teamName.set($event)"
            />
          </ion-item>
          @if (showErrors() && teamNameInvalid()) {
            <ion-note color="danger" class="field-error"
              >Team name is required.</ion-note
            >
          }

          <ion-item>
            <ion-input
              label="Opponent (optional)"
              labelPlacement="stacked"
              placeholder="e.g. Riverside Raptors"
              [ngModel]="opponentName()"
              (ngModelChange)="opponentName.set($event)"
            />
          </ion-item>

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
          @if (showErrors() && scheduleInvalid()) {
            <ion-note color="danger" class="field-error"
              >Pick a date and time.</ion-note
            >
          }

          <ion-item>
            <ion-input
              label="Place"
              labelPlacement="stacked"
              placeholder="gym or address (optional)"
              [ngModel]="venue()"
              (ngModelChange)="venue.set($event)"
            />
          </ion-item>

          <ion-item>
            <ion-input
              label="Players needed"
              labelPlacement="stacked"
              type="number"
              min="1"
              [ngModel]="playersNeeded()"
              (ngModelChange)="playersNeeded.set(+$event)"
            />
          </ion-item>

          <!-- Recurring — models (does not yet schedule) a weekly practice/game,
               per the roadmap doc's §2.2.1 gap. -->
          <ion-item>
            <ion-toggle
              [checked]="recurringEnabled()"
              (ionChange)="recurringEnabled.set($event.detail.checked)"
              >Repeats weekly</ion-toggle
            >
          </ion-item>
          @if (recurringEnabled()) {
            <ion-item>
              <ion-select
                label="Every"
                labelPlacement="stacked"
                interface="popover"
                [ngModel]="recurringWeekday()"
                (ngModelChange)="recurringWeekday.set($event)"
              >
                @for (w of weekdays; track w.id) {
                  <ion-select-option [value]="w.id">{{
                    w.label
                  }}</ion-select-option>
                }
              </ion-select>
              <ion-input
                label="At"
                labelPlacement="stacked"
                type="time"
                [ngModel]="recurringTime()"
                (ngModelChange)="recurringTime.set($event)"
              />
            </ion-item>
            <ion-note class="hint"
              >Models a weekly Calendarius happening — the first occurrence is
              created now; later occurrences are a Phase-2 follow-up.</ion-note
            >
          }

          <!-- Roster -->
          <h3 class="section-title">Roster</h3>
          @if (roster().length > 0) {
            <ion-list data-testid="roster-draft-list">
              @for (p of roster(); track $index) {
                <ion-item>
                  <ion-label>
                    <h2>{{ p.name }}{{ p.jersey ? ' #' + p.jersey : '' }}</h2>
                    @if (p.guardianName) {
                      <ion-note>Parent: {{ p.guardianName }}</ion-note>
                    }
                  </ion-label>
                  <ion-button
                    slot="end"
                    fill="clear"
                    color="danger"
                    (click)="removePlayer($index)"
                    aria-label="Remove player"
                    >✕</ion-button
                  >
                </ion-item>
              }
            </ion-list>
          } @else {
            <ion-note class="hint"
              >No players added yet — add a few now, or invite them and let
              parents add their kid from the link.</ion-note
            >
          }

          <ion-item>
            <ion-input
              label="Player name"
              labelPlacement="stacked"
              placeholder="e.g. Lily"
              [ngModel]="draftName()"
              (ngModelChange)="draftName.set($event)"
            />
            <ion-input
              label="Jersey #"
              labelPlacement="stacked"
              class="jersey-input"
              [ngModel]="draftJersey()"
              (ngModelChange)="draftJersey.set($event)"
            />
          </ion-item>
          <ion-item>
            <ion-input
              label="Parent name (optional)"
              labelPlacement="stacked"
              placeholder="e.g. Maria (mom)"
              [ngModel]="draftGuardian()"
              (ngModelChange)="draftGuardian.set($event)"
            />
          </ion-item>
          <ion-button
            fill="outline"
            expand="block"
            size="small"
            [disabled]="!draftName().trim()"
            (click)="addPlayer()"
            data-testid="add-player"
          >
            + Add player to roster
          </ion-button>

          <ion-button
            expand="block"
            class="ion-margin-top"
            (click)="create()"
            data-testid="create-game"
          >
            @if (submitting()) {
              <ion-spinner name="dots" />
            } @else {
              Create game & get invite link ›
            }
          </ion-button>
        </ion-card-content>
      </ion-card>
    </ion-content>
  `,
  styles: `
    .field-error {
      display: block;
      margin: 0.25rem 1rem 0;
      font-size: 0.8rem;
    }
    .hint {
      display: block;
      margin: 0.25rem 1rem 0.75rem;
      font-size: 0.8rem;
    }
    .section-title {
      margin: 1.25rem 1rem 0.25rem;
      font-size: 1rem;
    }
    .jersey-input {
      max-width: 6rem;
    }
  `,
})
export class OrganizeGamePageComponent {
  private readonly router = inject(Router);
  private readonly authStateService = inject(SneatAuthStateService);

  protected readonly sports = SPORTS;
  protected readonly weekdays = WEEKDAYS;

  protected readonly isSignedIn = toSignal(
    this.authStateService.authStatus.pipe(map((s) => s === 'authenticated')),
    { initialValue: false },
  );

  protected readonly sport = signal<Sport>('basketball');
  protected readonly teamName = signal('');
  protected readonly opponentName = signal('');
  protected readonly date = signal('');
  protected readonly time = signal('');
  protected readonly venue = signal('');
  protected readonly playersNeeded = signal(10);
  protected readonly recurringEnabled = signal(false);
  protected readonly recurringWeekday =
    signal<NonNullable<RecurringSchedule['weekday']>>('sat');
  protected readonly recurringTime = signal('10:00');
  protected readonly roster = signal<DraftPlayer[]>([]);
  protected readonly submitting = signal(false);
  protected readonly showErrors = signal(false);

  protected readonly draftName = signal('');
  protected readonly draftJersey = signal('');
  protected readonly draftGuardian = signal('');

  protected readonly selectedSport = computed(
    () => this.sports.find((s) => s.id === this.sport()) ?? this.sports[0],
  );

  protected readonly teamNameInvalid = computed(
    () => this.teamName().trim().length === 0,
  );
  protected readonly scheduleInvalid = computed(
    () => !this.date() || !this.time(),
  );
  protected readonly canCreate = computed(
    () => !this.teamNameInvalid() && !this.scheduleInvalid(),
  );

  protected signIn(): void {
    void this.router.navigate(['/login'], {
      fragment: '/game-invites/new',
      queryParams: {
        reason: 'Sign in to organize with your sneat.team roster.',
      },
    });
  }

  protected addPlayer(): void {
    const name = this.draftName().trim();
    if (!name) return;
    this.roster.update((r) => [
      ...r,
      {
        name,
        jersey: this.draftJersey().trim(),
        guardianName: this.draftGuardian().trim(),
      },
    ]);
    this.draftName.set('');
    this.draftJersey.set('');
    this.draftGuardian.set('');
  }

  protected removePlayer(index: number): void {
    this.roster.update((r) => r.filter((_, i) => i !== index));
  }

  protected async create(): Promise<void> {
    if (this.submitting()) return;
    if (!this.canCreate()) {
      this.showErrors.set(true);
      return;
    }
    this.submitting.set(true);
    try {
      const scheduledMs = Date.parse(`${this.date()}T${this.time()}`);
      const doc = createGameInvite({
        sport: this.sport(),
        teamName: this.teamName().trim(),
        opponentName: this.opponentName().trim() || undefined,
        scheduledMs: Number.isFinite(scheduledMs) ? scheduledMs : 0,
        venue: this.venue().trim() || undefined,
        playersNeeded: this.playersNeeded() || 0,
        recurring: {
          enabled: this.recurringEnabled(),
          ...(this.recurringEnabled()
            ? { weekday: this.recurringWeekday(), time: this.recurringTime() }
            : {}),
        },
        organizerName: 'Coach',
        roster: this.roster().map((p) => ({
          name: p.name,
          jersey: p.jersey || undefined,
          guardianName: p.guardianName || undefined,
        })),
      });
      await this.router.navigate(['/game-invites', doc.gameId], {
        replaceUrl: true,
      });
    } finally {
      this.submitting.set(false);
    }
  }
}
