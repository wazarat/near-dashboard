import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import { TEST_USER } from "./test-user";

/**
 * Signed-in run setup. With the Clerk development keys in the environment, makes sure the
 * test user exists, creating it through the Backend API if needed, and fetches a testing
 * token so Clerk's bot check lets the browser sign in. Without the keys it does nothing
 * and the signed-in tests skip.
 */
setup.describe.configure({ mode: "serial" });

setup("Clerk test user and testing token", async () => {
  const secret = process.env.CLERK_SECRET_KEY;
  setup.skip(!secret || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, "No Clerk keys in the environment, so there is no logged-in run.");
  if (!secret?.startsWith("sk_test_")) throw new Error("The logged-in run only uses a Clerk development instance (sk_test_ key).");
  const api = process.env.CLERK_API_URL ?? "https://api.clerk.com";
  const headers = { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };
  const found = await fetch(`${api}/v1/users?email_address=${encodeURIComponent(TEST_USER)}`, { headers });
  if (!found.ok) throw new Error(`Clerk user lookup failed (${found.status})`);
  if (((await found.json()) as unknown[]).length === 0) {
    const created = await fetch(`${api}/v1/users`, { method: "POST", headers, body: JSON.stringify({ email_address: [TEST_USER], skip_password_requirement: true }) });
    if (!created.ok) throw new Error(`Clerk test user creation failed (${created.status}): ${await created.text()}`);
  }
  await clerkSetup();
});
