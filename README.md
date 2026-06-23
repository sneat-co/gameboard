# GameBoard.live

Live sports scoreboard platform. Keep score from a phone or tablet, show the score
and game clock on a TV or projector, and share a live mobile scoreboard link with
spectators.

This repository is the marketing site, built with [Astro](https://astro.build) as a
static site and deployed to GitHub Pages on the custom domain
[gameboard.live](https://gameboard.live).

## Tech stack

- **Astro 5** — static output, minimal client-side JavaScript
- **TypeScript** — strict config
- **pnpm** — package manager
- **@astrojs/sitemap** — automatic `sitemap-index.xml`
- No backend yet — forms are placeholders.

## Project structure

```
.
├── public/                 # Static assets served as-is
│   ├── CNAME               # Custom domain for GitHub Pages
│   ├── favicon.svg
│   └── robots.txt
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── HeroScoreboard.astro
│   │   ├── FeatureCard.astro
│   │   └── CTASection.astro
│   ├── layouts/
│   │   └── BaseLayout.astro # SEO, OpenGraph, Twitter meta + header/footer
│   ├── pages/              # One file per route
│   │   ├── index.astro     # Landing page
│   │   ├── features.astro
│   │   ├── pricing.astro
│   │   ├── about.astro
│   │   └── contact.astro
│   └── styles/
│       └── global.css      # CSS variables + dark scoreboard theme
├── astro.config.mjs
└── .github/workflows/deploy.yml
```

## Local development

```sh
pnpm install   # install dependencies
pnpm dev       # start dev server at http://localhost:4321
pnpm build     # build static site to ./dist
pnpm preview   # preview the production build locally
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the site and
publishes it to GitHub Pages using the official artifact flow:

1. `actions/configure-pages`
2. `actions/upload-pages-artifact`
3. `actions/deploy-pages`

### Custom domain

`public/CNAME` contains `gameboard.live`, so the build ships the CNAME file required
by GitHub Pages. Because the site uses a custom domain (not a project subpath), no
repo-name `base` path is configured — `site` is set to `https://gameboard.live`.

Enable **Settings → Pages → Source: GitHub Actions** on the repository, and point the
domain's DNS at GitHub Pages.

## Roadmap

Rosters, stats, brackets and full tournament tooling are planned and surfaced as
"Future" features on the site.
