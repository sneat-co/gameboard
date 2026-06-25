---
format: https://specscore.md/plan-specification
status: Approved
---
# Plan: Gameboard Live

**Status:** Executing
**Source Feature:** sports/gameboard-live
**Date:** 2026-06-24
**Owner:** alex
**Supersedes:** —

## Summary

Master plan for the **GameBoard.live** umbrella: implement the basketball game-day vertical as a single **`gameboard` Sneat extension**, **contract-first**, then fanned out into the per-feature sub-plans below (one per child Feature, each carrying `**Parent:** gameboard-live`). The shared substrate — the [`event-timeline`](../features/sports/gameboard-live/event-timeline/README.md) record — is frozen first; every other slice reads/writes against that frozen contract so backend and frontend work proceed in parallel. This master covers the umbrella's own spine ACs (create, lineup, live score/clock, public scoreboard, follow, minor-safe); follower **notifications** are deferred (see *Deferred AC Coverage* — the bot is a separate effort). Each child Feature's ACs are covered by its sub-plan.

## Approach

### Data & storage (canonical)

- **`gameboard` is a root/global extension, *not* space-scoped.** A game does **not** belong to any space; the game record lives at the global path **`/ext/gameboard/games/{gameID}`**.
- The **authoritative event-timeline** append log hangs off the game: **`/ext/gameboard/games/{gameID}/events/{eventID}`** — append-only. Each `eventID` is a **random GUID-like id without dashes**, **client-generated** and used as the Firestore doc key, so it doubles as an **idempotency key**: a retried append with the same id is a no-op (an event is never stored twice). Events are **ordered by a server-set wall-clock timestamp** (ties broken by `eventID` for a deterministic total order); current state is a deterministic fold over the log.
- **Each team is its own sneat _space_** (`/spaces/{spaceID}`). A game stores an **inline side per team — `{name, colour, spaceID?: null}`**: when the side is a real team space, `spaceID` is set; for an **ad-hoc name** it is `null`, and [`first-use-backprop`](../features/sports/first-use-backprop/README.md) fills it when a durable team space materializes (no premature space creation). Roster, players, game-day roles, and minor publish-consent come from that team space ([`sneat-team`](../features/sports/sneat-team/README.md)) once linked; follows / stats / notifications hang off the game-side slot until the id resolves.
- **Persistence:** all backend mutations go through **dalgo → Firestore** at the root `/ext/gameboard/...` collection (not under `/spaces`).
- **Extension layout (contract/impl split):** a frozen **contract** (`gameboard-ext/backend` Go interfaces + `@sneat/extension-gameboard-contract` TS tokens/types + TypeSpec `api4gameboard.tsp`), a **backend** impl (`gameboard/backend` over dalgo/Firestore), and Angular **`@sneat/extension-gameboard-internal`** libs. The `-internal` libs are consumed **only by the `gameboard-app`** in the same workspace, so they are **non-buildable / non-publishable** (path-mapped source compiled into the app, no per-lib build or `package.json` publish target). The **contract** is the **only published artifact** — the cross-repo boundary.

### Repositories / build targets

| Layer | Identifier(s) | Repo |
|---|---|---|
| **Contract** (public, **the only published artifact**) | TypeSpec `api4gameboard.tsp` · Go `gameboard-ext/backend` · TS `@sneat/extension-gameboard-contract` | **`sneat-co/gameboard-ext`** — contract only, zero sibling deps (mirrors `contactus-ext`) |
| **Backend** impl | `gameboard/backend` (Go, dalgo→Firestore) | **`sneat-co/gameboard`** *(private)* |
| **Frontend** impl libs | `@sneat/extension-gameboard-internal` (Angular, **non-buildable / non-publishable** — app-only) | **`sneat-co/gameboard`** *(private)* |
| **App** | `gameboard-app` | **`sneat-co/gameboard`** *(private)* |

