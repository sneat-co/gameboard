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

## Testing local changes to a `@sneat/*` library

The `@sneat/*` packages are published libs (built in the sibling `sneat-libs`
Nx workspace) and consumed here from `node_modules`. To test an unpublished
change to one — e.g. `@sneat/auth-ui` — point this app at the **local build**,
verify, then publish upstream and point back to the version.

Use an **injected** `file:` dependency, **not** a plain `link:`/override. This
app and `sneat-libs` can be on different Angular *patch* versions (e.g. app
21.2.9, libs 21.2.0); a plain symlink makes the linked lib resolve its
`@angular/*` from `sneat-libs/node_modules`, loading a **second** Angular →
`TS2345 'Route | Route'` at build and injector errors at runtime. `injected:
true` makes pnpm copy the package into this app's store and resolve its peers
against **this app's** Angular, eliminating the skew.

1. **Build the lib** in `sneat-libs` (produces `dist/libs/<lib>`):
   ```sh
   ( cd ../../sneat-libs && pnpm exec nx build auth-ui )
   ```
2. **Point this app at it** — in `package.json`:
   ```jsonc
   "@sneat/auth-ui": "file:../../sneat-libs/dist/libs/auth/ui",
   // and a top-level:
   "dependenciesMeta": { "@sneat/auth-ui": { "injected": true } }
   ```
3. **Clean install** — pnpm will NOT pick up a newly-added override/dep
   incrementally (it reports "Already up to date" and does nothing, even with
   `--force`). You must reinstall from scratch:
   ```sh
   rm -rf node_modules pnpm-lock.yaml && pnpm install
   ```
4. **Re-optimize Vite deps**, then (re)start the dev server:
   ```sh
   rm -rf .angular/cache/*/gameboard-app/vite
   ```
5. **Iterate**: after each lib edit, rebuild the lib (step 1) and restart the
   dev server (clearing the Vite cache as in step 4) so the change is picked up.

**Revert after publishing upstream**: restore `"@sneat/auth-ui": "<version>"`
in `package.json`, delete its `dependenciesMeta` entry, then clean install
(step 3).

## Notes

- The app's `appId` is cast `as SneatApp` because the placeholder id isn't in
  `@sneat/core`'s `SneatApp` union. Once your id is registered (or `SneatApp`
  accepts any string), the cast can be dropped.
- Dependency updates are managed by Renovate via `.github/renovate.json`
  (`extends: github>sneat-co/sneat-renovate-nx`).
