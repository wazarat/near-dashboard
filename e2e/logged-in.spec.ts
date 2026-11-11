import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";
import { TEST_USER } from "./test-user";

/**
 * The login wall, signed in: every gated tab opens with no wall, the project pop-up shows all of
 * its sections, and a compare selection clicked before logging in is written after. Uses the test
 * user through @clerk/testing; skips without the Clerk development keys.
 */
test.skip(!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, "No Clerk keys in the environment, so the signed-in run is skipped.");

const TABS = ["/sectors/", "/traction/", "/intents/", "/funding/", "/investors/", "/security/", "/explorer/"];

function watch(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test("every gated tab opens with no wall once signed in", async ({ page }) => {
  const errors = watch(page);
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: TEST_USER });
  await expect(page.getByTestId("header-login")).toHaveCount(0);
  for (const tab of TABS) {
    await page.goto(tab);
    await expect(page.locator("main [data-slot=card]").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("login-wall")).toHaveCount(0);
    await expect(page.getByTestId("login-dialog")).toHaveCount(0);
  }
  await page.goto("/?project=near-intents");
  const modal = page.getByTestId("project-modal");
  await expect(modal.getByRole("heading", { name: "Sources" })).toBeVisible({ timeout: 15_000 });
  await expect(modal.getByTestId("login-panel")).toHaveCount(0);
  await page.goto("/intents/?expand=intents-volume");
  await expect(page.locator("[data-expanded-chart]")).toBeVisible({ timeout: 15_000 });
  expect(errors, errors.join("\n")).toEqual([]);
});

test("a compare preset clicked while logged out is applied after login", async ({ page }) => {
  const errors = watch(page);
  await page.goto("/compare/");
  await page.getByRole("button", { name: /Liquid staking/ }).first().click();
  await expect(page.getByTestId("login-dialog")).toBeVisible();
  await expect(page).not.toHaveURL(/compare=/);
  await clerk.signIn({ page, emailAddress: TEST_USER });
  await expect(page).toHaveURL(/compare=/, { timeout: 15_000 });
  const dialogs = page.getByRole("dialog");
  for (let i = 0; i < 3 && (await dialogs.count()) > 0; i++) await page.keyboard.press("Escape");
  await expect(page.getByText(/Compare 3/).first()).toBeVisible({ timeout: 15_000 });
  expect(errors, errors.join("\n")).toEqual([]);
});

test("Clerk's sign-in form takes clicks when it opens from inside the project pop-up", async ({ page }) => {
  // An open Radix dialog sets pointer-events none on the body; the form must not inherit it (src/lib/clerk-appearance.ts).
  await page.goto("/?project=near-intents");
  await page.getByTestId("project-modal").getByTestId("login-panel").getByRole("button", { name: "Log in", exact: true }).click();
  const field = page.locator(".cl-signIn-root input").first();
  await expect(field).toBeVisible({ timeout: 15_000 });
  await field.click({ trial: true, timeout: 5_000 });
});
