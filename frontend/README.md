# sneat-ext-template

A template for starting a new **Sneat frontend extension** — an Nx workspace
with an Angular + Ionic app that mounts a Sneat extension (the
`contract` / `internal` / `shared` library triad) on the standard Sneat app
shell (auth, spaces, UI).

It is the frontend counterpart to [`sneat-mod-template`](https://github.com/sneat-co/sneat-mod-template)
(which scaffolds the Go module/backend).

## Stack

- **Nx** workspace (`@nx/angular` 22)
- **Angular 21** + **Ionic 8**
- **Firebase** auth via the shared Sneat platform packages (`@sneat/app`,
  `@sneat/auth-ui`, …)
- **Vitest** unit tests, **Playwright** e2e

## Layout

```
apps/
  gameboard-app/        # the Ionic app (composition root)
  gameboard-app-e2e/    # Playwright e2e
libs/extensions/gameboard/
  contract/            # @sneat/extension-gameboard-contract  — tokens & DTOs
  internal/            # @sneat/extension-gameboard-internal   — service impls + provideGameboardInternal()
  shared/              # @sneat/extension-gameboard-shared     — pages/components
```

## Create a new extension

Clone this template into your target repo, then run the rename script with your
extension id (a single lowercase token):

```sh
./customize.sh gameboard
pnpm install                       # reconcile the renamed workspace packages
pnpm exec nx build gameboard-app   # verify
```

`customize.sh` renames `template → <id>` across the workspace (app, libs,
package names, symbols, selectors, `appId`/title) **without** corrupting Angular
keywords like `templateUrl`, inline `template:`, or `<ng-template>`. It removes
itself when done.

## Develop

```sh
pnpm install
pnpm exec nx serve gameboard-app          # dev server
pnpm exec nx build gameboard-app          # production build -> dist/apps/gameboard-app/browser
pnpm exec nx run-many -t lint test build
```

## Notes

- The app's `appId` is cast `as SneatApp` because the placeholder id isn't in
  `@sneat/core`'s `SneatApp` union. Once your id is registered (or `SneatApp`
  accepts any string), the cast can be dropped.
- Dependency updates are managed by Renovate via `.github/renovate.json`
  (`extends: github>sneat-co/sneat-renovate-nx`).