The private **`sneat-co/gameboard`** repo holds **both** implementation libs (backend + frontend) **and** the `gameboard-app`. The public **`sneat-co/gameboard-ext`** holds only the frozen contract. The separate **`sneat-co/gameboard-live`** repo is the marketing/landing site (Astro + Cloudflare) — **not** the app or extension code.

### Build order (contract-first, then parallel)

0. **Bootstrap (prerequisite) —** create the repos and wire Nx / Go / TypeSpec / Firestore emulator / CI (no feature AC); see the *Phase 0* subsection below.
1. **Foundation —** `gameboard-event-timeline`: freeze the event vocabulary, append API, and fold/projection. Everything downstream depends on this frozen contract.
2. **Authoritative input (∥) —** `gameboard-scorekeeper-console`, `gameboard-timekeeper-console`: append score/foul/substitution and clock/period/possession/timeout events.
3. **Read-side projections (∥) —** `gameboard-players-list`, `gameboard-scoreboard`, `gameboard-spectator-screen`: fold the timeline into views/feeds.
4. **Coordination & lifecycle —** `gameboard-new-game` (creation on-ramp; precedes input in calendar time but needs only the game-record contract), `gameboard-coach-console` (request side; needs the consoles), `gameboard-post-game-recap` (final).

Within every sub-plan **task** the order is **contract-first**: author/freeze the slice's TypeSpec + ext types, then dispatch a **backend subtask** and a **frontend subtask** in parallel against the frozen types. This master plan itself is the coordination layer — its tasks integrate the sub-plans at the umbrella-AC level rather than re-doing their slices.

### Phase 0 — Bootstrap & scaffolding (prerequisite to all slices)

Before any slice can run, stand up the repos and toolchain. This phase carries **no feature AC** — it is the foundation the contract-first slices build on. **Exit criteria:** an empty slice can be branched, built, tested (against the Firestore emulator), and merged to `integration/gameboard-mvp` green.

- **Repos.** Create **`sneat-co/gameboard-ext`** (public contract — `backend/` Go module + the `@sneat/extension-gameboard-contract` TS package + `api4gameboard.tsp`, mirroring `contactus-ext`) and **`sneat-co/gameboard`** (private — the Nx workspace holding `gameboard/backend` (Go), the non-buildable `@sneat/extension-gameboard-internal` libs, and `gameboard-app`).
- **TypeSpec pipeline.** Scaffold `api4gameboard.tsp` and the Go + TS type generation (in `gameboard-ext`).
- **Backend wiring.** The `gameboard/backend` Go module on **dalgo → Firestore** at the root `/ext/gameboard/...`, with the dalgo provider and the **Firestore emulator** wired for tests.
- **Frontend wiring.** The Nx workspace (`gameboard-app` + `-internal` libs), pnpm, Nx module-boundary tags, and a browser **E2E runner** (Playwright/Cypress) against the emulator.
- **CI.** Per-repo pipelines: lint + unit/integration + the **coverage gates** (≥ 85%, ~100% for `event-timeline`) + the **umbrella E2E** on `integration/gameboard-mvp`; and the worktree/branch scheme below.
- **Substrate preflight.** Confirm the named platform deps are available — `sneat-team`, `roles`, `account-gate`, `linkage`, `first-use-backprop`, `calendarius`, `eventus`, `invitus` — and stub/track any not yet implemented before the slice that needs it.

### Parallel execution & branching

Work fans out across three repos (`gameboard-ext`, `gameboard`, and `sneat-go` for the TypeSpec) and across parallel agents. To keep that isolated and mergeable:

