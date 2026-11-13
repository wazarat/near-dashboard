import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** The login wall, logged out (docs/ATLAS-UI.md, section 3, Access; rules in src/lib/gate.ts). */
const GATED = ["/funding/", "/investors/", "/security/"];
/** The thesis evidence: open to everyone, checked route by route in logged-out.spec.ts. */
const OPEN = ["/", "/thesis/", "/intents/", "/explorer/", "/sectors/", "/traction/"];
const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

// Under the Clerk config (`npm run e2e:auth`) the wall is only on when the build saw the development keys.
test.beforeEach(({}, info) => {
  const clerkRun = info.project.name.startsWith("clerk-");
  test.skip(clerkRun && !(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY), "No Clerk keys in the environment, so the Clerk run of the logged-out checks is skipped.");
});

async function guard(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "no horizontal overflow").toBeLessThanOrEqual(1);
}

for (const open of OPEN) {
  test(`${open} is public and the header offers Log in`, async ({ page }, info) => {
    const errors = await guard(page);
    await page.goto(open);
    await expect(page.getByTestId("header-login")).toBeVisible();
    // Log in, the tabs and the lockup share the header without overflowing it.
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await expect(page.getByTestId("login-dialog")).toHaveCount(0);
    await expect(page.getByTestId("login-wall")).toHaveCount(0);
    await expect(page.locator("[data-chart-card]").first()).toBeVisible({ timeout: 15_000 });
    await noOverflow(page);
    await page.screenshot({ path: path.join(SHOTS, `wall-public-${open === "/" ? "overview" : open.replace(/\//g, "")}-${info.project.name}.png`) });
    await page.getByTestId("header-login").click();
    await expect(page.getByTestId("login-dialog")).toBeVisible();
    if (open === "/") await page.screenshot({ path: path.join(SHOTS, `wall-header-login-${info.project.name}.png`) });
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("every tab stays in the header for a logged-out reader", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link")).toHaveText(["Overview", "Sectors", "Traction", "Intents", "Thesis", "Funding", "Investors", "Security", "Explorer", "Compare"]);
});

for (const route of GATED) {
  test(`${route} shows the login pop-up over an inert preview and keeps the URL`, async ({ page }, info) => {
    const errors = await guard(page);
    await page.goto(`${route}?q=rhea`);
    const dialog = page.getByTestId("login-dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByRole("heading", { name: "Log in for free access" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Log in", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Create free account" })).toBeVisible();
    await expect(page.getByTestId("login-wall").locator("[inert]")).toHaveCount(1);
    await expect(page).toHaveURL(new RegExp(`${route.replace(/\//g, "\\/")}\\?q=rhea`));
    if (route === "/funding/") await page.screenshot({ path: path.join(SHOTS, `wall-gated-funding-${info.project.name}.png`) });
    // Esc closes the pop-up; the page stays blurred with a way back in.
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Log in for free access" })).toBeVisible();
    await noOverflow(page);
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("a detail link on a gated tab waits for login instead of opening over the wall", async ({ page }) => {
  await page.goto("/funding/?project=near-intents");
  await expect(page.getByTestId("login-dialog")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("project-modal")).toHaveCount(0);
  await expect(page).toHaveURL(/project=near-intents/);
});

test("an expanded chart link on a gated tab stays closed", async ({ page }) => {
  await page.goto("/funding/?expand=funding-rounds");
  await expect(page.getByTestId("login-dialog")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-expanded-chart]")).toHaveCount(0);
});

test("an expanded chart link on a public tab still opens", async ({ page }) => {
  await page.goto("/thesis/?expand=thesis-levels");
  await expect(page.locator("[data-expanded-chart]")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("login-dialog")).toHaveCount(0);
});

test("Compare shows a comparison from the URL, and adding prompts login without changing it", async ({ page }, info) => {
  const errors = await guard(page);
  await page.goto("/compare/?compare=meta-pool,rhea-lst-rnear,linear-protocol");
  await expect(page.getByRole("main")).toContainText("Meta Pool", { timeout: 15_000 });
  await expect(page.getByRole("main")).toContainText("LiNEAR Protocol");
  await expect(page.getByTestId("login-dialog")).toHaveCount(0);
  await page.screenshot({ path: path.join(SHOTS, `wall-compare-${info.project.name}.png`) });
  await page.goto("/compare/?compare=meta-pool,rhea-lst-rnear&project=near-intents");
  await page.getByTestId("project-modal").getByTestId("compare-button").click();
  await expect(page.getByTestId("login-dialog")).toBeVisible();
  await expect(page).not.toHaveURL(/compare=[^&]*near-intents/);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("a compare preset prompts login and keeps the intended selection for after sign-in", async ({ page }) => {
  await page.goto("/compare/");
  await page.getByRole("button", { name: /Liquid staking/ }).first().click();
  await expect(page.getByTestId("login-dialog")).toBeVisible();
  await expect(page).not.toHaveURL(/compare=/);
  const saved = await page.evaluate(() => window.sessionStorage.getItem("atlas:pending-action"));
  const pending = JSON.parse(saved ?? "null") as { type: string; ids: string[] } | null;
  expect(pending?.type).toBe("compare-set");
  expect(pending?.ids.length).toBeGreaterThan(1);
});

test("removing from a comparison needs no login", async ({ page }) => {
  await page.goto("/compare/?compare=meta-pool,linear-protocol");
  const tray = page.getByTestId("compare-tray");
  await expect(tray).toBeVisible({ timeout: 15_000 });
  await tray.getByRole("button", { name: /Remove/ }).first().click();
  await expect(page.getByTestId("login-dialog")).toHaveCount(0);
  await expect(page).not.toHaveURL(/compare=meta-pool/);
});

test("a shared project link shows the header, Overview and Traction, the rest behind one panel", async ({ page }, info) => {
  const errors = await guard(page);
  await page.goto("/?project=near-intents");
  const modal = page.getByTestId("project-modal");
  await expect(modal.getByRole("heading", { name: "NEAR Intents", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(modal.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(modal.getByRole("heading", { name: "Traction" })).toBeVisible();
  await expect(modal.getByTestId("login-panel")).toHaveCount(1);
  for (const hidden of ["Activity", "History", "Funding", "Rounds", "Security", "Events", "Sources"]) await expect(modal.getByRole("heading", { name: hidden, exact: true })).toHaveCount(0);
  await expect(modal).not.toContainText("Similar projects");
  await page.screenshot({ path: path.join(SHOTS, `wall-project-${info.project.name}.png`) });
  await noOverflow(page);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("shared sector, investor and funding type links show a summary and one login panel", async ({ page }) => {
  await page.goto("/?fundingType=VC-backed");
  const funding = page.getByTestId("funding-type-modal");
  await expect(funding.getByRole("heading", { name: "VC-backed", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(funding.getByTestId("funding-type-summary")).toContainText(/^\d+ projects/);
  await expect(funding.getByTestId("login-panel")).toHaveCount(1);
  await expect(funding.getByRole("button", { name: "Filter the atlas to this type" })).toHaveCount(0);
  await expect(funding.locator("table")).toHaveCount(0);
  await page.goto("/?sectorDrawer=Lending+%26+Credit");
  const sector = page.getByTestId("sector-modal");
  await expect(sector.getByRole("heading", { name: "Lending & Credit" })).toBeVisible({ timeout: 15_000 });
  await expect(sector.getByTestId("login-panel")).toHaveCount(1);
  await expect(sector).not.toContainText("Ranked leaders");
  await page.goto("/?investor=dragonfly-capital");
  const investor = page.getByTestId("investor-modal");
  await expect(investor.getByTestId("login-panel")).toHaveCount(1, { timeout: 15_000 });
  await expect(investor).not.toContainText("Portfolio (");
});

test("About is open to a logged-out reader and states the independence line", async ({ page }) => {
  await page.goto("/about/");
  await expect(page.getByTestId("independence")).toContainText("no affiliation to NEAR Foundation or Aurora", { timeout: 15_000 });
  await expect(page.getByTestId("login-wall")).toHaveCount(0);
});

test("Help us track this is open to a logged-out reader", async ({ page }) => {
  await page.goto("/help-track/");
  await expect(page.getByTestId("help-track-group").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("login-wall")).toHaveCount(0);
  await expect(page.getByTestId("login-dialog")).toHaveCount(0);
});

test("the footer methodology is open on a gated tab", async ({ page }) => {
  await page.goto("/funding/");
  await expect(page.getByTestId("login-dialog")).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(page.locator("#methodology")).toContainText("Coverage terms");
  await expect(page.locator("#methodology").locator("xpath=ancestor-or-self::*[@inert]")).toHaveCount(0);
});
