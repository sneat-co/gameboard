# gameboard (private)

Private implementation repo for **GameBoard.live** — the basketball game-day vertical of the Sneat
ecosystem. It holds the **backend** (Go, dalgo→Firestore), the non-buildable
`@sneat/extension-gameboard-internal` Angular libs, and the `gameboard-app`. It implements the
**frozen contract** published by the public [`sneat-co/gameboard-ext`](https://github.com/sneat-co/gameboard-ext)
repo.

> The marketing/landing site lives separately in `sneat-co/gameboard-live` (Astro + Cloudflare) —
> this repo is the app + extension, not the site.

## Layout (target)

```
gameboard/
├── backend/    # Go module github.com/sneat-co/gameboard/backend (dalgo→Firestore at /ext/gameboard/...)
├── libs/       # @sneat/extension-gameboard-internal (Angular, non-buildable, app-only)   [pending]
└── apps/gameboard-app/                                                                     [pending]
```

## Status (Phase 0 / Phase 1 foundation)

- `backend/gameboard`: append service over the frozen `gameboard-ext` event-timeline contract —
  EventID idempotency, per-source authority (scorekeeper/timekeeper/judge/consensus), ordered
  record reads, and the deterministic fold (`State`). **100% statement coverage.**
- Persistence is a port (`EventStore`); the in-memory adapter backs service tests today. The
  **dalgo→Firestore adapter + Firestore-emulator integration tests** are the next bootstrap step
  (same service logic, swapped adapter).
- The Nx workspace (`gameboard-app` + `-internal` libs), Playwright umbrella E2E, and per-repo
  coverage/E2E CI gates land as the read-side and lifecycle slices come in.

Source spec: backstage [`spec/plans/gameboard-live.md`](https://github.com/sneat-co/backstage/blob/main/spec/plans/gameboard-live.md).

## Standards

This is a **Sneat extension** — build it against the shared platform standards:

- **[Sneat extension standards](https://github.com/sneat-co/sneat-libs/blob/main/docs/extension-standards/README.md)** — backend wiring, frontend apps, and UX conventions.
- **[Frontend UX standards](https://github.com/sneat-co/sneat-specs/blob/main/standards/frontend-ux/README.md)** — cards, buttons, lists, page layout, forms, modals, and loading/empty/error states.
- **[Screen flows & the UI component checklist](https://github.com/sneat-co/sneat-specs/blob/main/standards/frontend-ux/flows.md)** — read **before** building any form, page, or wizard: it covers how screens connect (entry → action → exit) so they don't end up orphaned.
