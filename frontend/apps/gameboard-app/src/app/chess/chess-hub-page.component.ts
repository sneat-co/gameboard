// Chess hub — `/chess`. The on-ramp for the chess MVP: pick a mode
// (pass-and-play / vs computer / OTB clock+record), a time control (or
// untimed), and (vs-computer) a strength level + which colour to play, then
// start. Anonymous-friendly like `/new-game` — no auth required to play; the
// game record is saved locally (chess-game-store.ts) regardless of sign-in.
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import type { ChessTimeControl } from './chess-clock';
import { TIME_CONTROL_PRESETS } from './chess-clock';
import type { ChessGameDoc, ChessGameMode } from './chess-game-store';
import { newChessGameId, saveChessGame } from './chess-game-store';
import { STOCKFISH_LEVELS, type StockfishLevel } from './stockfish-uci';
import { timeControlToPgnField } from './pgn';

interface ModeOption {
  readonly id: ChessGameMode;
  readonly emoji: string;
  readonly label: string;
  readonly hint: string;
}

const MODES: readonly ModeOption[] = [
  {
    id: 'pass-and-play',
    emoji: '🤝',
    label: 'Pass & play',
    hint: 'Two players, one device — take turns.',
  },
  {
    id: 'vs-computer',
    emoji: '🤖',
    label: 'Vs computer',
    hint: 'Play Stockfish at an easy/medium/hard level.',
  },
  {
    id: 'otb',
    emoji: '⏱️',
    label: 'OTB clock + record',
    hint: 'Play on a real board — this becomes the clock and scoresheet.',
  },
];

