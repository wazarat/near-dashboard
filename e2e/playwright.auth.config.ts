import { defineConfig } from "@playwright/test";
import path from "node:path";

/**
 * The login wall against a real Clerk development instance: logged out at desktop and phone
 * widths (the same checks as `npm run e2e:wall`), then signed in. Needs the development keys
 * (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY, the pk_test_ and sk_test_ pair) in
 * the environment or .env.local; without them every test skips with a message. The web server
 * rewrites .next, so run this suite and the others one at a time.
 *
 *   npm run e2e:auth
 */
/**
 * localhost, not 127.0.0.1, and next start on every interface: with the Clerk keys set, Clerk's proxy rewrites
 * each request to http://localhost:<port>/. A server listening on 127.0.0.1 only makes Next treat that as another
 * origin and proxy it to ::1, where nothing listens, so every page hangs.
 */
const LOCAL = "http://localhost:3202";

export default defineConfig({
  testDir: ".",
  outputDir: "./test-results-auth",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: LOCAL, colorScheme: "dark" },
  webServer: {
    command: "sh -c 'npm run rebuild >/dev/null && npx next build >/dev/null && npx next start -p 3202'",
    cwd: path.resolve(__dirname, ".."),
    stdout: "ignore",
    stderr: "pipe",
    url: LOCAL,
    reuseExistingServer: false,
    timeout: 300_000,
  },
  projects: [
    { name: "clerk-logged-out-desktop", testMatch: /wall\.spec\.ts/, use: { viewport: { width: 1440, height: 900 } } },
    { name: "clerk-logged-out-phone", testMatch: /wall\.spec\.ts/, use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "clerk-setup", testMatch: /clerk\.setup\.ts/ },
    { name: "signed-in", testMatch: /logged-in\.spec\.ts/, dependencies: ["clerk-setup"], use: { viewport: { width: 1440, height: 900 } } },
  ],
});
