// Angular wrapper around chessground (Lichess's board UI) — MVP scope item 1
// ("Playable board"). This component owns ONLY board rendering + drag/drop
// input; all chess rules (legal moves, check/mate/stalemate/draw, SAN/FEN/PGN)
// come from chess.js via ChessMatch (chess-match.ts) — this component is fed
// the resulting FEN/turn/legal-destinations and emits a plain
// `{ from, to }` when the user drops a piece; the host page (chess-play-page)
// decides whether that's a legal move worth applying (via ChessMatch.move) and
// whether a promotion piece needs to be asked for.
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Chessground } from 'chessground';
import type { Api as ChessgroundApi } from 'chessground/api';
import type { Config as ChessgroundConfig } from 'chessground/config';
import type { Key } from 'chessground/types';

export interface ChessBoardMoveEvent {
  readonly from: string;
  readonly to: string;
}

@Component({
  selector: 'gameboard-chess-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="board-shell">
      <div #boardEl class="board"></div>
    </div>
  `,
  styles: `
    .board-shell {
      width: min(92vw, 480px);
      margin: 0 auto;
    }
    .board {
      width: 100%;
      aspect-ratio: 1 / 1;
    }
  `,
})
export class ChessBoardComponent implements AfterViewInit {
  private readonly boardEl =
    viewChild.required<ElementRef<HTMLElement>>('boardEl');

  public readonly fen = input.required<string>();
  public readonly orientation = input<'white' | 'black'>('white');
  public readonly turnColor = input<'white' | 'black'>('white');
  public readonly dests = input<Map<Key, Key[]>>(new Map());
  public readonly lastMove = input<readonly [string, string] | null>(null);
  public readonly check = input(false);
  /** true once the game is over / for a read-only spectator view — no drag. */
  public readonly viewOnly = input(false);

  public readonly moved = output<ChessBoardMoveEvent>();

  private api: ChessgroundApi | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.api?.destroy());

    // Standard Angular signal-interop pattern for wrapping an imperative
    // library (chessground): an effect() registered in the constructor
    // doesn't run synchronously — it's flushed after the initial change
    // detection pass, i.e. AFTER ngAfterViewInit has already created `api`
    // and AFTER inputs are bound — so every read of fen()/turnColor()/
    // dests()/lastMove()/check()/viewOnly() below re-syncs the live board
    // whenever the host updates any of them (e.g. after ChessMatch.move()).
    effect(() => this.api?.set(this.buildConfig()));
  }

  public ngAfterViewInit(): void {
    this.api = Chessground(this.boardEl().nativeElement, this.buildConfig());
  }

  private buildConfig(): ChessgroundConfig {
    const last = this.lastMove();
    return {
      fen: this.fen(),
      orientation: this.orientation(),
      turnColor: this.turnColor(),
      check: this.check(),
      viewOnly: this.viewOnly(),
      lastMove: last ? ([last[0], last[1]] as Key[]) : undefined,
      movable: {
        free: false,
        color: this.viewOnly() ? undefined : this.turnColor(),
        dests: this.dests(),
        showDests: true,
        events: {
          after: (orig, dest) => this.moved.emit({ from: orig, to: dest }),
        },
      },
      highlight: { lastMove: true, check: true },
      animation: { enabled: true, duration: 200 },
    };
  }
}
