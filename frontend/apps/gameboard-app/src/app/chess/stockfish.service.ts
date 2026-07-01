// Web Worker wrapper around the stockfish npm package's lite/single-threaded
// WASM build (MVP scope item 2 — vs computer). Deliberately the
// lite-single-threaded flavour (~7MB) rather than the full multi-threaded
// engine (>100MB, requires COOP/COEP cross-origin-isolation headers this app
// doesn't set) — see node_modules/stockfish/README.md's own recommendation.
//
// The worker script + its sibling .wasm are copied to
// apps/gameboard-app/public/stockfish/ (served at /stockfish/*) rather than
// wired through the Angular CLI's `new Worker(new URL(...))` module-worker
// syntax, because this is a plain Emscripten-generated classic worker script,
// not an ES module — `new Worker(url)` + string postMessage/onmessage (the
// engine's own documented UCI-over-postMessage protocol) is the correct usage.
//
// NOT unit-tested: it owns a real browser Worker + WASM runtime, which jsdom
// (the vitest environment) doesn't provide. The protocol logic it depends on
// (stockfish-uci.ts) IS unit-tested. This service is exercised manually via
// `nx serve` (see the vs-computer chess page).

import { inject, Injectable, NgZone } from '@angular/core';
import {
  parseBestMoveLine,
  uciGoCommand,
  uciPositionCommand,
  uciSetSkillCommand,
  type ParsedBestMove,
  type StockfishLevel,
} from './stockfish-uci';

const STOCKFISH_WORKER_URL = '/stockfish/stockfish-18-lite-single.js';

@Injectable({ providedIn: 'root' })
export class StockfishService {
  private readonly zone = inject(NgZone);
  private worker: Worker | null = null;
  private uciReady: Promise<void> | null = null;

  /** Ask Stockfish for its best move from `fen` at the given strength level.
   * Resolves to `null` if there is no legal move (shouldn't happen — callers
   * only invoke this when it's the engine's turn and the game isn't over). */
  public async bestMove(
    fen: string,
    level: StockfishLevel,
  ): Promise<ParsedBestMove | null> {
    const worker = this.ensureWorker();
    await this.ensureUciReady(worker);
    return this.zone.runOutsideAngular(
      () =>
        new Promise<ParsedBestMove | null>((resolve) => {
          const onMessage = (e: MessageEvent<string>) => {
            if (typeof e.data !== 'string') return;
            const parsed = parseBestMoveLine(e.data);
            if (parsed || /^bestmove\s+\(none\)/.test(e.data.trim())) {
              worker.removeEventListener('message', onMessage);
              resolve(parsed);
            }
          };
          worker.addEventListener('message', onMessage);
          worker.postMessage(uciSetSkillCommand(level));
          worker.postMessage(uciPositionCommand(fen));
          worker.postMessage(uciGoCommand(level));
        }),
    );
  }

  /** Free the worker + WASM instance (call on leaving the vs-computer page). */
  public terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.uciReady = null;
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(STOCKFISH_WORKER_URL);
    }
    return this.worker;
  }

  private ensureUciReady(worker: Worker): Promise<void> {
    if (!this.uciReady) {
      this.uciReady = this.zone.runOutsideAngular(
        () =>
          new Promise<void>((resolve) => {
            const onMessage = (e: MessageEvent<string>) => {
              if (typeof e.data === 'string' && e.data.includes('uciok')) {
                worker.removeEventListener('message', onMessage);
                resolve();
              }
            };
            worker.addEventListener('message', onMessage);
            worker.postMessage('uci');
          }),
      );
    }
    return this.uciReady;
  }
}
