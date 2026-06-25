// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Deploy-source test: this repo (sneat-co/gameboard) is the source of truth
// for the gameboard-live Worker. A push touching landings/ must trigger a
// Cloudflare deploy; if it doesn't, the Worker is still wired to the old
// sneat-co/gameboard-live repo. Safe to remove once verified.
// (watch-path trigger test #2)

// https://astro.build/config
export default defineConfig({
  // Custom domain: no repo-name base path needed.
  site: "https://gameboard.live",
  output: "static",
  outDir: "./dist",
  integrations: [sitemap()],
});
