import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { map } from 'rxjs';
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
import { CREATOR_ROLES, CreatorRole, Side } from './game-contract';
import {
  clearNewGameDraft,
  loadNewGameDraft,
  saveNewGameDraft,
} from './new-game-draft';
import { GameService } from '../game.service';
import { SneatAuthStateService } from '@sneat/auth-core';

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
          <!-- Sign-in affordance — non-blocking. Anonymous users can ignore it
               and keep filling the form; signing in lets them use a registered
               sneat.team team and returns them right back here
               (anon-first-new-game#ac:signin-affordance-visible). -->
          @if (!isSignedIn()) {
            <ion-item lines="none" class="signin-hint">
              <ion-note>Have a sneat.team account?</ion-note>
              <ion-button
                slot="end"
                fill="outline"
                size="small"
                (click)="signIn()"
                >Sign in</ion-button
              >
            </ion-item>
          }

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
  private readonly gameService = inject(GameService);
  private readonly toasts = inject(ToastController);
  private readonly router = inject(Router);
  private readonly authStateService = inject(SneatAuthStateService);

  readonly roles = CREATOR_ROLES;

  // Whether a user is currently signed in — drives the in-page sign-in
  // affordance and (in Task 4) the explicit authenticated create.
  readonly isSignedIn = toSignal(
    this.authStateService.authStatus.pipe(map((s) => s === 'authenticated')),
    { initialValue: false },
  );

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

  constructor() {
    // Rehydrate the most-recent draft so an anonymous user who navigated away
    // (e.g. through the full-page redirect sign-in) resumes where they left off
    // (anon-first-new-game#ac:draft-restored-on-load).
    const draft = loadNewGameDraft();
    if (draft) {
      if (draft.homeName !== undefined) this.homeName.set(draft.homeName);
      if (draft.homeColour) this.homeColour.set(draft.homeColour);
      if (draft.awayName !== undefined) this.awayName.set(draft.awayName);
      if (draft.awayColour) this.awayColour.set(draft.awayColour);
      if (draft.date !== undefined) this.date.set(draft.date);
      if (draft.time !== undefined) this.time.set(draft.time);
      if (draft.venue !== undefined) this.venue.set(draft.venue);
      if (draft.competition !== undefined) this.competition.set(draft.competition);
      if (draft.role) this.role.set(draft.role);
    }

    // Auto-save every field change as the single most-recent draft — no explicit
    // save action (anon-first-new-game#ac:draft-saved-on-change).
    effect(() =>
      saveNewGameDraft({
        homeName: this.homeName(),
        homeColour: this.homeColour(),
        awayName: this.awayName(),
        awayColour: this.awayColour(),
        date: this.date(),
        time: this.time(),
        venue: this.venue(),
        competition: this.competition(),
        role: this.role(),
      }),
    );
  }

  /** Start sign-in and return to this page afterwards. The login page reads the
   * URL hash as the post-login redirect target (see redirectToLoginIfNotSignedIn
   * in @sneat/auth-core), so the fragment is the router-relative return path.
   * The draft is already in localStorage, so the round-trip is loss-free
   * (anon-first-new-game#ac:roundtrip-preserves-draft). */
  signIn(): void {
    void this.router.navigate(['/login'], { fragment: '/new-game' });
  }

  label(r: CreatorRole): string {
    return r
      .split('-')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join('-');
  }

  async create(): Promise<void> {
    if (!this.canCreate() || this.submitting()) return;
    // Persisting a game requires authentication and an explicit action. An
    // anonymous user who triggers create is routed through sign-in first; the
    // draft stays local (localStorage) and nothing is written to the backend
    // until they return and explicitly create while signed in
    // (anon-first-new-game#ac:anonymous-create-routes-through-signin).
    if (!this.isSignedIn()) {
      this.signIn();
      return;
    }
    this.submitting.set(true);
    const home: Side = { name: this.homeName().trim(), colour: this.homeColour() };
    const away: Side = { name: this.awayName().trim(), colour: this.awayColour() };
    const scheduledMs =
      this.date() && this.time() ? Date.parse(`${this.date()}T${this.time()}`) : 0;
    try {
      const game = await this.gameService.createGame(home, away, scheduledMs);
      // The game is now persisted server-side; drop the local draft.
      clearNewGameDraft();
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
