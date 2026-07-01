import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { inviteTeaser, RsvpStatus } from './game-invite-contract';
import { decodeInviteToken } from './invite-token';
import {
  addRosterPlayer,
  getGameInvite,
  getMyInviteeName,
  setMyInviteeName,
  setRsvp,
} from './game-invite-store';
import { computeRosterFill, computeRosterFillForDoc } from './roster-fill';

const STATUSES: readonly { id: RsvpStatus; label: string }[] = [
  { id: 'going', label: "I'm in" },
  { id: 'maybe', label: 'Maybe' },
  { id: 'out', label: "Can't make it" },
];

/**
 * The invitee experience — `game-invites/rsvp/:token` — reachable from the
 * shareable link a coach copies off the roster console. This is the anon-first
 * parent-proxy RSVP surface (roadmap doc MVP item 3): it works from the link
 * with NO sign-in (mirrors ../new-game's anon-first-new-game pattern), lets a
 * parent pick which roster kid they're responding for (or add a kid not yet
 * listed — the open-join / walk-in path), and records going/maybe/out. The
 * ACTOR (parent, `respondedBy`) and the CONTACT (kid, `playerId`) are kept
 * distinct throughout — see parent-proxy.ts.
 *
 * NOT auth-guarded, by design: a first-time parent must be able to open the
 * link and RSVP with zero friction. A non-blocking "sign in" nudge is shown
 * after a successful RSVP, never before it.
 */
