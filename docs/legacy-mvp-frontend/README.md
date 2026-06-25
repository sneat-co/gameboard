# Legacy MVP frontend — reference only (NOT built)

Recovered from commit `cdbdbbc` (last commit before the 1st-gen plain-Angular
frontend was deleted in `a58e24d` and replaced by the Nx+Ionic app in `575c989`).

These files are a **reference + acceptance spec** for rebuilding the game surfaces
(scoreboard, console, recap, spectator/follow) on the current Sneat-based app.
Do not wire them into the build — adapt the E2E selectors to the new Ionic UI.

- `e2e/*.spec.ts` — the original Playwright journeys (the umbrella acceptance gate)
- `src/contract.ts` — GameState shape + domain helpers (inBonus, publicPlayerLabel, clock)
- `src/app.component.ts` / `src/api.service.ts` — the cohesive console+scoreboard UI logic
