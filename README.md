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

### Landing only

```sh
pnpm install   # install dependencies
pnpm dev       # start dev server at http://localhost:4321
pnpm build     # build static site to ./dist
pnpm preview   # preview the production build locally
```

### Full-site preview (landing + app on one host)

Preview the production layout locally — the Astro landing at `/` and the
Angular app at `/app/` behind a single HTTPS host
`https://gameboard.localhost/` — mirroring the Cloudflare deployment
(backstage spec [`site-hosting-pattern`](https://github.com/sneat-co/backstage/blob/main/spec/features/site-hosting-pattern/README.md)).
The `Caddyfile` in this repo is a reverse proxy that stitches the two dev
servers together.

**Prerequisites:** [Caddy](https://caddyserver.com) (`brew install caddy`) and the
app repo cloned as a sibling at `../gameboard` (`sneat-co/gameboard`).

Run three processes (separate terminals):

```sh
# 1. Landing (this repo) — 127.0.0.1:4321
pnpm dev --host 127.0.0.1

# 2. App (gameboard repo) — 127.0.0.1:4301, served under /app/
cd ../gameboard/frontend
pnpm exec ng serve --serve-path=/app/ --host 127.0.0.1 --port 4301

# 3. Reverse proxy (this repo)
caddy trust                        # one-time: trust Caddy's local CA (asks for your password)
sudo caddy run --config Caddyfile  # serves https://gameboard.localhost/
```

Open **https://gameboard.localhost/** (landing) and
**https://gameboard.localhost/app/** (app).

**Notes**

- `sudo` is needed **only to bind port 443**. To run without sudo, change the
  site line in `Caddyfile` from `gameboard.localhost` to
  `gameboard.localhost:8443` and open `https://gameboard.localhost:8443/`.
- Port `4300` is the Go backend (`sneat-go`); the app uses `4301`.
- The proxy sets `Cross-Origin-Opener-Policy: same-origin-allow-popups` on
  `/app/*` so Firebase `signInWithPopup` works locally. Add
  `gameboard.localhost` to the Firebase project's **Authorized Domains**.
- **Safari** doesn't resolve `*.localhost` — add `127.0.0.1 gameboard.localhost`
  to `/etc/hosts` (Chrome/Firefox work as-is).
- Stop everything: `pkill -f "astro dev"; pkill -f "ng serve"; pkill caddy`.

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
