// Chess play page — `/chess/play/:gameId`. Hosts one live match (pass-and-play,
// vs-computer, or OTB record — all three share this exact same core: board +
// clock + move list, MVP scope items 1–5) OR, once a game has moves and the
// page is (re)loaded, a read-only recap of it (scope item 6's "view a saved
// game" + the games-list "view PGN" need). See the `viewMode` doc comment for
// why reload-mid-game doesn't resume live ticking — a documented MVP
// simplification, not an oversight.
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  IonMenuButton,
  IonNote,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import type { Key } from 'chessground/types';
import { Chess } from 'chess.js';
import { formatClockDisplay, type ChessColor } from './chess-clock';
import { ChessMatch } from './chess-match';
import {
  getChessGame,
  newChessGameId,
  saveChessGame,
  type ChessGameDoc,
} from './chess-game-store';
import type { ChessMoveRecord } from './pgn';
import { STOCKFISH_LEVELS } from './stockfish-uci';
import { StockfishService } from './stockfish.service';
import {
  ChessBoardComponent,
  type ChessBoardMoveEvent,
} from './chess-board.component';

interface MovePair {
  readonly moveNumber: number;
  readonly white?: ChessMoveRecord;
  readonly black?: ChessMoveRecord;
}

function toMovePairs(history: readonly ChessMoveRecord[]): MovePair[] {
  const pairs: MovePair[] = [];
  for (const mv of history) {
    const last = pairs[pairs.length - 1];
    if (mv.color === 'w' || !last || last.black) {
      pairs.push({
        moveNumber: mv.moveNumber,
        white: mv.color === 'w' ? mv : undefined,
        black: mv.color === 'b' ? mv : undefined,
      });
    } else {
      pairs[pairs.length - 1] = { ...last, black: mv };
    }
  }
  return pairs;
}

