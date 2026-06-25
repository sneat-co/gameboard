# Autonomous build prompt — GameBoard.live game screens

> Paste everything below the line into a fresh Claude Code session started in
> `~/projects/sneat-co/gameboard`. It is self-contained and designed to run
> unattended. Do not answer questions — the agent is told to proceed on
> documented assumptions.

---

You are implementing the GameBoard.live **game screens** frontend, autonomously and to completion, in the repo at `/Users/alexandertrakhimenok/projects/sneat-co/gameboard`. Work continuously without asking me anything — I am asleep. When a decision is genuinely ambiguous, pick the most reasonable option, **log the assumption in your commit message**, and keep going. Only stop for a true hard blocker (a tool/network failure you cannot work around, or a contract that is genuinely unknowable from the repo). Otherwise do not stop until all slices below are built, green, and committed.

## Mission

The backend (event-timeline fold, append, follow, box score) is **live in production** via sneat-go. The 1st-gen frontend that exercised it was deleted; the current app (`frontend/apps/gameboard-app`, Nx + Ionic + Angular + Sneat platform) only implements the **new-game** screen. Rebuild the missing game surfaces on the current scaffolding: **public scoreboard, operator console (timekeeper + scorekeeper), post-game recap, and spectator/follow.**

The plan and salvaged acceptance assets already exist in this repo:
- Master plan + slice plan: `spec/plans/gameboard-live.md` → section **"Frontend Reality & Rebuild"**. Read it first.
- Salvaged reference (DO read, do NOT wire into the build): `docs/legacy-mvp-frontend/`
  - `e2e/{full-game,recap,follow,new-game}.spec.ts` — the original Playwright journeys (acceptance harness; preserve their `data-testid`s).
  - `src/contract.ts` — `GameState` shape + helpers `inBonus`, `publicPlayerLabel`, `sourceFor`, `newEventID`, plus `EventType`/`GameEvent`/`AppendResponse`.
  - `src/app.component.ts` / `src/api.service.ts` — the cohesive console+scoreboard UI logic + exact endpoint shapes.

## Read these before writing code (in order)
1. `spec/plans/gameboard-live.md` (the "Frontend Reality & Rebuild" + slice plan).
2. `docs/legacy-mvp-frontend/src/contract.ts` and `src/app.component.ts` and `src/api.service.ts`.
3. `docs/legacy-mvp-frontend/e2e/full-game.spec.ts`, `recap.spec.ts`, `follow.spec.ts`.
4. Current app: `frontend/apps/gameboard-app/src/app/app.routes.ts`, `app/game.service.ts`, `app/new-game/new-game-page.component.ts` (the Ionic + signal patterns to mirror), `app/new-game/game-contract.ts`.
5. E2E setup: `frontend/apps/gameboard-app-e2e/playwright.config.ts` + `Caddyfile` (current webServer — you will replace/augment it to boot the emulator + `gameboardd`).
6. Real backend for E2E: `backend/cmd/gameboardd/main.go` (`devIdentity` + `GAMEBOARD_STATIC_DIR`), `docs/legacy-mvp-frontend/e2e/run-server.sh` (the same-origin recipe), and the Firestore wiring in `backend/gameboard/store_dalgo.go` + the `*_test.go` files (how the emulator-backed dalgo DB is constructed).

## Environment & how to run (all frontend commands from `frontend/`)
- Package manager **pnpm** (local pnpm 11.x). Build: `npx nx build gameboard-app`. Unit tests: `pnpm exec nx test gameboard-app`. E2E: `pnpm exec nx e2e gameboard-app-e2e`.
- App is served under the **`/app/`** base href; routes are `/app/...`. baseHref is `/app/`.
- **`nx build` caches CSS** — pass `--skip-nx-cache` if a style/test result looks stale.
- Pre-existing noise you must IGNORE (not failures): `app.spec.ts` emits `window.matchMedia`/ion-split-pane "unhandled errors" in jsdom and Firestore-offline warnings; the suite still exits 0 (`NX Successfully ran target test`). A clean run is "Tests: N passed" + exit 0 even with those 2 unhandled errors.