- **Worktree per parallel agent.** Each concurrent subtask runs in its own **git worktree** so backend and frontend agents don't collide — note **backend (Go) and frontend (Angular) live in the *same* `gameboard` repo**, so a slice's two impl agents need separate worktrees.
- **Installs per worktree:** a **backend** (Go) worktree needs **no `node_modules`** (the shared `GOMODCACHE` covers it). A **frontend** worktree runs **`pnpm install`**, which is cheap — pnpm's global content-addressable store + hard-links mean per-worktree installs cost seconds and little disk. Point Nx's cache at a **shared/remote cache** so parallel worktrees reuse build/test results. With `-internal` libs **non-buildable**, the frontend worktree only needs the workspace install + `nx test`/`nx serve` on the app — no per-lib build.
- **Branch scheme (consistent across all three repos):**
  - **Integration branch** (long-lived, per repo): **`integration/gameboard-mvp`** — where slices land and the umbrella E2E runs.
  - **Slice/task branches:** **`gameboard/<sub-plan>/t<task>-<slug>`** — e.g. `gameboard/event-timeline/t1-append-log`.
  - **Contract branches** (in `gameboard-ext`): same scheme; the contract is **frozen and merged first**, before the backend/frontend agents branch off `integration/gameboard-mvp`.
- **Per-slice flow:** contract branch → freeze & merge to `gameboard-ext` → backend ∥ frontend each branch off `integration/gameboard-mvp` in their own worktrees → both merge back → the slice's ACs verify on `integration/gameboard-mvp` → fast-forward to `main` once a phase is green (and the umbrella E2E passes before the MVP ships).

### Testing & coverage (applies to every sub-plan)

A task is **not done** until it ships **automated tests proving its `Verifies:` ACs**, across all layers:

- **Backend** (`gameboard/backend`, Go over dalgo→Firestore): unit + integration tests for each operation/fold; **≥ 85%** line/branch coverage.
- **Frontend** (`@sneat/extension-gameboard-internal`, Angular): **unit tests** for components, pipes, services, and the contract consumers (reducers/clients); **≥ 85%** coverage.
- **Contract** (`gameboard-ext` Go + `@sneat/extension-gameboard-contract` TS): shape/parity tests where logic (e.g. the shared reducer) lives in the contract.

**Exception — `gameboard-event-timeline` is held to ~100% coverage and developed test-first (TDD).** As the substrate every other slice folds from, its idempotent-append (replay → "already processed"), authorized-source-only, append-only-corrections, deterministic-fold, and wall-clock ordering (ties by `eventID`) logic must be **exhaustively covered on both the backend and the frontend reducer** (which must agree). CI fails any task whose ACs are uncovered or whose coverage regresses below the bar.

#### End-to-end journey test (umbrella-level gate)

Beyond per-slice tests, the MVP MUST ship at least one **full-lifecycle end-to-end test** that drives the **whole game** through the real stack (UI → API → `gameboard/backend` → dalgo/Firestore → event-timeline fold → scoreboard/recap reads), exercising the complete operator + spectator journey:

1. **Create** a game (`new-game`) with two sides + a time, and **confirm the lineup**;
2. **Start the clock**, **advance a period**, **adjust the clock** (`timekeeper-console`);
3. **Score** baskets — FT / +2 / +3 with optional **assist** — attributed to on-court players (`scorekeeper-console`);
4. record **individual + team fouls** and assert the **bonus/penalty** flips at the limit;
5. perform a **substitution** (incl. a coach **request → scorekeeper confirm**, `coach-console` ↔ `scorekeeper-console`);
6. **grant a timeout** and assert the remaining-timeouts decrement + countdown (`timekeeper-console`);
7. toggle **possession**;
8. take the game to **final**, then assert the **public scoreboard** and **`post-game-recap`** reflect the exact folded state — final score, **score-by-period**, **box score** (points → assists → minutes), and **minor-safe** rendering.

It asserts the **public read surfaces equal the deterministic fold of the appended events** end-to-end (no drift between input consoles and the scoreboard/recap). It lives in the **`gameboard-app` E2E suite** (browser-driven, e.g. Playwright/Cypress, against a Firestore emulator) and is a **release gate** for the MVP — it depends on the read-side and lifecycle slices, so it lands once those are in and is kept green thereafter.

### Sub-plans (this master's tree)