@Component({
  selector: 'gameboard-chess-play-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
    IonButton,
    IonNote,
    ChessBoardComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>{{ modeTitle() }}</ion-title>
        <ion-buttons slot="end">
          <ion-button routerLink="/chess/games" fill="clear">Games</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (notFound()) {
        <ion-card>
          <ion-card-content>
            <p>That game couldn't be found.</p>
            <ion-button routerLink="/chess">Back to Chess</ion-button>
          </ion-card-content>
        </ion-card>
      } @else if (doc(); as doc) {
        @if (viewMode() === 'recap') {
          <ion-note color="medium" class="recap-banner">
            @if (doc.status === 'complete') {
              Finished game — {{ resultSummary() }}
            } @else {
              Read-only view of an in-progress game (reloading the page doesn't
              resume the live clock in this MVP — use the resign buttons below
              to finish it, or start a new game).
            }
          </ion-note>
        }

        <div class="clocks" [class.hidden]="!doc.timeControl">
          <button
            type="button"
            class="clock white"
            [class.active]="turnColorCg() === 'white' && viewMode() === 'live'"
          >
            <span class="label">{{ doc.players.white }}</span>
            <span class="time">{{ whiteClockText() }}</span>
          </button>
          <button
            type="button"
            class="clock black"
            [class.active]="turnColorCg() === 'black' && viewMode() === 'live'"
          >
            <span class="label">{{ doc.players.black }}</span>
            <span class="time">{{ blackClockText() }}</span>
          </button>
        </div>

        <gameboard-chess-board
          [fen]="boardFen()"
          [orientation]="orientation()"
          [turnColor]="turnColorCg()"
          [dests]="destsCg()"
          [lastMove]="lastMove()"
          [check]="checkSig()"
          [viewOnly]="viewMode() === 'recap' || isOver() || computerThinking()"
          (moved)="onBoardMoved($event)"
        />

        <div class="status">
          @if (computerThinking()) {
            <ion-note>Stockfish is thinking…</ion-note>
          } @else if (isOver()) {
            <ion-note color="primary">{{ resultSummary() }}</ion-note>
          } @else {
            <ion-note>
              {{
                turnColorCg() === 'white'
                  ? doc.players.white
                  : doc.players.black
              }}
              to move{{ checkSig() ? ' — check!' : '' }}
            </ion-note>
          }
        </div>

        <!-- Resign is offered for ANY unfinished game — live or an
             in-progress recap after a mid-game reload. Without the recap
             branch a reloaded game was permanently unfinishable (stuck
             "In progress" in the list) despite the banner promising resign. -->
        @if (!isOver()) {
          <div class="actions">
            <ion-button fill="outline" color="danger" (click)="resign('w')"
              >{{ doc.players.white }} resigns</ion-button
            >
            <ion-button fill="outline" color="danger" (click)="resign('b')"
              >{{ doc.players.black }} resigns</ion-button
            >
            @if (viewMode() === 'recap') {
              <ion-button fill="outline" routerLink="/chess"
                >New game</ion-button
              >
            }
          </div>
        }

        @if (isOver()) {
          <div class="actions">
            <ion-button (click)="rematch()">Rematch</ion-button>
            <ion-button fill="outline" routerLink="/chess">New game</ion-button>
          </div>
        }

        <ion-card>
          <ion-card-header>
            <ion-card-title>Moves</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            @if (movePairs().length === 0) {
              <ion-note>No moves yet.</ion-note>
            } @else {
              <ol class="move-list">
                @for (pair of movePairs(); track pair.moveNumber) {
                  <li>
                    <span class="num">{{ pair.moveNumber }}.</span>
                    <span class="san">{{ pair.white?.san }}</span>
                    <span class="san">{{ pair.black?.san }}</span>
                  </li>
                }
              </ol>
            }
            <ion-button size="small" fill="outline" (click)="copyPgn()"
              >Copy PGN</ion-button
            >
            <pre class="pgn">{{ pgnText() }}</pre>
          </ion-card-content>
        </ion-card>
      }
    </ion-content>
  `,
  styles: `
    .recap-banner {
      display: block;
      margin-bottom: 0.5rem;
    }
    .clocks {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    .clocks.hidden {
      display: none;
    }
    .clock {
      flex: 1;
      border: 1px solid var(--ion-color-medium, #92949c);
      border-radius: 8px;
      padding: 0.75rem 0.5rem;
      background: transparent;
      font-family: inherit;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.15rem;
    }
    .clock .label {
      font-size: 0.75rem;
      opacity: 0.7;
    }
    .clock .time {
      font-size: 1.75rem;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
    .clock.active {
      border-color: var(--ion-color-primary, #3880ff);
      background: rgba(56, 128, 255, 0.08);
    }
    .status {
      text-align: center;
      margin: 0.75rem 0;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      justify-content: center;
      margin-bottom: 1rem;
    }
    .move-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
      gap: 0.15rem 1rem;
      padding: 0;
      margin: 0 0 0.75rem;
      list-style: none;
    }
    .move-list li {
      display: flex;
      gap: 0.35rem;
    }
    .move-list .num {
      opacity: 0.6;
      min-width: 1.5rem;
    }
    .pgn {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 0.75rem;
      background: var(--ion-color-light, #f4f5f8);
      border-radius: 6px;
      padding: 0.5rem;
      margin-top: 0.5rem;
      max-height: 10rem;
      overflow: auto;
    }
  `,
})
export class ChessPlayPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastController);
  private readonly stockfish = inject(StockfishService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly gameId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('gameId') ?? '')),
    { initialValue: '' },
  );

  protected readonly doc = signal<ChessGameDoc | null>(null);
  protected readonly notFound = signal(false);
  /** `'live'` — a freshly-created, in-progress game with a ticking clock
   * (the normal path from the hub). `'recap'` — anything read back with
   * moves already in it (a finished game, or an in-progress one reopened
   * after reload): rendered read-only from a replayed chess.js position, with
   * no clock ticking. See the file-header comment for why. */
  protected readonly viewMode = signal<'live' | 'recap'>('live');

  private match: ChessMatch | null = null;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private lastTickAt = 0;

  protected readonly boardFen = signal('start');
  protected readonly turnColorCg = signal<'white' | 'black'>('white');
  protected readonly destsCg = signal<Map<Key, Key[]>>(new Map());
  protected readonly lastMove = signal<readonly [string, string] | null>(null);
  protected readonly checkSig = signal(false);
  protected readonly whiteMs = signal<number | null>(null);
  protected readonly blackMs = signal<number | null>(null);
  protected readonly movePairs = signal<MovePair[]>([]);
  protected readonly isOver = signal(false);
  protected readonly resultSummary = signal('');
  protected readonly computerThinking = signal(false);
  /** The exported PGN text (kept as its own signal — NOT a plain field read
   * from inside `pgnText`'s `computed()` — so the "Copy PGN" text box and
   * export actually stay live as moves are played; a plain-field read gave a
   * computed() zero signal dependencies, so it only ever evaluated once and
   * then never updated, a real bug caught by manual browser testing). */
  private readonly pgnCache = signal('');

  protected readonly modeTitle = computed(() => {
    switch (this.doc()?.mode) {
      case 'vs-computer':
        return 'Vs computer';
      case 'otb':
        return 'OTB clock + record';
      default:
        return 'Chess';
    }
  });

  protected readonly orientation = computed<'white' | 'black'>(() => {
    const d = this.doc();
    return d?.mode === 'vs-computer' && d.vsComputer?.humanColor === 'b'
      ? 'black'
      : 'white';
  });

  protected readonly whiteClockText = computed(() => {
    const ms = this.whiteMs();
    return ms != null ? formatClockDisplay(ms) : '';
  });
  protected readonly blackClockText = computed(() => {
    const ms = this.blackMs();
    return ms != null ? formatClockDisplay(ms) : '';
  });

  protected readonly pgnText = computed(() => this.pgnCache());

  constructor() {
    effect(() => {
      const id = this.gameId();
      if (id) this.load(id);
    });
    this.destroyRef.onDestroy(() => this.stopTicking());
  }

  private load(gameId: string): void {
    this.stopTicking();
    const doc = getChessGame(gameId);
    if (!doc) {
      this.notFound.set(true);
      return;
    }
    this.notFound.set(false);
    this.doc.set(doc);

    if (doc.moves.length === 0 && doc.status === 'in-progress') {
      this.viewMode.set('live');
      this.match = new ChessMatch({
        timeControl: doc.timeControl,
        whiteLabel: doc.players.white,
        blackLabel: doc.players.black,
      });
      this.match.start();
      this.refreshFromMatch();
      this.startTicking();
      this.maybeTriggerComputerMove(doc);
    } else {
      this.viewMode.set('recap');
      this.match = null;
      const chess = new Chess();
      for (const mv of doc.moves) chess.move(mv.san);
      this.boardFen.set(chess.fen());
      this.turnColorCg.set(chess.turn() === 'w' ? 'white' : 'black');
      this.checkSig.set(chess.isCheck());
      const verboseHistory = chess.history({ verbose: true });
      const last = verboseHistory[verboseHistory.length - 1];
      this.lastMove.set(last ? [last.from, last.to] : null);
      this.destsCg.set(new Map());
      this.whiteMs.set(null);
      this.blackMs.set(null);
      this.movePairs.set(toMovePairs(doc.moves));
      this.pgnCache.set(doc.pgn);
      this.isOver.set(doc.status === 'complete');
      this.resultSummary.set(
        doc.status === 'complete' ? resultLabel(doc) : 'In progress',
      );
    }
  }

  private startTicking(): void {
    this.lastTickAt = performance.now();
    this.tickHandle = setInterval(() => {
      const now = performance.now();
      const delta = now - this.lastTickAt;
      this.lastTickAt = now;
      if (!this.match) return;
      this.match.tick(delta);
      this.refreshFromMatch();
      if (this.match.isOver()) this.finalize();
    }, 200);
  }

  private stopTicking(): void {
    if (this.tickHandle != null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  private refreshFromMatch(): void {
    const match = this.match;
    if (!match) return;
    this.boardFen.set(match.fen());
    this.turnColorCg.set(match.turn === 'w' ? 'white' : 'black');
    this.checkSig.set(match.isCheck());
    const verboseHistory = match.chess.history({ verbose: true });
    const last = verboseHistory[verboseHistory.length - 1];
    this.lastMove.set(last ? [last.from, last.to] : null);
    this.destsCg.set(match.legalMovesBySquare() as Map<Key, Key[]>);
    const snap = match.clock?.snapshot();
    this.whiteMs.set(snap ? snap.whiteMs : null);
    this.blackMs.set(snap ? snap.blackMs : null);
    this.movePairs.set(toMovePairs(match.history));
    this.pgnCache.set(match.toPgn());
  }

  protected onBoardMoved(event: ChessBoardMoveEvent): void {
    if (this.viewMode() !== 'live' || this.isOver() || !this.match) return;
    const doc = this.doc();
    if (
      doc?.mode === 'vs-computer' &&
      doc.vsComputer &&
      this.match.turn !== doc.vsComputer.humanColor
    ) {
      return; // not the human's turn — ignore stray drops
    }
    const attempt = this.match.move(event.from, event.to);
    if (!attempt.ok) return;
    this.refreshFromMatch();
    this.persist();
    if (this.match.isOver()) {
      this.finalize();
    } else {
      this.maybeTriggerComputerMove(doc ?? undefined);
    }
  }

  private maybeTriggerComputerMove(doc?: ChessGameDoc): void {
    const d = doc ?? this.doc();
    const vsComputer = d?.vsComputer;
    if (!d || d.mode !== 'vs-computer' || !vsComputer || !this.match) return;
    if (this.match.turn === vsComputer.humanColor) return;
    if (this.match.isOver()) return;
    const level =
      STOCKFISH_LEVELS.find((l) => l.id === vsComputer.levelId) ??
      STOCKFISH_LEVELS[1];
    this.computerThinking.set(true);
    this.stockfish
      .bestMove(this.match.fen(), level)
      .then((mv) => {
        this.computerThinking.set(false);
        if (!mv || !this.match) return;
        const attempt = this.match.move(mv.from, mv.to, mv.promotion ?? 'q');
        if (!attempt.ok) return;
        this.refreshFromMatch();
        this.persist();
        if (this.match.isOver()) this.finalize();
      })
      .catch(() => {
        this.computerThinking.set(false);
      });
  }

  protected resign(color: ChessColor): void {
    if (this.isOver()) return;
    if (this.viewMode() === 'live' && this.match) {
      this.match.resign(color);
      this.refreshFromMatch();
      this.finalize();
      return;
    }
    this.resignFromRecap(color);
  }

  /** Resign an in-progress game reopened in recap mode (after a mid-game
   * reload there is no live ChessMatch), completing the persisted doc
   * directly so the game doesn't stay unfinishable forever. */
  private resignFromRecap(color: ChessColor): void {
    const d = this.doc();
    if (!d || d.status !== 'in-progress') return;
    const updated: ChessGameDoc = {
      ...d,
      status: 'complete',
      result: color === 'w' ? '0-1' : '1-0',
      endReason: 'resignation',
      flaggedOrResignedSide: color,
      updatedAt: Date.now(),
    };
    saveChessGame(updated);
    this.doc.set(updated);
    this.isOver.set(true);
    const winner = color === 'w' ? d.players.black : d.players.white;
    this.resultSummary.set(`${winner} wins by resignation`);
  }

  private persist(): void {
    const d = this.doc();
    const match = this.match;
    if (!d || !match) return;
    const updated: ChessGameDoc = {
      ...d,
      moves: match.history,
      fen: match.fen(),
      pgn: match.toPgn(),
      status: match.isOver() ? 'complete' : 'in-progress',
      result: match.result(),
      endReason: match.endReasonValue(),
      updatedAt: Date.now(),
    };
    saveChessGame(updated);
    this.doc.set(updated);
  }

  private finalize(): void {
    this.stopTicking();
    if (this.doc()?.mode === 'vs-computer') this.stockfish.terminate();
    this.persist();
    this.isOver.set(true);
    this.resultSummary.set(this.match?.resultSummary() ?? 'Game over');
  }

  protected async copyPgn(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.pgnText());
      await this.notify('PGN copied to clipboard', 'success');
    } catch {
      await this.notify('Could not copy PGN', 'danger');
    }
  }

  protected rematch(): void {
    const d = this.doc();
    if (!d) return;
    const gameId = newChessGameId();
    const now = Date.now();
    // Traditional rematch — swap sides, same mode/time control/opponent.
    const swapped: ChessGameDoc = {
      gameId,
      mode: d.mode,
      players: { white: d.players.black, black: d.players.white },
      timeControl: d.timeControl,
      timeControlLabel: d.timeControlLabel,
      moves: [],
      fen: 'start',
      pgn: '',
      status: 'in-progress',
      result: '*',
      endReason: null,
      vsComputer: d.vsComputer
        ? {
            levelId: d.vsComputer.levelId,
            humanColor: d.vsComputer.humanColor === 'w' ? 'b' : 'w',
          }
        : undefined,
      createdAt: now,
      updatedAt: now,
    };
    saveChessGame(swapped);
    void this.router.navigate(['/chess/play', gameId], { replaceUrl: true });
  }

  private async notify(
    message: string,
    color: 'success' | 'danger',
  ): Promise<void> {
    const toast = await this.toasts.create({ message, color, duration: 2500 });
    await toast.present();
  }
}

function resultLabel(doc: ChessGameDoc): string {
  if (doc.result === '1/2-1/2') return 'Draw';
  if (doc.result === '1-0') return `${doc.players.white} won`;
  if (doc.result === '0-1') return `${doc.players.black} won`;
  return 'Game over';
}