## DECISIONS ALREADY MADE — do not ask, do not deviate
1. **E2E is REAL full-stack — no HTTP mocking.** Each screen's E2E drives the real chain: browser UI → `GameService`/`SneatApiService` → **`gameboardd`** (this repo's Go backend at `backend/cmd/gameboardd`) → **dalgo → Firestore emulator** → fold → read-side render. `gameboardd` already has a DEV-ONLY `devIdentity` (every request = `dev-user`, writes allowed — built for exactly this E2E) and can **serve the built SPA same-origin** via `GAMEBOARD_STATIC_DIR` (no CORS), exactly as `docs/legacy-mvp-frontend/e2e/run-server.sh` did. **You must:** (a) add a Firestore-emulator store to `gameboardd` — when `FIRESTORE_EMULATOR_HOST` is set, use a Firestore-backed dalgo DB instead of `dalgo2memory` (the documented TODO in `main.go`; mirror the firestore wiring in `backend/gameboard/*_test.go`); (b) replace the gameboard E2E `webServer`/add a Playwright `globalSetup` that starts the **Firestore emulator** (`firebase emulators:start --only firestore`, or the `gcloud`/`firebase-tools` Firestore emulator — add a minimal `firebase.json` + demo project if none exists), builds the SPA, and starts `gameboardd` with `FIRESTORE_EMULATOR_HOST` + `GAMEBOARD_STATIC_DIR=<dist>` serving same-origin; point Playwright `baseURL` at it. Do NOT mock `api4gameboard` calls. (Real Firebase **token** validation is a prod/sneat-go concern; `devIdentity` means E2E needs no signed-in session — the Firestore-emulator span is what these prove.)
2. **Service layer uses `SneatApiService`, not raw HttpClient.** Extend `GameService` (`app/game.service.ts`) mirroring its existing `createGame` (`this.api.post('api4gameboard/games', …)`):
   - `appendEvent(gameID, event): Promise<AppendResponse>` → `this.api.post('api4gameboard/games/{id}/events', event)` (authenticated; SneatApiService sends the Firebase token).
   - `getState(gameID): Promise<GameState>` → **public read**, use `this.api.getAsAnonymous(...)` against `api4gameboard/games/{id}/state` (inspect SneatApiService for the exact anonymous-GET method/signature and follow it).
   - `follow(targetType, targetID): Promise<unknown>` → `this.api.post('api4gameboard/follows', {targetType, targetID})` (authenticated; the Firebase token replaces the legacy `X-Account-Id` stub). Anonymous → backend 401.
   Build the event payload like legacy `api.service.ts append()` (fill `eventID` via `newEventID()`, `source` via `sourceFor(type)`, `wallClockMs`, etc.).
3. **Contract types live where `GameService` already imports.** `GameService` imports from `./new-game/game-contract`. Add the **event/state half** (`GameState`, `GameStatus`, `EventType`, `GameEvent`, `Source`, `ClockAction`, `AppendResponse`, and helpers `inBonus`, `publicPlayerLabel`, `sourceFor`, `newEventID`) into a sibling app-local module (create `app/game/game-state.ts`) and re-export, OR add to `new-game/game-contract.ts` — keep ONE source of truth and reuse the existing `Side`/`GameRecord`. Do NOT duplicate types into `libs/extensions/gameboard/contract` (leave that lib alone).
4. **Pages are app components, not new Nx libs.** Put them under `frontend/apps/gameboard-app/src/app/game/`: `scoreboard/`, `console/`, `recap/`, plus follow UI on the scoreboard/spectator. Do NOT do the `-internal` lib refactor (explicitly deferred).
5. **Routes** (add to `app.routes.ts`, all public/no-guard except where noted):
   - `g/:gameID` → ScoreboardPageComponent (public). Supports `?display=big` big-screen mode.
   - `g/:gameID/console` → ConsolePageComponent (timekeeper + scorekeeper in one surface; signed-in users; no role-gating UI for now).
   - `g/:gameID/recap` → RecapPageComponent (public).
6. **Preserve the legacy `data-testid`s** on the new Ionic elements so the salvaged E2Es port near-verbatim. Required ids (from `full-game.spec.ts`/`recap.spec.ts`/`follow.spec.ts`): `go-live, period-1, clock-start, clock-stop, clock-running, clock, status, period, score-home, score-away, home-ft, home-2, home-3, away-2, away-foul, home-bonus, sub-home, timeout-home, possession-away, possession, oncourt-home, final, scoreboard, recap, recap-line, follow-home, account-id, follow-status`. Add a `home-2-by-p1` style attributed-score control (points + assist) as in the legacy console.
7. **Roster/minor-safety:** carry the legacy `DEMO_ROSTER` stub forward (real roster needs the absent `sneat-team` substrate). Use `publicPlayerLabel` for on-court + box-score names (no-consent minor → jersey only).
8. **Live updates:** after each console append, re-fetch `getState` and re-render (polling). No websockets. The scoreboard may poll `getState` on an interval.
9. **Styling:** Ionic components + the repo's design tokens. The scoreboard panel + big-screen mode are the dark "scoreboard moment" — use `--gb-score-bg`/`--gb-score-bg-top`/`--gb-clock`/`--gb-score-home`/`--gb-score-away` (DSEG-style mono digits via `--gb-font-score`). App primary is the emerald `--ion-color-primary`. Functional and clean; not pixel-perfect.
10. **Follow signed-in path:** the E2E harness has no auth, so (as `new-game` does) E2E only asserts the **anonymous → rejected** path; cover the signed-in follow logic with a **component/unit test** that stubs `GameService.follow`. Note this in the recap of that slice.

## Slices — build in order; each adds a screen AND extends ONE growing full-game-lifecycle E2E chain

