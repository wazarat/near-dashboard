import { defineConfig } from "@playwright/test";
import path from "node:path";

/**
 * The login wall as a logged-out reader meets it, at desktop and phone widths. The build sets
 * NEXT_PUBLIC_WALL_PREVIEW=logged-out with the Clerk keys blanked, so every reader is treated as
 * logged out and no Clerk account or secret is needed (src/lib/auth-config.ts). The web server
 * rewrites .next, so run this suite and the others one at a time.
 *
 *   npm run e2e:wall
 *   E2E_BASE_URL=https://near-dashboard-puce.vercel.app npm run e2e:wall     the no-cookie checks against a deployed site
 */
const LOCAL = "http://127.0.0.1:3201";
/** E2E_BASE_URL points the logged-out checks at a deployed site (production after a deploy); no local server is built then. */
const REMOTE = process.env.E2E_BASE_URL?.replace(/\/$/, "");
const BASE = REMOTE ?? LOCAL;

export default defineConfig({
  testDir: ".",
  testMatch: REMOTE ? /logged-out\.spec\.ts/ : /(wall|logged-out)\.spec\.ts/,
  outputDir: "./test-results-wall",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: BASE, colorScheme: "dark" },
  webServer: REMOTE ? undefined : {
    command: "sh -c 'export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= NEXT_PUBLIC_WALL_PREVIEW=logged-out; npm run rebuild >/dev/null && npx next build >/dev/null && npx next start -H 127.0.0.1 -p 3201'",
    cwd: path.resolve(__dirname, ".."),
    stdout: "ignore",
    stderr: "pipe",
    url: BASE,
    reuseExistingServer: false,
    timeout: 300_000,
  },
  projects: [
    { name: "logged-out-desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "logged-out-phone", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