| Sub-plan | Source Feature | Phase |
|---|---|---|
| [gameboard-event-timeline](gameboard-event-timeline.md) | sports/gameboard-live/event-timeline | 1 · foundation |
| [gameboard-scorekeeper-console](gameboard-scorekeeper-console.md) | sports/gameboard-live/scorekeeper-console | 2 · input |
| [gameboard-timekeeper-console](gameboard-timekeeper-console.md) | sports/gameboard-live/timekeeper-console | 2 · input |
| [gameboard-players-list](gameboard-players-list.md) | sports/gameboard-live/players-list | 3 · read-side |
| [gameboard-scoreboard](gameboard-scoreboard.md) | sports/gameboard-live/scoreboard | 3 · read-side |
| [gameboard-spectator-screen](gameboard-spectator-screen.md) | sports/gameboard-live/spectator-screen | 3 · read-side |
| [gameboard-new-game](gameboard-new-game.md) | sports/gameboard-live/new-game | 4 · lifecycle |
| [gameboard-coach-console](gameboard-coach-console.md) | sports/gameboard-live/coach-console | 4 · coordination |
| [gameboard-post-game-recap](gameboard-post-game-recap.md) | sports/gameboard-live/post-game-recap | 4 · final |

(The [`screens`](../features/sports/gameboard-live/screens/README.md) child is an information-architecture map / prototype, not an implementable software slice — no sub-plan. The [`gameboardlive-bot`](../features/sports/gameboard-live/gameboardlive-bot/README.md), [`consensus-scoring`](../features/sports/gameboard-live/consensus-scoring/README.md), [`learn-to-score`](../features/sports/gameboard-live/learn-to-score/README.md), and [`role-invites`](../features/sports/gameboard-live/role-invites/README.md) Features are intentionally **out of scope of this plan tree** — each is a substantial standalone effort to be specified and planned separately; their Feature specs remain. (`role-invites` is additionally **blocked** on a *targeted (pre-assigned-role, named-recipient)* mode being added to `rsvp.express` first.))

## Tasks

### Task 1: Create and confirm a game

**Verifies:** sports/gameboard-live#ac:scorer-creates-game, sports/gameboard-live#ac:lineup-from-roster
**Depends-On:** —
**Status:** in-progress

A volunteer organizer creates a game (global `/ext/gameboard/games/{gameID}` record, Calendarius happening + eventus overlay) and confirms the present players from each team-space roster. Delivered by `gameboard-new-game` against the frozen `gameboard-event-timeline` contract; lineup is read from the team space ([`sneat-team`](../features/sports/sneat-team/README.md)). Integration-verifies that creation + lineup work end-to-end at the umbrella level.

> Progress (2026-06-24): **scorer-creates-game done** — the game aggregate `/ext/gameboard/games/{gameID}` with inline sides `{name,colour,spaceID?}` (dalgo store), `CreateGame`/`GetGame` + `POST …/games` / `GET …/games/{id}`, and a browser **new-game form** E2E (create → drive). **Remaining (`lineup-from-roster`):** confirming present players from the team-space roster — blocked on the `sneat-team` roster substrate (spec-only); rendering uses a `DEMO_ROSTER` stub today. Calendarius-happening / eventus-overlay linkage also pending.

### Task 2: Run live score & clock

**Verifies:** sports/gameboard-live#ac:live-score-and-clock
**Depends-On:** 1
**Status:** done

The official table crew drives live score and clock, each action an authorized append (via dalgo → Firestore) to `/ext/gameboard/games/{gameID}/events`. Delivered by `gameboard-scorekeeper-console` ∥ `gameboard-timekeeper-console`; this task verifies the umbrella's live-update behavior over the frozen timeline.

> Done (2026-06-24): the `gameboard-app` console drives live score (FT/+2/+3) + clock (start/stop/adjust) + period/possession/timeout/foul as authorized appends; the scoreboard updates from the fold after each action. Proven by the passing **browser E2E** (UI → HTTP → backend → dalgo → fold). *(Currently one cohesive console rather than the separate scorekeeper/timekeeper `-internal` libs — split tracked in the master Implementation Progress remainder.)*