@Component({
  selector: 'gameboard-rsvp-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonChip,
    IonNote,
    IonButton,
    IonSpinner,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Game invite</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (!doc()) {
        <ion-note data-testid="invalid-invite">{{
          tokenInvalid()
            ? 'This invite link looks broken.'
            : 'This game could not be found — it may have been removed.'
        }}</ion-note>
      } @else {
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ teaser() }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p class="fill-label">{{ fill().fillLabel }}</p>

            @if (!confirmed()) {
              <!-- Step 1 — who are you RSVPing for. -->
              @if (selectedPlayerId() && !addingNew()) {
                <ion-item lines="none">
                  <ion-note
                    >RSVPing for
                    <strong>{{ selectedPlayerName() }}</strong></ion-note
                  >
                  <ion-button
                    slot="end"
                    fill="clear"
                    size="small"
                    (click)="pickDifferentKid()"
                    >Not them?</ion-button
                  >
                </ion-item>
              } @else {
                <ion-item>
                  <ion-select
                    label="Which kid?"
                    labelPlacement="stacked"
                    interface="popover"
                    placeholder="Select from the roster"
                    [ngModel]="selectedPlayerId()"
                    (ngModelChange)="selectPlayer($event)"
                  >
                    @for (p of doc()!.roster; track p.playerId) {
                      <ion-select-option [value]="p.playerId">{{
                        p.name
                      }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>
                <ion-button
                  fill="clear"
                  size="small"
                  (click)="addingNew.set(true)"
                  data-testid="add-my-kid-toggle"
                  >Not on the list? Add my kid</ion-button
                >
                @if (addingNew()) {
                  <ion-item>
                    <ion-input
                      label="Kid's name"
                      labelPlacement="stacked"
                      [ngModel]="newKidName()"
                      (ngModelChange)="newKidName.set($event)"
                    />
                  </ion-item>
                }
              }

              <!-- Step 2 — parent identity. -->
              <ion-item>
                <ion-input
                  label="Your name (parent/guardian)"
                  labelPlacement="stacked"
                  placeholder="e.g. Maria (Lily's mom)"
                  [ngModel]="guardianName()"
                  (ngModelChange)="guardianName.set($event)"
                />
              </ion-item>

              <!-- Step 3 — attendance. -->
              <div class="statuses">
                @for (s of statuses; track s.id) {
                  <ion-chip
                    [color]="status() === s.id ? 'primary' : 'medium'"
                    [outline]="status() !== s.id"
                    (click)="status.set(s.id)"
                    >{{ s.label }}</ion-chip
                  >
                }
              </div>

              <ion-item>
                <ion-textarea
                  label="Note (optional)"
                  labelPlacement="stacked"
                  placeholder="e.g. running 10 min late"
                  [ngModel]="note()"
                  (ngModelChange)="note.set($event)"
                  autoGrow="true"
                />
              </ion-item>

              @if (showError()) {
                <ion-note color="danger" class="field-error">{{
                  errorMessage()
                }}</ion-note>
              }

              <ion-button
                expand="block"
                class="ion-margin-top"
                (click)="submit()"
                data-testid="submit-rsvp"
              >
                @if (submitting()) {
                  <ion-spinner name="dots" />
                } @else {
                  Send RSVP
                }
              </ion-button>
            } @else {
              <!-- Confirmation. -->
              <ion-note
                color="success"
                class="confirmation"
                data-testid="confirmation"
              >
                You're in for <strong>{{ selectedPlayerName() }}</strong> —
                {{ statusLabel() }}. {{ fill().fillLabel }}
              </ion-note>

              <ion-button
                expand="block"
                fill="outline"
                [routerLink]="['/game-invites', doc()!.gameId]"
                >See full roster</ion-button
              >

              <ion-item lines="none" class="signin-hint">
                <ion-note
                  >Want to manage this from your phone next time?</ion-note
                >
                <ion-button
                  slot="end"
                  fill="outline"
                  size="small"
                  (click)="signIn()"
                  >Create free account</ion-button
                >
              </ion-item>
            }
          </ion-card-content>
        </ion-card>
      }
    </ion-content>
  `,
  styles: `
    .fill-label {
      font-weight: 600;
      margin: 0 0 0.75rem;
    }
    .statuses {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      margin: 0.75rem 1rem;
    }
    .field-error {
      display: block;
      margin: 0.5rem 1rem 0;
      font-size: 0.8rem;
    }
    .confirmation {
      display: block;
      margin-bottom: 1rem;
    }
    .signin-hint {
      margin-top: 1rem;
    }
  `,
})
export class RsvpPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly statuses = STATUSES;

  private readonly token = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('token') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('token') ?? '' },
  );

  private readonly payload = computed(() => decodeInviteToken(this.token()));
  protected readonly tokenInvalid = computed(() => this.payload() === null);

  private readonly version = signal(0);

  protected readonly doc = computed(() => {
    this.version();
    const payload = this.payload();
    return payload ? getGameInvite(payload.gameId) : null;
  });

  protected readonly fill = computed(() => {
    const doc = this.doc();
    return doc ? computeRosterFillForDoc(doc) : computeRosterFill([], {}, 0);
  });

  protected readonly teaser = computed(() => {
    const doc = this.doc();
    return doc ? inviteTeaser(doc) : '';
  });

  protected readonly selectedPlayerId = signal<string | null>(null);
  protected readonly addingNew = signal(false);
  protected readonly newKidName = signal('');
  protected readonly guardianName = signal(getMyInviteeName());
  protected readonly status = signal<RsvpStatus>('going');
  protected readonly note = signal('');
  protected readonly submitting = signal(false);
  protected readonly showError = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly confirmed = signal(false);

  constructor() {
    // Pre-select the targeted player from the link, if any (role-invites'
    // targeted-invite pattern); an open link leaves it unset so the parent
    // picks from the roster or adds their kid.
    const targeted = this.payload()?.playerId;
    if (targeted) this.selectedPlayerId.set(targeted);
  }

  protected selectedPlayerName(): string {
    const doc = this.doc();
    const id = this.selectedPlayerId();
    return doc?.roster.find((p) => p.playerId === id)?.name ?? '';
  }

  protected statusLabel(): string {
    return this.statuses.find((s) => s.id === this.status())?.label ?? '';
  }

  protected selectPlayer(id: string): void {
    this.selectedPlayerId.set(id);
    this.addingNew.set(false);
  }

  protected pickDifferentKid(): void {
    this.selectedPlayerId.set(null);
    this.addingNew.set(false);
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    const doc = this.doc();
    if (!doc) return;

    let playerId = this.selectedPlayerId();
    if (this.addingNew()) {
      const name = this.newKidName().trim();
      if (!name) {
        this.showError.set(true);
        this.errorMessage.set("Enter your kid's name.");
        return;
      }
      const updated = addRosterPlayer(doc.gameId, {
        name,
        guardianName: this.guardianName().trim() || undefined,
      });
      playerId = updated?.roster[updated.roster.length - 1]?.playerId ?? null;
    }
    if (!playerId) {
      this.showError.set(true);
      this.errorMessage.set('Pick which kid this RSVP is for.');
      return;
    }

    this.submitting.set(true);
    this.showError.set(false);
    try {
      setMyInviteeName(this.guardianName());
      const result = setRsvp(
        doc.gameId,
        playerId,
        this.status(),
        this.guardianName() || getMyInviteeName(),
        this.note(),
      );
      if (!result) {
        this.showError.set(true);
        this.errorMessage.set('Could not save your RSVP. Please try again.');
        return;
      }
      this.selectedPlayerId.set(playerId);
      this.version.update((v) => v + 1);
      this.confirmed.set(true);
    } finally {
      this.submitting.set(false);
    }
  }

  protected signIn(): void {
    void this.router.navigate(['/login'], {
      fragment: `/game-invites/rsvp/${this.token()}`,
      queryParams: {
        reason: 'Create a free account to manage your RSVPs from anywhere.',
      },
    });
  }
}
