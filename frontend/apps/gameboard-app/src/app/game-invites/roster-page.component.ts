import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
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
import { SPORTS } from './game-invite-contract';
import { buildInviteLink } from './invite-token';
import { addRosterPlayer, getGameInvite } from './game-invite-store';
import {
  computeRosterFill,
  computeRosterFillForDoc,
  RosterFillRow,
} from './roster-fill';

/**
 * Roster / coach console — `game-invites/:gameId`. The organizer's view after
 * creating a game: invite links (open + per-player), the fill count, and the
 * roster grouped going/maybe/out/no-reply (the roadmap doc MVP item 4).
 *
 * This is a localStorage-only prototype (see game-invite-store.ts) with no
 * live listener, so a "Refresh" action re-reads the store — standing in for
 * what would be a real-time rsvp-express/eventius subscription once that
 * write-back is wired for real.
 */
@Component({
  selector: 'gameboard-roster-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonItem,
    IonInput,
    IonLabel,
    IonList,
    IonNote,
    IonButton,
  ],
  template: `
    @if (doc(); as doc) {
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-back-button defaultHref="/game-invites"></ion-back-button>
          </ion-buttons>
          <ion-title>{{ doc.teamName }}</ion-title>
          <ion-buttons slot="end">
            <ion-button routerLink="/game-invites">All games</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>

      <ion-content class="ion-padding">
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ teaser() }}</ion-card-title>
            @if (doc.recurring.enabled) {
              <ion-card-subtitle
                >Repeats every {{ doc.recurring.weekday }} at
                {{ doc.recurring.time }}</ion-card-subtitle
              >
            }
          </ion-card-header>
          <ion-card-content>
            <p class="fill-label" data-testid="fill-label">
              {{ fill().fillLabel }}
            </p>

            <ion-button
              expand="block"
              fill="outline"
              (click)="copyOpenLink()"
              data-testid="copy-open-link"
            >
              🔗 Copy open invite link
            </ion-button>
            <ion-note class="hint"
              >Anyone with this link can open the RSVP page and add
              themselves.</ion-note
            >
          </ion-card-content>
        </ion-card>

        <h3 class="section-title">
          Roster ({{ fill().total }})
          <ion-button
            fill="clear"
            size="small"
            (click)="refresh()"
            data-testid="refresh"
            >↻ Refresh</ion-button
          >
        </h3>

        @if (fill().total === 0) {
          <ion-note class="hint" data-testid="empty-roster"
            >No players on the roster yet — add one below, or copy the invite
            link above so parents can add their kid.</ion-note
          >
        } @else {
          @for (group of groups(); track group.key) {
            @if (group.rows.length > 0) {
              <ion-note class="group-title">{{ group.label }}</ion-note>
              <ion-list [attr.data-testid]="'group-' + group.key">
                @for (row of group.rows; track row.player.playerId) {
                  <ion-item>
                    <ion-label>
                      <h2>
                        {{ row.player.name
                        }}{{
                          row.player.jersey ? ' #' + row.player.jersey : ''
                        }}
                      </h2>
                      @if (row.response) {
                        <ion-note
                          >{{ row.response.respondedBy }}
                          @if (row.response.note) {
                            — "{{ row.response.note }}"
                          }
                        </ion-note>
                      } @else if (row.player.guardianName) {
                        <ion-note
                          >Parent: {{ row.player.guardianName }}</ion-note
                        >
                      }
                    </ion-label>
                    <ion-button
                      slot="end"
                      fill="outline"
                      size="small"
                      (click)="copyPlayerLink(row.player.playerId)"
                      >Copy invite</ion-button
                    >
                  </ion-item>
                }
              </ion-list>
            }
          }
        }

        <h3 class="section-title">Add a player</h3>
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
          + Add to roster
        </ion-button>
      </ion-content>
    } @else {
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-back-button defaultHref="/game-invites"></ion-back-button>
          </ion-buttons>
          <ion-title>Game not found</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <ion-note data-testid="not-found"
          >This game could not be found on this device.</ion-note
        >
      </ion-content>
    }
  `,
  styles: `
    .fill-label {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0 0 0.75rem;
    }
    .hint {
      display: block;
      margin: 0.5rem 0 0;
      font-size: 0.8rem;
    }
    .section-title {
      margin: 1.25rem 1rem 0.25rem;
      font-size: 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .group-title {
      display: block;
      margin: 0.75rem 1rem 0.25rem;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.7rem;
      letter-spacing: 0.04em;
    }
    .jersey-input {
      max-width: 6rem;
    }
  `,
})
export class RosterPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastController);

  private readonly gameId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('gameId') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('gameId') ?? '' },
  );

  // Bumped on every mutating action to force a re-read from the store —
  // stands in for a real-time subscription (see class doc).
  private readonly version = signal(0);

  protected readonly doc = computed(() => {
    this.version();
    const id = this.gameId();
    return id ? getGameInvite(id) : null;
  });

  protected readonly fill = computed(() => {
    const doc = this.doc();
    return doc ? computeRosterFillForDoc(doc) : computeRosterFill([], {}, 0);
  });

  protected readonly teaser = computed(() => {
    const doc = this.doc();
    if (!doc) return '';
    const sport = SPORTS.find((s) => s.id === doc.sport);
    const when = doc.scheduledMs
      ? new Date(doc.scheduledMs).toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'TBD';
    const where = doc.venue ? ` at ${doc.venue}` : '';
    const vs = doc.opponentName ? ` vs ${doc.opponentName}` : '';
    return `${sport?.emoji ?? '🎮'} ${doc.teamName}${vs} — ${when}${where}`;
  });

  protected readonly groups = computed(() => {
    const f = this.fill();
    return [
      {
        key: 'going',
        label: 'Going',
        rows: f.going as readonly RosterFillRow[],
      },
      {
        key: 'maybe',
        label: 'Maybe',
        rows: f.maybe as readonly RosterFillRow[],
      },
      { key: 'out', label: 'Out', rows: f.out as readonly RosterFillRow[] },
      {
        key: 'no-reply',
        label: 'No reply yet',
        rows: f.noReply as readonly RosterFillRow[],
      },
    ];
  });

  protected readonly draftName = signal('');
  protected readonly draftJersey = signal('');
  protected readonly draftGuardian = signal('');

  protected refresh(): void {
    this.version.update((v) => v + 1);
  }

  protected addPlayer(): void {
    const name = this.draftName().trim();
    const id = this.gameId();
    if (!name || !id) return;
    addRosterPlayer(id, {
      name,
      jersey: this.draftJersey().trim() || undefined,
      guardianName: this.draftGuardian().trim() || undefined,
    });
    this.draftName.set('');
    this.draftJersey.set('');
    this.draftGuardian.set('');
    this.refresh();
  }

  protected async copyOpenLink(): Promise<void> {
    const id = this.gameId();
    if (!id) return;
    await this.copy(buildInviteLink(this.origin(), { gameId: id }));
  }

  protected async copyPlayerLink(playerId: string): Promise<void> {
    const id = this.gameId();
    if (!id) return;
    await this.copy(buildInviteLink(this.origin(), { gameId: id, playerId }));
  }

  // NOT location.origin: the app is served under the `/app/` base href
  // (project.json baseHref, wrangler.jsonc routes) while the bare root
  // domain routes to a *different* Worker (the marketing landing) — an
  // invite link built from location.origin alone 404s in production.
  // document.baseURI resolves the <base href> tag to an absolute URL
  // (e.g. "https://gameboard.live/app/"), so it round-trips correctly.
  private origin(): string {
    if (typeof document === 'undefined') return '';
    return document.baseURI.replace(/\/+$/, '');
  }

  private async copy(link: string): Promise<void> {
    try {
      await navigator.clipboard?.writeText(link);
    } catch {
      // Clipboard API can be unavailable (older browsers / permissions); the
      // toast below still shows the link so the organizer can select it.
    }
    const toast = await this.toasts.create({
      message: `Invite link copied: ${link}`,
      duration: 4000,
      color: 'success',
    });
    await toast.present();
  }
}