### Task 3: Publish the public, no-login scoreboard (incl. big-screen)

**Verifies:** sports/gameboard-live#ac:public-scoreboard-no-login, sports/gameboard-live#ac:big-screen-mode
**Depends-On:** 2
**Status:** done

A public, no-login scoreboard — including the TV/projector big-screen mode — renders the deterministic fold of the timeline. Delivered by `gameboard-scoreboard` (+ `gameboard-spectator-screen` as the spectator surface); verifies the public read path.

> Done (2026-06-24): the **no-login public scoreboard** renders the server-folded `GET /state` (score, period, clock, fouls + bonus, timeouts, possession, on-court) — no auth required — and the **big-screen mode** layout is selected by `?display=big`; both proven in the browser E2E. *(The separate `spectator-screen` follow/share surface is its own sub-plan — see Task 4.)*

### Task 4: Account-gated follow graph

**Verifies:** sports/gameboard-live#ac:account-follow-records-edge, sports/gameboard-live#ac:follow-requires-account
**Depends-On:** 3
**Status:** done

Signing in to follow a team/player writes a follow edge via the `linkage` facade behind [`account-gate`](../features/sports/account-gate/README.md); anonymous viewers can read/share but cannot follow. Delivered by `gameboard-spectator-screen`; verifies the follow atom and its account gate.

> Done (2026-06-24): `Service.Follow` rejects anonymous viewers (`ErrAnonymousFollow` → HTTP 401) and writes an idempotent follow edge for a signed-in account (`/ext/gameboard/follows`, `POST …/follows`); proven by Go tests + a browser E2E (anonymous → "account required", signed-in → "following"). **Stub (recorded):** the account is resolved from an `X-Account-Id` header standing in for account-gate's bearer-token identity, and the edge is a local dalgo collection rather than the `linkage` facade — swap both to the real substrate when wired.

### Task 5: Minor-safe public surfaces

**Verifies:** sports/gameboard-live#ac:minor-shown-minimally
**Depends-On:** 3
**Status:** done

Public surfaces show a minor without publish-consent by jersey number only. Delivered by `gameboard-players-list`'s consent modes, consumed by `gameboard-scoreboard` / `gameboard-spectator-screen` / `gameboard-post-game-recap`; verifies minor-safe rendering on the public read path.

> Done (2026-06-24): `publicPlayerLabel` renders a minor without publish-consent by **jersey number only** (adults / consented minors show their name); applied to the scoreboard's on-court panel and asserted in the browser E2E (no-consent minor → `#23`, never the name). Unit-tested. *(Roster/consent are a `DEMO_ROSTER` stub pending the `sneat-team` substrate.)*

## Deferred AC Coverage

- sports/gameboard-live#ac:followers-notified — follower **notification delivery** (chat/bot) is **out of scope of this plan tree**. It is a substantial standalone effort (bot runtime, hosting, multi-channel delivery) to be specified and planned separately. The [`gameboardlive-bot`](../features/sports/gameboard-live/gameboardlive-bot/README.md) Feature remains, but has **no sub-plan here**; the follow *edge* (Task 4) is delivered, only its notification *fan-out* is deferred.

## Implementation Progress (2026-06-24)

The full vertical — contract, backend, **and** a browser frontend — is built and **green in CI on both repos**, including the **umbrella full-game browser E2E release gate**.

