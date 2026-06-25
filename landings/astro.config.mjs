// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  // Custom domain: no repo-name base path needed.
  site: "https://gameboard.live",
  output: "static",
  outDir: "./dist",
  integrations: [sitemap()],
});
