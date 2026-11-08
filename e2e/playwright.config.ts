import { defineConfig } from "@playwright/test";
import path from "node:path";

/**
 * Page checks against the static export at desktop and phone widths.
 * Run `npm run build` first, then `npm run e2e`.
 */
export default defineConfig({
  testDir: ".",
  testMatch: /pages\.spec\.ts/,
  outputDir: "./test-results",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:3200", colorScheme: "dark" },
  webServer: {
    command: "npx serve out -l tcp://127.0.0.1:3200",
    cwd: path.resolve(__dirname, ".."),
    stdout: "ignore",
    stderr: "pipe",
    url: "http://127.0.0.1:3200",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
