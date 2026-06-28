# CLAUDE.md — gameboard

Monorepo for **GameBoard.live**. Three stacks, one repo:

- `backend/`  — Go (dalgo → Firestore). **Not deployed from here** — it's a Go
  module imported by `sneat-co/sneat-go`, which builds & deploys it.
- `frontend/` — Nx + pnpm (Angular/Ionic `gameboard-app`)
- `landings/` — Astro marketing site (was the `sneat-co/gameboard-live` repo)

## Deployment — Cloudflare deploys on push to `main`

**Cloudflare's own Git integration builds & deploys `frontend/` (app) and
`landings/` on every push to `main`.** There is no GitHub Actions deploy step in
the normal flow and **no `CLOUDFLARE_*` secrets are needed** in this repo.

- `frontend/` → Worker `gameboard-app` → `gameboard.live/app`
- `landings/` → Worker `gameboard-live` → `gameboard.live`

`backend/` is **not** part of the Cloudflare deploy — see above (consumed by
`sneat-co/sneat-go`).

The `.github/workflows/deploy-app.yml` and `deploy-landings.yml` files are
**manual (`workflow_dispatch`) fallbacks only** — not the live deploy path.
Their in-file comments about needing `CLOUDFLARE_*` secrets apply only to that
manual fallback; ignore them for normal deploys.

# AI agent guidance

This is a **Sneat extension**. Build it against the shared platform standards.

## Building UI (forms, pages, screens, modals, wizards)

Before and while writing UI components, work through the **screen-flow checklist**:
https://github.com/sneat-co/sneat-specs/blob/main/standards/frontend-ux/flows.md
(building-block docs — cards/buttons/lists/forms/modals/states/page-layout — live
alongside it). If the `ui-flow` skill is available, invoke it.

Key rules:
- A screen isn't done until its **entry** (what links here) and **exit** (where it
  sends the user) are wired to real screens. Map the flow before building.
- After a successful **create**, redirect to the new entity's **details** page
  (using the returned id, with `replaceUrl`) — unless explicitly told otherwise.
- Don't leave orphan pages, silent failures, or disconnected wizard steps.

## Extension standards

Backend wiring, frontend apps, and UX:
https://github.com/sneat-co/sneat-libs/blob/main/docs/extension-standards/README.md
