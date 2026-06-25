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