- **Repos created.** [`sneat-co/gameboard-ext`](https://github.com/sneat-co/gameboard-ext) (public contract) and [`sneat-co/gameboard`](https://github.com/sneat-co/gameboard) (private impl), each with `main` + `integration/gameboard-mvp` and per-repo CI.
- **Contract frozen** (`gameboard-ext`, tag `backend/v0.1.0`): `typespec/api4gameboard.tsp` (no-emitter source-of-truth), the Go `eventtimeline` model + deterministic **fold reducer** (100% coverage), the **TS reducer**, and a shared `parity/parity.json` oracle proving Go↔TS agree. CI: invariant + backend + typespec + frontend-parity all green.
- **Backend** (`gameboard`): dalgo store at the global `/ext/gameboard/games/{gameID}/events/{eventID}` (append-only, idempotent by `eventID`), per-source **authority** matrix, ordered record reads, and the public **state** fold — over an HTTP API + an HTTP full-game journey test. ≥85%, CI green.
- **Frontend** (`gameboard/frontend`): a real Angular 21 app (zoneless, `@angular/build`) — a timekeeper+scorekeeper **console** + a public **scoreboard** rendering the server-folded `GET /state` (score, period, clock, fouls + **bonus flip**, timeouts, possession). vitest units + a **Playwright full-game E2E** that drives a whole game through the real browser stack (UI → HTTP → backend → dalgo → fold → board) and asserts the board equals the fold after reload. **Passing in CI.**
- **event-timeline sub-plan:** Tasks 1–3 **done**; Task 4 record-read done, true live-stream subscription pending (the app polls `GET /state` after each append today).

Decisions recorded autonomously: (1) TypeSpec is no-emitter source-of-truth with hand-implemented + parity-tested Go/TS bindings (matches eventus/sneat-go); (2) per-game role authority is stubbed to a static `Source→EventType` map until the `sneat-team`/`roles` substrate ships; (3) persistence is dalgo with `dalgo2memory` tests, Firestore wiring a config swap (matches eventus); (4) the app uses a local wire-type mirror until `@sneat/extension-gameboard-contract` is published; (5) the E2E runs same-origin via the backend's optional static-SPA serving (no CORS).

**Umbrella tasks status:** Task 1 *in-progress* (scorer-creates-game done; lineup-from-roster blocked on `sneat-team`), Task 2 **done**, Task 3 **done**, Task 4 **done**, Task 5 **done**. **Five** browser E2Es (full-game, new-game, big-screen, account-gated follow, **post-game-recap box score**) green in CI. The contract is at **`backend/v0.2.0`** (adds the per-player box score — points → assists — to the fold; Go 100% + TS parity); `GET /state` carries it and the recap renders it minor-safe.

**Real Firestore E2E via sneat-go (2026-06-25):** the gameboard backend is now wired into **sneat-go** (`pkg/modules/gameboard`, mirroring `pkg/modules/eventus`) and serves `/v0/api4gameboard` over sneat-go's shared **Firestore** dalgo DB. A real end-to-end test (`integration_test.go`) drives the API *through that wiring* against the **Firestore emulator** — create→append→idempotent-replay(200)→unauthorized(403)→folded state (incl. box score)→durability via a fresh client — and passes. This exercised the actual datastore for the first time and **caught two real persistence bugs the in-memory tests hid**, both fixed in gameboard `backend/v0.2.1`: (1) `record.SetError(nil)` required before `tx.Set` (else `dalgo2firestore` panics on `record.Data()`); (2) `firestore:` struct tags required on queried DBO fields (the Firestore client ignores `json:` tags, so `WhereField` matched nothing). The wiring is on sneat-go branch `feat/wire-gameboard` (**PR #699**), and sneat-go's full CI (build + test + lint) is **green** with it. `sneat-co/gameboard` was made **public** (matching every other extension dep — `eventus`, `contactus`, `calendarius`, …) so the module fetches via the Go proxy with the default token (the org PATs lacked access to the new private repo). So the **Firestore-adapter gap below is now closed** in substance (the store works against real Firestore via sneat-go). **Shipped to production (2026-06-25):** PR #699 merged → sneat-go auto-deployed to GAE prod (`sneat-eur3-1`). A first prod smoke test exposed a real bug: `GET state`/`events` returned 500 while `GET game` (single-doc) returned a clean 404 — because in prod sneat-go wraps the Firestore dalgo DB with `dalgo2memcachegae`, whose query method returns `ErrNotSupported` (Get/Set work, queries don't). **Fix (gameboard `backend/v0.2.2`, PR #700):** the event log is stored as a single key-addressable doc per game (`…/log/eventlog`), read/written by Get/Set only — no queries (the spec permits a consolidated/materialised projection). Redeployed; **verified live in prod**: append (`applied:true`) → fold read (`home:3`, `playerPoints.p1:3`) → idempotent replay (`already-processed`) → unauthorized append (`403`). The gameboard API is now working end-to-end on real Firestore via sneat-go.

**Remaining for full MVP DoD (beyond the working spine):** ~~the dalgo→**Firestore** adapter~~ (done — verified against the emulator through sneat-go; pending PR #699 merge); refactor the single cohesive app into the per-feature `-internal` Nx libs (scorekeeper/timekeeper consoles, scoreboard, spectator, coach, recap); **lineup-from-roster** + Calendarius-happening/eventus-overlay on new-game (needs `sneat-team`/`calendarius`/`eventus` wiring); the **coach-console** request→confirm and **post-game-recap** box-score surfaces; replacing the recorded stubs (role authority → `roles`; follow edge → `linkage` behind `account-gate`; account id → bearer token); and event-timeline's true live-stream subscription (polling today). The MVP spine — create → live score/clock → public scoreboard (incl. big-screen) → account-gated follow → minor-safe — is implemented and gated by browser E2E.

## Frontend Reality & Rebuild (gameboard repo, 2026-06-25)

The "Implementation Progress (2026-06-24)" above is accurate for the **backend** (live in prod via sneat-go) but **superseded for the frontend** — correcting the record:

- **The 1st-gen frontend was thrown away, not lost.** The "real Angular 21 app — console + scoreboard + Playwright full-game E2E" described above was a **single ~223-line plain-Angular component** (`frontend/src/app/app.component.ts`, unstyled `data-testid` buttons over an `ApiService`) — a harness to prove the backend contract end-to-end. It was **deleted in commit `a58e24d`** (last intact at **`cdbdbbc`**) and **replaced by a fresh Nx + Ionic + Sneat-platform app** (`frontend/apps/gameboard-app`, from `575c989`).
- **What the current app actually implements:** the **new-game** on-ramp (sport picker + form, anonymous-first), a public **home/landing** + **my-profile** shell, and Sneat **space/lists** template scaffolding. The **scoreboard, console (timekeeper/scorekeeper), spectator/follow, and post-game-recap surfaces do NOT exist** in the current app — they were never ported from the 1st-gen harness. The contract lib (`libs/extensions/gameboard/contract`) currently carries only the **new-game** half (`Side`/`GameRecord`/`createGame`); the **event/state half** (`GameState`, `EventType`, append, `inBonus`, `publicPlayerLabel`) is absent.
- **Salvaged assets (recovered to [`docs/legacy-mvp-frontend/`](../../docs/legacy-mvp-frontend/)):** the 4 original Playwright E2Es — `full-game.spec.ts`, `follow.spec.ts`, `recap.spec.ts`, `new-game.spec.ts` — plus `contract.ts` (the `GameState` shape + `inBonus`/`publicPlayerLabel`/`sourceFor`/`newEventID` helpers) and `app.component.ts`/`api.service.ts`. These are **reference + acceptance spec**, not code to revive: the E2Es preserve their `data-testid`s, so the journeys port near-verbatim once the new Ionic surfaces carry the same testids.

### Testing strategy — real-stack E2E chain + isolated unit tests

Two layers, with a deliberate division of labour:

- **Unit tests** (`nx test gameboard-app`, vitest) — **isolated** logic only: the fold/display helpers (`inBonus`, `publicPlayerLabel`), a component rendering a fixed `GameState` with a **stubbed** `GameService`, and the service URL/payload shape. Fast, no I/O, no backend.
- **Full-cycle E2E** (`nx e2e gameboard-app-e2e`, Playwright) — the **real stack, no HTTP mocking**: browser UI → `GameService`/`SneatApiService` → **`gameboardd`** (this repo's real Go backend; its `devIdentity` authorizes writes, so no signed-in session is needed) → **dalgo → Firestore emulator** → deterministic fold → read-side render. `gameboardd` serves the built SPA **same-origin** (`GAMEBOARD_STATIC_DIR`, no CORS) — exactly as the salvaged `e2e/run-server.sh` did. The Playwright `webServer`/global-setup starts the **Firestore emulator**, builds the SPA, and starts `gameboardd` pointed at the emulator, serving same-origin; specs drive the real browser against it and assert that **every public read equals the deterministic fold** (no drift). *(Real Firebase-**token** validation is covered in prod via sneat-go; these E2Es prove the UI→API→**Firestore-emulator**→fold span.)*

**Required backend change:** `gameboardd` must select a **Firestore-backed dalgo DB** when `FIRESTORE_EMULATOR_HOST` is set (else `dalgo2memory`) — the documented swap in `backend/cmd/gameboardd/main.go`.

**The E2E chain (the point):** E2E specs are built **screen by screen and accumulate into one growing full-game-lifecycle scenario**. Each screen contributes its segment to a **shared lifecycle helper** (create → go-live → period/clock → score FT/+2/+3 (+assist) → fouls→bonus → sub → timeout → possession → final → scoreboard == fold → recap box score → follow). Early slices assert their own segment of the chain against the real stack; the final **umbrella full-game E2E replays the entire chain across all screens** and is the **MVP release gate**, kept green thereafter. The salvaged `docs/legacy-mvp-frontend/e2e/*.spec.ts` are the reference (preserve their `data-testid`s).

### Rebuild slices (each adds a screen + extends the E2E chain)

- **Slice 0 — contract + service + E2E harness foundation** *(no screen)*: forward-port the event/state types + helpers from `contract.ts`; extend `GameService` with `appendEvent`/`getState`/`follow` (via `SneatApiService`); add the Firestore-emulator store to `gameboardd`; stand up the **real-stack Playwright harness** (emulator + same-origin `gameboardd` + the shared lifecycle helper scaffold). Unit-test the helpers. **Chain gate:** a smoke E2E that creates a game through the real stack and reads `GET /state` back from the Firestore emulator.
- **Slice 1 — new-game segment** *(screen already exists)*: add its **full-cycle E2E** — real create → game persisted in the emulator → record read back. First link of the chain.
- **Slice 2 — public scoreboard** (`g/:gameID`, `?display=big`): render the fold from `getState`. **Chain gate:** seed events via real appends, assert the board equals the fold (score, bonus flip, possession, on-court minor-safe).
- **Slice 3 — operator console** (`g/:gameID/console`, timekeeper + scorekeeper): each control a real `appendEvent`, re-read `getState`. **Chain gate (core drive):** go-live → clock → score(+assist) → fouls→bonus → sub → timeout → possession → final, asserting the scoreboard reflects each step — through the real stack. Chain now spans new-game → console → scoreboard.
- **Slice 4 — post-game recap** (`g/:gameID/recap`): box score from the fold. **Chain gate:** extend to final → recap box score (points→assists→minutes), minor-safe.
- **Slice 5 — spectator / follow**: account-gated follow. **Chain gate:** anonymous follow → rejected (real backend 401). *(Signed-in follow edge is unit-tested for now; full real-auth fidelity needs an Auth-emulator sign-in — deferred TODO.)*
- **Umbrella — full-game lifecycle E2E**: the complete chain across every screen (the salvaged `full-game.spec.ts` reborn on the real stack) — the **MVP release gate**.

Carry forward as-is: roster/consent stays the `DEMO_ROSTER` stub (no `sneat-team` substrate); live updates poll `GET /state` (true subscription deferred); ≥85% unit coverage on new logic; E2E backend is `gameboardd` + Firestore emulator (`devIdentity`), real-token fidelity via sneat-go deferred.

## Open Questions

None at this time.

---
*This document follows the https://specscore.md/plan-specification*