The E2E specs accumulate into a single full-game lifecycle scenario via a **shared lifecycle helper** (create → go-live → period/clock → score FT/+2/+3 (+assist) → fouls→bonus → sub → timeout → possession → final → scoreboard==fold → recap → follow). Each slice asserts its own segment against the **real stack** (decision 1); the umbrella spec replays the whole chain. Unit tests cover isolated logic only (helpers; a component given a fixed `GameState` with a stubbed `GameService`).

- **Slice 0 — contract + service + E2E harness.** Forward-port event/state types + helpers (decision 3); extend `GameService` (decision 2); add the Firestore-emulator store to `gameboardd` + stand up the real-stack Playwright harness + the shared lifecycle helper (decision 1). Unit-test helpers (port `docs/legacy-mvp-frontend/src/contract.spec.ts`). **Chain gate:** a smoke E2E that creates a game through the real stack and reads `GET /state` back from the emulator.
- **Slice 1 — new-game segment** (screen exists). **Chain gate:** real create → game persisted in the emulator → record read back (first link).
- **Slice 2 — public scoreboard** (`g/:gameID`, `?display=big` dark). Render the fold from `getState` (score, status, period, clock, fouls + bonus flip, timeouts, possession, on-court minor-safe). **Chain gate:** seed events via **real appends**, assert the board equals the fold (incl. bonus + minor-safe `#23`-only); plus a component unit test.
- **Slice 3 — console** (`g/:gameID/console`). Buttons → real `appendEvent` (go-live, period, clock start/stop/adjust, possession, timeout, foul, FT/+2/+3, attributed score-with-assist, sub); re-read `getState` after each. **Chain gate (core drive):** extend the chain to go-live → clock → score(+assist) → fouls→bonus → sub → timeout → possession → final, asserting the scoreboard reflects each — through the real stack. Preserve all testids.
- **Slice 4 — recap** (`g/:gameID/recap`). Final score, score-by-period if present, box score (points→assists→minutes), minor-safe. **Chain gate:** extend to final → recap box score.
- **Slice 5 — spectator/follow.** Follow control. **Chain gate:** anonymous follow → real backend 401. Signed-in follow edge: **unit test** stubbing `GameService.follow` (decision 10; real Auth-emulator sign-in deferred).
- **Umbrella — full-game lifecycle E2E.** The complete chain across every screen (the salvaged `full-game.spec.ts` reborn on the real stack) — the MVP release gate; keep green.

## Per-slice protocol
1. Implement on a branch `feat/game-screens` (create it from current `main` at start; see Git rules).
2. Write/adapt the test(s) and the component together; run `pnpm exec nx test gameboard-app` and `pnpm exec nx e2e gameboard-app-e2e` until green (build first if needed).
3. Commit with a message naming the slice and **any assumptions you made**. Use the trailer:
   `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
4. Append a one-line status to `docs/legacy-mvp-frontend/REBUILD-LOG.md` (create it) per slice: what landed, tests passing, assumptions, anything deferred.

## Git rules (IMPORTANT — do not deploy)
- Work on branch **`feat/game-screens`**. **Never commit to or push `main`** — pushing `main` triggers a Cloudflare production deploy. Pushing the feature branch is fine.
- The working tree has **pre-existing uncommitted changes you did NOT make** (`landings/src/components/Header.astro`, `Footer.astro`). **Do not stage, commit, revert, or touch them.** Only `git add` files you create/modify for the game screens, by explicit path.
- At the end, push `feat/game-screens` and open a **draft PR** to `main` (`gh pr create --draft`) summarizing the slices, test evidence, and every logged assumption + anything deferred. Do not merge.

## Out of scope (do NOT build; note as deferred in the PR)
- coach-console request→confirm, consensus-scoring, learn-to-score, role-invites, the bot, predictions/MVP-voting/badges/live-reactions.
- The `-internal` Nx lib refactor; real roster/consent (`sneat-team`); true live-stream subscription (polling is fine); real role authority (backend stub stays).
- `landings/`, `design/`, `spec/`, and `docs/legacy-mvp-frontend/src|e2e` (reference only — never edit).
- **`backend/` is mostly off-limits** — the ONLY allowed backend change is adding the Firestore-emulator store selection to `backend/cmd/gameboardd/main.go` (decision 1). Do not touch the backend's domain logic, handlers, service, or Go tests beyond what that swap needs; keep its existing tests green (`cd backend && go test ./...`).

## Definition of done
All five slices implemented; `pnpm exec nx test gameboard-app` and `pnpm exec nx e2e gameboard-app-e2e` green; per-slice commits on `feat/game-screens` with logged assumptions; `REBUILD-LOG.md` written; branch pushed and a draft PR opened. If you hit the genuine hard-blocker bar, commit what's green, write the blocker + everything you tried into `REBUILD-LOG.md` and the PR description, and stop.
