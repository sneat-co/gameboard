# Shared Styling Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `landings/` (Astro) and `frontend/` (Angular/Ionic) one shared design-token file so they look like one product and a palette change is made in exactly one place.

**Architecture:** A single plain-CSS file `design/tokens.css` at the repo root defines `:root { --gb-* }` custom properties (runtime values, so both build systems read them unchanged). The landings import it and re-map their existing `--color-*` names onto `--gb-*` (flipping the site to light chrome with a dark scoreboard hero). The app includes it via Sass `meta.load-css` and maps `--gb-*` onto Ionic theme variables.

**Tech Stack:** Astro 5 + Vite (landings), Angular + Nx + `@angular/build:application` + Dart Sass + Ionic (app), pnpm.

## Global Constraints

- Package manager is **pnpm**. Run landings commands from `landings/`, app/Nx commands from `frontend/`.
- **Do NOT `git push`.** Cloudflare auto-deploys `main` on push; this work stays local until the user decides to ship. Commit only.
- Canonical token names are **`--gb-*`** exactly as defined in Task 1. Do not rename them in later tasks.
- **Out of scope:** score-digit team-color theming (team-driven, separate concern); a token build pipeline / Style Dictionary; the backend.
- The dev servers block the terminal — start them with the run/browser tooling for visual checks, then stop them; do not leave them running between tasks.

**Pre-existing gap (do NOT fix here, just be aware):** `--font-mono` references the `"DSEG"` family but no DSEG `@font-face`/font file is loaded anywhere in the repo — digits currently fall back to mono. This plan preserves the family reference via `--gb-font-score`; actually bundling the DSEG webfont is separate follow-up work.

---

### Task 1: Create the shared token file

**Files:**
- Create: `design/tokens.css`

**Interfaces:**
- Consumes: nothing.
- Produces: `:root` CSS custom properties consumed by Tasks 2–6. Exact names below are the contract: `--gb-accent`, `--gb-accent-strong`, `--gb-accent-contrast`, `--gb-bg`, `--gb-surface`, `--gb-border`, `--gb-ink`, `--gb-muted`, `--gb-score-bg`, `--gb-score-bg-top`, `--gb-clock`, `--gb-score-home`, `--gb-score-away`, `--gb-home`, `--gb-away`, `--gb-energy`, `--gb-warn`, `--gb-font-sans`, `--gb-font-score`, `--gb-radius`, `--gb-radius-pill`, `--gb-shadow`.

- [ ] **Step 1: Create `design/tokens.css`**

```css
/*
 * GameBoard shared design tokens — single source of truth.
 * Plain CSS custom properties (runtime), consumed by both the Astro landings
 * and the Angular/Ionic app. Edit colors here and both surfaces update.
 */
:root {
  /* Brand accent — the pitch */
  --gb-accent: #00e5a0;          /* mint — CTAs, eyebrows, links, app primary */
  --gb-accent-strong: #00c489;   /* hover / shade */
  --gb-accent-contrast: #04231a; /* text on a mint fill */

  /* Light chrome */
  --gb-bg: #eef1f5;              /* page background */
  --gb-surface: #ffffff;        /* cards */
  --gb-border: #e6e9ee;
  --gb-ink: #11181c;            /* primary text + strongest buttons */
  --gb-muted: #6b7785;

  /* Dark scoreboard moment */
  --gb-score-bg: #0a0f14;
  --gb-score-bg-top: #15202b;   /* radial-gradient top stop */
  --gb-clock: #ffd24a;          /* glowing yellow clock */
  --gb-score-home: #5fd39a;     /* placeholder default (team-driven later) */
  --gb-score-away: #8fb4ff;     /* placeholder default (team-driven later) */

  /* Team-semantic defaults (vary per team later) */
  --gb-home: #1f9d55;
  --gb-away: #2563eb;

  /* Status / energy */
  --gb-energy: #ff6a00;         /* reactions, bonus highlights */
  --gb-warn: #d64545;

  /* Typography */
  --gb-font-sans: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --gb-font-score: "DSEG", ui-monospace, "SF Mono", "Courier New", monospace;

  /* Shape */
  --gb-radius: 14px;
  --gb-radius-pill: 999px;
  --gb-shadow: 0 10px 40px rgba(20, 30, 50, 0.18);
}
```