@Component({
  selector: 'gameboard-chess-hub-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
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
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Chess</ion-title>
        <ion-buttons slot="end">
          <ion-button routerLink="/chess/games" fill="clear">Games</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-card>
        <ion-card-header>
          <ion-card-title>♟ New chess game</ion-card-title>
          <ion-note
            >Board + clock + auto-scoresheet — the whole point of
            GameBoard.live's chess.</ion-note
          >
        </ion-card-header>
        <ion-card-content>
          <!-- Step 1 — mode. -->
          <div class="modes">
            @for (m of modes; track m.id) {
              <ion-button
                fill="outline"
                class="mode"
                [color]="mode() === m.id ? 'primary' : 'medium'"
                (click)="mode.set(m.id)"
              >
                <span class="emoji">{{ m.emoji }}</span>
                <span class="name">{{ m.label }}</span>
              </ion-button>
            }
          </div>
          <ion-note>{{ selectedModeHint() }}</ion-note>

          <!-- Step 2 — time control. ion-chip has no built-in 'button' prop,
               so (click) alone renders a non-focusable, keyboard-inoperable
               element — made operable with tabindex/role/keydown, copying the
               RSVP page's radio-chip pattern (rsvp-page.component.ts). -->
          <div class="section">
            <ion-note>Time control</ion-note>
            <div class="chips" role="radiogroup" aria-label="Time control">
              <ion-chip
                [color]="presetId() === 'untimed' ? 'primary' : 'medium'"
                [outline]="presetId() !== 'untimed'"
                tabindex="0"
                role="radio"
                [attr.aria-checked]="presetId() === 'untimed'"
                (click)="presetId.set('untimed')"
                (keydown.enter)="presetId.set('untimed')"
                (keydown.space)="$event.preventDefault(); presetId.set('untimed')"
                >Untimed</ion-chip
              >
              @for (p of presets; track p.id) {
                <ion-chip
                  [color]="presetId() === p.id ? 'primary' : 'medium'"
                  [outline]="presetId() !== p.id"
                  tabindex="0"
                  role="radio"
                  [attr.aria-checked]="presetId() === p.id"
                  (click)="presetId.set(p.id)"
                  (keydown.enter)="presetId.set(p.id)"
                  (keydown.space)="$event.preventDefault(); presetId.set(p.id)"
                  >{{ p.label }}</ion-chip
                >
              }
              <ion-chip
                [color]="presetId() === 'custom' ? 'primary' : 'medium'"
                [outline]="presetId() !== 'custom'"
                tabindex="0"
                role="radio"
                [attr.aria-checked]="presetId() === 'custom'"
                (click)="presetId.set('custom')"
                (keydown.enter)="presetId.set('custom')"
                (keydown.space)="$event.preventDefault(); presetId.set('custom')"
                >Custom</ion-chip
              >
            </div>
            @if (presetId() === 'custom') {
              <ion-item>
                <ion-input
                  label="Base minutes"
                  labelPlacement="stacked"
                  type="number"
                  min="1"
                  [ngModel]="customBaseMin()"
                  (ngModelChange)="customBaseMin.set($event)"
                />
                <ion-input
                  label="Increment (seconds)"
                  labelPlacement="stacked"
                  type="number"
                  min="0"
                  [ngModel]="customIncSec()"
                  (ngModelChange)="customIncSec.set($event)"
                />
              </ion-item>
            }
          </div>

          <!-- Step 3 — players. -->
          <div class="section">
            @if (mode() === 'vs-computer') {
              <ion-item>
                <ion-input
                  label="Your name"
                  labelPlacement="stacked"
                  [ngModel]="humanName()"
                  (ngModelChange)="humanName.set($event)"
                />
              </ion-item>
              <ion-note>Play as</ion-note>
              <div class="chips" role="radiogroup" aria-label="Play as">
                <ion-chip
                  [color]="humanColor() === 'w' ? 'primary' : 'medium'"
                  [outline]="humanColor() !== 'w'"
                  tabindex="0"
                  role="radio"
                  [attr.aria-checked]="humanColor() === 'w'"
                  (click)="humanColor.set('w')"
                  (keydown.enter)="humanColor.set('w')"
                  (keydown.space)="$event.preventDefault(); humanColor.set('w')"
                  >White</ion-chip
                >
                <ion-chip
                  [color]="humanColor() === 'b' ? 'primary' : 'medium'"
                  [outline]="humanColor() !== 'b'"
                  tabindex="0"
                  role="radio"
                  [attr.aria-checked]="humanColor() === 'b'"
                  (click)="humanColor.set('b')"
                  (keydown.enter)="humanColor.set('b')"
                  (keydown.space)="$event.preventDefault(); humanColor.set('b')"
                  >Black</ion-chip
                >
              </div>
              <ion-note>Stockfish strength</ion-note>
              <div class="chips" role="radiogroup" aria-label="Stockfish strength">
                @for (l of levels; track l.id) {
                  <ion-chip
                    [color]="levelId() === l.id ? 'primary' : 'medium'"
                    [outline]="levelId() !== l.id"
                    tabindex="0"
                    role="radio"
                    [attr.aria-checked]="levelId() === l.id"
                    (click)="levelId.set(l.id)"
                    (keydown.enter)="levelId.set(l.id)"
                    (keydown.space)="$event.preventDefault(); levelId.set(l.id)"
                    >{{ l.label }}</ion-chip
                  >
                }
              </div>
            } @else {
              <ion-item>
                <ion-input
                  label="White"
                  labelPlacement="stacked"
                  [ngModel]="whiteName()"
                  (ngModelChange)="whiteName.set($event)"
                />
              </ion-item>
              <ion-item>
                <ion-input
                  label="Black"
                  labelPlacement="stacked"
                  [ngModel]="blackName()"
                  (ngModelChange)="blackName.set($event)"
                />
              </ion-item>
            }
          </div>

          <ion-button expand="block" class="ion-margin-top" (click)="start()">
            Start game ›
          </ion-button>
        </ion-card-content>
      </ion-card>
    </ion-content>
  `,
  styles: `
    .modes {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }
    .mode {
      height: 4.5rem;
      --padding-top: 0.5rem;
      --padding-bottom: 0.5rem;
    }
    .mode::part(native) {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .mode .emoji {
      font-size: 1.5rem;
      line-height: 1;
    }
    .mode .name {
      font-size: 0.7rem;
      text-transform: none;
      text-align: center;
    }
    .section {
      margin-top: 1.25rem;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin: 0.35rem 0 0.5rem;
    }
  `,
})
export class ChessHubPageComponent {
  protected readonly modes = MODES;
  protected readonly presets = TIME_CONTROL_PRESETS;
  protected readonly levels = STOCKFISH_LEVELS;

  protected readonly mode = signal<ChessGameMode>('pass-and-play');
  protected readonly presetId = signal<string>('blitz-3-2');
  protected readonly customBaseMin = signal(10);
  protected readonly customIncSec = signal(5);

  protected readonly whiteName = signal('White');
  protected readonly blackName = signal('Black');
  protected readonly humanName = signal('You');
  protected readonly humanColor = signal<'w' | 'b'>('w');
  protected readonly levelId = signal<StockfishLevel['id']>('medium');
  private readonly router = inject(Router);

  protected readonly selectedModeHint = computed(
    () => this.modes.find((m) => m.id === this.mode())?.hint ?? '',
  );

  protected readonly timeControl = computed<ChessTimeControl | null>(() => {
    const id = this.presetId();
    if (id === 'untimed') return null;
    if (id === 'custom') {
      return {
        baseMs: Math.max(1, this.customBaseMin()) * 60_000,
        incrementMs: Math.max(0, this.customIncSec()) * 1_000,
      };
    }
    return this.presets.find((p) => p.id === id)?.control ?? null;
  });

  protected start(): void {
    const level =
      this.levels.find((l) => l.id === this.levelId()) ?? this.levels[1];
    const white =
      this.mode() === 'vs-computer'
        ? this.humanColor() === 'w'
          ? this.humanName().trim() || 'You'
          : `Stockfish (${level.label})`
        : this.whiteName().trim() || 'White';
    const black =
      this.mode() === 'vs-computer'
        ? this.humanColor() === 'b'
          ? this.humanName().trim() || 'You'
          : `Stockfish (${level.label})`
        : this.blackName().trim() || 'Black';

    const timeControl = this.timeControl();
    const now = Date.now();
    const gameId = newChessGameId();
    const doc: ChessGameDoc = {
      gameId,
      mode: this.mode(),
      players: { white, black },
      timeControl,
      timeControlLabel: timeControl
        ? (this.presets.find((p) => p.id === this.presetId())?.label ??
          `Custom ${timeControlToPgnField(timeControl)}`)
        : 'Untimed',
      moves: [],
      fen: 'start',
      pgn: '',
      status: 'in-progress',
      result: '*',
      endReason: null,
      vsComputer:
        this.mode() === 'vs-computer'
          ? { levelId: level.id, humanColor: this.humanColor() }
          : undefined,
      createdAt: now,
      updatedAt: now,
    };
    saveChessGame(doc);
    // Create → redirect straight to the new game's play page (with its id),
    // matching the app's create-then-navigate-to-details convention. All
    // config needed to resume is in the saved doc itself, so a reload of the
    // play page works without relying on router state.
    void this.router.navigate(['/chess/play', gameId], { replaceUrl: true });
  }
}
