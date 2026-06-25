# Design: Shared styling between landings and app

**Date:** 2026-06-25
**Status:** Draft (pending user review)
**Topic:** Make `landings/` (Astro) and `frontend/` (Angular/Ionic) visually consistent via a shared design-token file.

## Goal

A single source of truth for brand colors, typography, and core shape tokens that
both the marketing site and the app consume, so the two surfaces look like one
product and a palette change is made in exactly one place.

## Decisions (settled during brainstorming)

- **Direction:** one shared palette, rendered appropriately per surface — *not*
  forcing either surface to copy the other's full look.
- **Light chrome + dark "scoreboard moments":** pages use a light background; the
  scoreboard (hero panel, final/TV board) is a dark surface used as a deliberate
  spotlight. This is already how the app prototypes work
  (`backstage/.../gameboard-live/screens/screens.html`).
- **Brand accent: mint green `#00e5a0`** — rationale: green = the playing field
  (soccer, Gaelic, rugby, hockey). Used for CTAs, eyebrows, links, and the app's
  primary buttons.
- **Scoreboard digit colors are out of scope** — they are team-driven (teams pick
  their own colors) and will be handled separately. The green/blue digit colors in
  mockups are placeholder defaults only.
- **Typography:** keep **Inter** for UI/text (already shared) and keep **DSEG**
  (digital-display font) for scoreboard digits.
- **Token mechanism:** Approach #1 — a single plain-CSS file of CSS custom
  properties living **outside** both projects, imported by both. Fallback if
  bundlers fight cross-workspace imports: Approach #3 (canonical file + per-app
  mirror + a drift-check script).

## Palette (the shared tokens)

Canonical file: `design/tokens.css` at the repo root, defining `:root { --gb-* }`.
Plain CSS custom properties (runtime), so both build systems read them unchanged.

```css
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
  --gb-energy: #ff6a00;         /* 🔥 reactions, bonus highlights */
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

(Exact `-strong`/contrast steps may be nudged during implementation for AA
contrast; the named tokens above are the contract.)

## Components / integration points

Three units, each with one clear job.

### 1. `design/tokens.css` — source of truth

Plain CSS custom properties only. No selectors beyond `:root`. No build step.
Owns: the palette, type families, and shape tokens. Depends on: nothing.

### 2. Landings consumption (`landings/src/styles/global.css`)

- Import `design/tokens.css` (relative path; Astro/Vite).
- Replace the current dark `:root` palette block with references to `--gb-*`.
- **Reskin from dark to light chrome:** `body` background → `--gb-bg`, text →
  `--gb-ink`; accent/links/eyebrows → `--gb-accent`; `.btn-primary` → mint fill
  with `--gb-accent-contrast` text. Affected components to re-check visually:
  `Header`, `HeroScoreboard`, `FeatureCard`, `CTASection`, `Footer`, and the
  pages. The hero's scoreboard panel becomes the dark "scoreboard moment"
  (`--gb-score-bg` + glowing `--gb-clock`).
- Ensure the **DSEG** font is actually loaded by the landings (a `@font-face`
  or the existing reference resolves to a real font file).

### 3. App consumption (`frontend/apps/gameboard-app/src/styles.scss`)

- Include the token file the same way Ionic CSS is already included:
  `@include meta.load-css('…/design/tokens.css');`.
- Add a `:root` mapping block: `--gb-*` → Ionic theme variables, including the
  Ionic stepped companions Ionic expects:
  - `--ion-color-primary: var(--gb-accent)` + `-rgb`, `-contrast`, `-shade`,
    `-tint`.
  - `--ion-background-color: var(--gb-bg)`, `--ion-text-color: var(--gb-ink)`,
    plus card/border surfaces as needed.
- Ensure DSEG is loaded for the app where scoreboard digits render.

## Out of scope

- Score-digit team-color theming (team-driven; separate concern).
- Restructuring components or layout beyond what the reskin requires.
- A token build pipeline / Style Dictionary (Approach #2 was rejected as overkill).
- The backend.

## Risks / open implementation questions

1. **Cross-workspace import.** `landings/` and `frontend/` are separate pnpm
   workspaces with separate bundlers. Vite may need `vite.server.fs.allow` to
   include the repo root; Angular/Nx Sass may need the relative path on its load
   path. **Verify both can read `design/tokens.css` as the very first task**; if
   either can't be made to cooperate cleanly, fall back to Approach #3 (canonical
   file + thin per-app mirror + a drift-check script).
2. **Ionic stepped variables.** Ionic needs `-rgb`/`-shade`/`-tint`/`-contrast`
   companions for primary; the mapping block must supply them (CSS vars can't
   compute rgb from a hex at runtime, so these are written explicitly).
3. **DSEG availability.** Confirm the font file exists and is loaded in each app;
   the token only names the family.

## Verification

- **Import proof (gate):** both `landings` dev server and the app build resolve
  `--gb-*` from the shared file (inspect computed styles; a mint CTA renders mint
  in both).
- **Landings reskin:** the marketing pages render light with mint accents and a
  dark scoreboard hero; no hardcoded old brand hex literals (`#0a0e1a`,
  `#00e5a0`, etc.) remain in `global.css` — only `--gb-*` references.
- **App theme:** Ionic primary buttons/links render mint; background is the light
  `--gb-bg`.
- **Single-source check:** changing `--gb-accent` in `design/tokens.css` alone
  changes the CTA color in both surfaces.
