import { defineConfig } from "@playwright/test";
import path from "node:path";

/**
 * Page checks against a production build at desktop and phone widths, dark and light, with
 * the login wall off (Clerk keys blanked even if .env.local has them) so the whole UI is
 * covered. The web server builds for itself, so `npm run e2e` needs no build first. It
 * rewrites .next, so run this suite and the login-wall one (`npm run e2e:auth`) one at a time.
 */
/** The site stores the theme choice under localStorage "theme" (next-themes), so the light projects seed it. */
const LIGHT = {
  colorScheme: "light" as const,
  storageState: { cookies: [], origins: [{ origin: "http://127.0.0.1:3200", localStorage: [{ name: "theme", value: "light" }] }] },
};

export default defineConfig({
  testDir: ".",
  testMatch: /pages\.spec\.ts/,
  outputDir: "./test-results",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:3200", colorScheme: "dark" },
  webServer: {
    command: "sh -c 'export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY=; npm run rebuild >/dev/null && npx next build >/dev/null && npx next start -H 127.0.0.1 -p 3200'",
    cwd: path.resolve(__dirname, ".."),
    stdout: "ignore",
    stderr: "pipe",
    url: "http://127.0.0.1:3200",
    reuseExistingServer: false,
    timeout: 300_000,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "desktop-light", use: { viewport: { width: 1440, height: 900 }, ...LIGHT } },
    { name: "phone-light", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ...LIGHT } },
  ],
});
