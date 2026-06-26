# REBUILD-LOG — GameBoard.live game screens (branch `feat/game-screens`)

Durable per-slice progress ledger for the autonomous rebuild (see
`docs/autonomous-build-prompt.md`). One line appended per slice when its
review is clean: commit range, tests passing, assumptions, deferred items,
Minor findings. After any context compaction, trust this ledger + `git log`
and resume at the first unmarked slice; never re-run a completed slice.

Branch base: `8ec1cb9` (main)

## Environment notes
- Use pnpm **11.9.0** (`corepack pnpm@11.9.0`); the host default pnpm 10.x
  trips `ERR_PNPM_OUTDATED_LOCKFILE` on the contract lib's peerDependencies.
  `node_modules` is already installed; `pnpm exec nx ...` works with either.

## Slices

| Slice | Status | Commits | Tests | Notes |
|-------|--------|---------|-------|-------|
| 0 — contract + service + E2E harness | ✅ clean | 888d217..1c80f93 | backend go ✅; unit 13/13; **7/7 chromium e2e** | Firestore-emu store, real-stack harness, CI emulator-backed |
| 1 — new-game segment E2E | ✅ clean | a624c3f | 8/8 chromium e2e | real create→persist→full-record readback; UI auth-create deferred |
| 2 — public scoreboard | ✅ clean | 8188919 | 28/28 unit; 10/10 chromium e2e | public g/:gameID + ?display=big; board==fold; minor-safe; localhost-gated API base override |
| 3 — operator console | ✅ clean | 18a3618 | 43/43 unit; 11/11 chromium e2e | g/:gameID/console full-lifecycle drive; board==fold; appendEvent anon-fallback (prod-safe); ScoreboardView extracted |
| 4 — post-game recap | ✅ clean | 5dec7f2 | 52/52 unit; 12/12 chromium e2e | g/:gameID/recap box score (pts→ast) minor-safe; board==fold; score-by-period/minutes deferred (not in contract) |
| 5 — spectator/follow | ✅ clean | f72d963 | 55/55 unit; 13/13 chromium e2e | follow-home/follow-status on scoreboard; anon→rejected (client-auth, real-stack); signed-in unit-tested; account-id omitted (decision 2) |
| Umbrella — full-game E2E | ✅ clean | c52ea6e | 14/14 chromium e2e | one gameID across all 5 screens; board==fold incl. reload; recap minor-safe; anon follow rejected (8–2 fold) |
| Final whole-branch review | pending | — | — | — |

## Slice details
(appended as slices complete)

| Final hardening | ✅ clean | b17c0c8 | 14/14 e2e; 55/55 unit | guard real-stack E2E vs in-memory + review nits |
| Final whole-branch review | ✅ ready | 8ec1cb9..b17c0c8 | 14/14 e2e; 55/55 unit; backend ok | no Critical/Important; 11 Minors triaged acceptable-to-ship |

## Final status (2026-06-26)

All slices (0–5 + Umbrella) implemented, each reviewed clean (spec + quality).
Final whole-branch review on the most capable model: **✅ merge-ready**, all 7
checklist items pass, **no Critical/Important findings**.

**Test evidence at HEAD (b17c0c8):**
- backend `go build/vet/test ./...` → green
- `nx test gameboard-app` → 55/55 (9 files); `nx lint` → clean; `prettier --check` → clean
- Real-stack `firebase emulators:exec --only firestore --project demo-gameboard 'cd frontend && pnpm exec nx e2e gameboard-app-e2e -- --project=chromium'` → **14/14 passed**
- Hardening: the E2E harness now **fails fast** if `FIRESTORE_EMULATOR_HOST` is unset (the real-stack guarantee is enforced, not assumed). CI runs the 3-browser matrix via `playwright install --with-deps`.

**Assumptions logged (autonomous decisions):**
- Contract event/state half lives in `app/game/game-state.ts`, reusing `Side`/`TeamSide` from `new-game/game-contract` (single source of truth; contract lib untouched).
- `appendEvent` falls back to `postAsAnonymous` ONLY on SneatApiService's client-side "not authenticated" guard (real backend errors propagate; prod token-less append still 401s at sneat-go — verified prod-safe). Enables the console to drive the real-stack E2E without an auth session (gameboardd devIdentity authorizes).
- `main.ts` adds a **localhost-gated** `SneatApiBaseUrl='/v0/'` override so the browser app hits same-origin gameboardd in dev/E2E; production keeps the standard sneat-go URL (prod-safe, matches sneat-libs prod-safe-env convention).
- Follow `account-id` testid omitted (superseded by Firebase-token auth, decision 2); anonymous follow rejected at the client-auth layer in E2E; signed-in→following unit-tested (decision 10).
- Umbrella asserts an 8–2 fold (the canonical `driveFullGameViaConsole` includes the attributed `home-2-by-p1` control) rather than the legacy spec's 6–2.
- 5 pre-existing E2E specs were already RED on `main` (stale after the new-game sport-picker overhaul + public-home change — confirmed via a `main` worktree); corrected in Slice 0 to the current UI.

**Deferred (out of scope; noted for follow-up):**
- Real Firebase **Auth-emulator** sign-in for E2E → would let the new-game UI authenticated-create and a real backend-401 follow be driven through the browser (today: create via lifecycle helper; anonymous follow rejected client-side).
- Recap score-by-period + per-player minutes (not in the current `GameState` contract).
- The `-internal` Nx lib refactor; real roster/consent (`sneat-team`, DEMO_ROSTER stub stays); true live-stream subscription (polling stays); real role authority (backend stub stays).
- 3-browser local E2E (firefox/webkit libs not provisioned in the build sandbox; CI covers the full matrix).

**Minor findings carried (final review: all acceptable-to-ship for a draft PR):**
recommend (next) a CI assertion that the emulator store was selected (now logged + harness fail-fast guard added); lifecycle.ts re-implements sourceFor/newEventID (Nx boundary; drift risk); a few test-robustness/JSDoc/accessor nits (see SDD ledger).

**Environment note:** built with pnpm 11.9.0 (`corepack pnpm@11.9.0`); browser E2E enabled in a no-root sandbox by extracting Ubuntu noble libs to `~/.local/browser-libs` (LD_LIBRARY_PATH via ~/.zshenv). Firestore emulator on port 8377 (8080/8081 occupied on the shared host).