- [ ] **Step 2: Verify the file defines every contract token**

Run: `grep -c -- '--gb-' design/tokens.css`
Expected: `23` (one line per token above).

- [ ] **Step 3: Commit**

```bash
git add design/tokens.css
git commit -m "feat(design): add shared design-token source of truth"
```

---

### Task 2 (GATE): Wire landings to the shared file

This retires half the key risk: can Vite/Astro read a file outside the landings project root? If the build fails to resolve the import even after the `fs.allow` tweak, STOP and fall back to Approach #3 in the spec (per-app mirror + drift check).

**Files:**
- Modify: `landings/src/layouts/BaseLayout.astro` (frontmatter imports, ~line 1-3)
- Modify: `landings/astro.config.mjs`

**Interfaces:**
- Consumes: `design/tokens.css` from Task 1.
- Produces: `--gb-*` available to all landings CSS.

- [ ] **Step 1: Import the token file first in BaseLayout**

In `landings/src/layouts/BaseLayout.astro`, change the top of the frontmatter so tokens load before `global.css`:

```astro
---
import "../../../design/tokens.css";
import "../styles/global.css";
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";
```

(The existing `import "../styles/global.css";` currently sits inside `global.css`'s own import in `BaseLayout`; ensure the tokens import is the first line and `global.css` follows it. If `global.css` was imported elsewhere, leave that as-is — just guarantee tokens import precedes it here.)

- [ ] **Step 2: Allow Vite dev-server to read the repo root**

In `landings/astro.config.mjs`, add a `vite` block to `defineConfig`:

```js
export default defineConfig({
  site: "https://gameboard.live",
  output: "static",
  outDir: "./dist",
  integrations: [sitemap()],
  vite: {
    server: { fs: { allow: [".."] } },
  },
});
```

- [ ] **Step 3: Build and verify the token value reaches the bundle**

Run:
```bash
cd landings && pnpm build && grep -rl "00e5a0" dist
```
Expected: build completes with no error, and grep prints at least one `dist/_astro/*.css` path (proves `--gb-accent` was actually included, not silently dropped).

- [ ] **Step 4: Commit**

```bash
git add landings/src/layouts/BaseLayout.astro landings/astro.config.mjs
git commit -m "feat(landings): consume shared design tokens"
```

---

### Task 3 (GATE): Wire the app to the shared file + map Ionic vars

Retires the other half of the risk: can Dart Sass (under `@angular/build`) `load-css` a file outside the app project, and do the Ionic variable mappings take effect?

**Files:**
- Modify: `frontend/apps/gameboard-app/src/styles.scss` (append after the existing `meta.load-css` includes, ~after line 23)

**Interfaces:**
- Consumes: `design/tokens.css` from Task 1.
- Produces: Ionic themed from `--gb-*` (`--ion-color-primary` = mint, light background).

- [ ] **Step 1: Include the token file and map Ionic theme variables**

Append to `frontend/apps/gameboard-app/src/styles.scss` (after the `@sneat/components` line so the mapping wins over Sneat defaults):

```scss
/* Shared GameBoard design tokens (single source of truth). */
@include meta.load-css('../../../../design/tokens.css');

/* Map shared tokens onto Ionic's theme variables. */
:root {
  --ion-color-primary: var(--gb-accent);
  --ion-color-primary-rgb: 0, 229, 160;
  --ion-color-primary-contrast: var(--gb-accent-contrast);
  --ion-color-primary-contrast-rgb: 4, 35, 26;
  --ion-color-primary-shade: var(--gb-accent-strong);
  --ion-color-primary-tint: #1ae8ab;

  --ion-color-success: var(--gb-home);
  --ion-color-warning: var(--gb-energy);
  --ion-color-danger: var(--gb-warn);

  --ion-background-color: var(--gb-bg);
  --ion-background-color-rgb: 238, 241, 245;
  --ion-text-color: var(--gb-ink);
  --ion-text-color-rgb: 17, 24, 28;

  --ion-font-family: var(--gb-font-sans);
}
```

- [ ] **Step 2: Build and verify the token value reaches the bundle**

Run:
```bash
cd frontend && npx nx build gameboard-app && grep -rl "gb-accent" dist/apps/gameboard-app
```
Expected: build succeeds and grep prints at least one CSS file path under `dist/apps/gameboard-app/` (proves the include resolved and `--ion-color-primary: var(--gb-accent)` shipped).

(If the build can't resolve the relative `load-css` path, try adding the repo root to Sass load paths via `stylePreprocessorOptions.includePaths` in `apps/gameboard-app/project.json` build options, e.g. `"includePaths": ["../.."]`, then `@include meta.load-css('design/tokens.css')`. If it still fails, STOP and fall back to spec Approach #3.)

- [ ] **Step 3: Commit**

```bash
git add frontend/apps/gameboard-app/src/styles.scss frontend/apps/gameboard-app/project.json
git commit -m "feat(app): theme Ionic from shared design tokens"
```

---

### Task 4: Reskin landings palette to light via the tokens

The landings components reference existing `--color-*` names. Re-point those names at `--gb-*` (and flip dark→light) so most components reskin without being touched.

**Files:**
- Modify: `landings/src/styles/global.css:1-27` (the `:root` block) and the `body` rule

**Interfaces:**
- Consumes: `--gb-*` (now available via Task 2).
- Produces: light-chrome landings; `--color-*` names preserved for components.

- [ ] **Step 1: Replace the `:root` palette block**

In `landings/src/styles/global.css`, replace the color/font/shape custom properties (lines ~2-20) so each existing name derives from a token (spacing scale stays unchanged):

```css
:root {
  /* Mapped onto shared tokens (design/tokens.css) */
  --color-bg: var(--gb-bg);
  --color-bg-elevated: var(--gb-surface);
  --color-surface: var(--gb-surface);
  --color-border: var(--gb-border);
  --color-text: var(--gb-ink);
  --color-text-muted: var(--gb-muted);

  --color-accent: var(--gb-accent);
  --color-accent-strong: var(--gb-accent-strong);
  --color-score: var(--gb-clock);
  --color-danger: var(--gb-warn);

  --font-sans: var(--gb-font-sans);
  --font-mono: var(--gb-font-score);

  --maxw: 1120px;
  --radius: var(--gb-radius);
  --shadow: var(--gb-shadow);

  --space-1: 0.5rem;
  --space-2: 1rem;
  --space-3: 1.5rem;
  --space-4: 2.5rem;
  --space-5: 4rem;
}
```

- [ ] **Step 2: Verify no dark brand hex literals remain in global.css**

Run: `grep -nEi '#0a0e1a|#121828|#1a2236|#2a3450|#00e5a0|#ffd23f|#ff5c7a|#f4f6fb|#9aa6c4' landings/src/styles/global.css`
Expected: no matches (all colors now flow through `--gb-*`).

- [ ] **Step 3: Build to confirm it still compiles**

Run: `cd landings && pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add landings/src/styles/global.css
git commit -m "feat(landings): map palette to shared tokens (light chrome)"
```

---

### Task 5: Keep the hero scoreboard a dark "scoreboard moment"

With the page now light, `HeroScoreboard`'s panel (which used `--color-surface`/`--color-bg-elevated`) would turn light. Re-point just that panel at the dark scoreboard tokens.

**Files:**
- Modify: `landings/src/components/HeroScoreboard.astro` (the `.scoreboard` rule and digit colors in its `<style>` block)

**Interfaces:**
- Consumes: `--gb-score-bg`, `--gb-score-bg-top`, `--gb-clock`, `--gb-score-home`, `--gb-score-away`.
- Produces: a dark hero panel embedded in the light page.

- [ ] **Step 1: Make the panel dark**

In `HeroScoreboard.astro`, change the `.scoreboard` background and text:

```css
  .scoreboard {
    background: radial-gradient(120% 120% at 50% 0%, var(--gb-score-bg-top), var(--gb-score-bg));
    border: 1px solid var(--gb-score-bg-top);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: var(--space-3);
    width: 100%;
    color: #fff;
  }
```

- [ ] **Step 2: Point the digits at scoreboard tokens**

In the same `<style>` block, set the clock and per-team scores (add/replace these rules; keep existing layout rules):

```css
  .clock .time { color: var(--gb-clock); text-shadow: 0 0 14px rgba(255, 210, 74, 0.45); }
  .team.home .score { color: var(--gb-score-home); }
  .team.away .score { color: var(--gb-score-away); }
  .team .name, .clock .label, .period { color: #9fb0bf; }
```

(Adjust selectors to match the component's actual class names from its markup: `.board-top`, `.live`, `.period`, `.teams`, `.team.home`, `.team.away`, `.clock`, `.time`, `.label`, `.score`, `.name`.)

- [ ] **Step 3: Visual check in the browser**

Run the landings dev server and view the homepage with the browser tooling:
```bash
cd landings && pnpm dev
```
Open the served URL. Expected: light page, mint CTA/eyebrow, and a **dark** hero scoreboard with a glowing yellow clock and green/blue digits. Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add landings/src/components/HeroScoreboard.astro
git commit -m "feat(landings): dark scoreboard hero on light page"
```

---

### Task 6: Visual sweep + single-source proof

Verify every landings surface and the app are readable under the new palette, fix any contrast regressions, and prove the single-source-of-truth claim.

**Files:**
- Modify (only if a regression is found): `landings/src/components/Header.astro`, `FeatureCard.astro`, `CTASection.astro`, `Footer.astro`, and/or page files under `landings/src/pages/`.

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: a verified, consistent look across both surfaces.

- [ ] **Step 1: Screenshot each landings surface**

Run `cd landings && pnpm dev`, then with the browser tooling view `/`, `/features`, `/pricing`, `/about`, `/contact`. For each, check: text is dark-on-light and readable, accents are mint, no element is light-text-on-light (a leftover dark-era assumption, most likely in `Header` or `CTASection`).

- [ ] **Step 2: Fix any regression by re-pointing to the right token**

For any unreadable element, find the offending rule in that component's scoped `<style>` and point it at the correct token (e.g. a hard-coded light text color → `var(--color-text)`; a translucent dark header bg → `var(--color-surface)` or a light translucent value). Make the minimal change; do not restyle beyond fixing readability.

- [ ] **Step 3: Theme-check the app**

Run `cd frontend && npx nx serve gameboard-app`, open it with the browser tooling, and confirm primary buttons/links render mint and the background is the light `--gb-bg`. Note (do not fix here): deeper `@sneat/components` surfaces may need their own follow-up mapping if they hard-code colors — record any such spots for a later pass. Stop the server when done.

- [ ] **Step 4: Prove single source of truth**

Temporarily change `--gb-accent` in `design/tokens.css` to `#ff00ff`, rebuild both (`cd landings && pnpm build`; `cd frontend && npx nx build gameboard-app`), and grep each `dist` for `ff00ff` to confirm both surfaces pick it up. Then revert the token back to `#00e5a0`.

```bash
grep -rl "ff00ff" landings/dist frontend/dist/apps/gameboard-app
```
Expected: matches under BOTH `landings/dist` and `frontend/dist/apps/gameboard-app`. Revert the edit afterward and confirm `git diff design/tokens.css` is empty.

- [ ] **Step 5: Commit any fixes**

```bash
git add landings/src
git commit -m "fix(landings): readability fixes under light palette"
```

(If Step 2 found nothing to fix, skip the commit.)

---

## Self-Review

- **Spec coverage:** shared `tokens.css` (T1) ✓; both bundlers consume it (T2 landings, T3 app) ✓; landings reskin to light (T4) + dark hero (T5) ✓; Ionic mapping (T3) ✓; verification incl. single-source proof (T2/T3 grep, T6 step 4) ✓; risks/fallback to Approach #3 called out in T2/T3 ✓; DSEG preserved-by-reference + gap flagged (constraints) ✓; score-digit theming out of scope (constraints) ✓.
- **Type/name consistency:** `--gb-*` token names defined in T1 are used verbatim in T2–T6.
- **No placeholders:** every code step shows the actual content.
