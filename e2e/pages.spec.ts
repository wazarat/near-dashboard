import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

/** Every page, plus a few states worth a picture. */
const PAGES: Array<{ name: string; url: string; expect: string }> = [
  { name: "overview", url: "/", expect: "Sectors by" },
  { name: "overview-tvl-log", url: "/?metric=tvl&scale=log", expect: "Concentration curve" },
  { name: "overview-drawer", url: "/?project=near-intents", expect: "Similar projects" },
  { name: "sectors", url: "/sectors/", expect: "Sectors by" },
  { name: "traction", url: "/traction/", expect: "Leaderboard" },
  { name: "traction-fees-momentum", url: "/traction/?metric=fees&cols=momentum", expect: "Leaderboard" },
  { name: "funding", url: "/funding/", expect: "Rounds" },
  { name: "security", url: "/security/", expect: "NEAR Intents" },
  { name: "explorer", url: "/explorer/", expect: "Download filtered CSV" },
  { name: "explorer-empty", url: "/explorer/?q=zzzzqqq", expect: "No projects match" },
  { name: "intents", url: "/intents/", expect: "Daily volume" },
  { name: "thesis", url: "/thesis/", expect: "Cross-chain volume through NEAR Intents" },
  { name: "investors", url: "/investors/?investor=dragonfly-capital", expect: "Portfolio (" },
  { name: "compare-empty", url: "/compare/", expect: "Liquid staking" },
  { name: "compare-liquid-staking", url: "/compare/?compare=meta-pool,rhea-lst-rnear,linear-protocol&metric=tvl", expect: "Meta Pool" },
];

async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

for (const p of PAGES) {
  test(`${p.name} renders without console errors`, async ({ page }, info) => {
    const errors = await collectErrors(page);
    await page.goto(p.url);
    await expect(page.getByText(p.expect).first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "no horizontal overflow").toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.join(SHOTS, `${p.name}-${info.project.name}.png`), fullPage: true });
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("filters round-trip through the URL and the count updates", async ({ page }) => {
  await page.goto("/?sector=Lending+%26+Credit&chain=NEAR+native");
  await expect(page.getByText(/Showing \d+ of 1,088 projects/)).toBeVisible();
  const text = await page.getByText(/Showing \d+ of 1,088 projects/).textContent();
  const n = Number(text?.match(/Showing ([\d,]+)/)?.[1].replace(/,/g, ""));
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThan(1088);
  await page.goto("/?q=rhea");
  await expect(page.getByText(/Showing \d+ of 1,088 projects/)).toBeVisible();
});

test("metric switcher writes the URL", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Fees" }).or(page.getByRole("button", { name: "Fees" })).first().click();
  await expect(page).toHaveURL(/metric=fees/);
});

test("chart cards offer a table view", async ({ page }) => {
  await page.goto("/");
  const toggles = page.getByRole("radio", { name: "Table" }).or(page.getByRole("button", { name: "Table" }));
  expect(await toggles.count()).toBeGreaterThan(2);
  await toggles.first().click();
  await expect(page.locator("table").first()).toBeVisible();
});

test("project drawer opens from the leaderboard and shows sources", async ({ page }) => {
  await page.goto("/traction/");
  await page.getByRole("button", { name: "NEAR Intents" }).first().click();
  await expect(page).toHaveURL(/project=near-intents/);
  await expect(page.getByRole("dialog")).toContainText("Sources");
});

test("project drawer opens from a shared URL with history tabs", async ({ page }) => {
  await page.goto("/traction/?project=meta-pool&range=30d");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Meta Pool", { timeout: 15_000 });
  await expect(dialog).toContainText("History");
});

test("thesis charts expose a Query tab with SQL", async ({ page }) => {
  await page.goto("/thesis/");
  const query = page.getByRole("radio", { name: "Query" }).or(page.getByRole("button", { name: "Query" }));
  expect(await query.count()).toBeGreaterThan(2);
  await query.first().click();
  await expect(page.locator("pre").first()).toBeVisible();
  await expect(page.locator("pre").first()).toContainText(/SELECT|GET|weekly/);
});

test("compare tray and presets drive the URL", async ({ page }) => {
  await page.goto("/compare/");
  await page.getByRole("button", { name: /Liquid staking/ }).first().click();
  await expect(page).toHaveURL(/compare=/);
  await expect(page.getByText(/Compare 3/).first()).toBeVisible();
});

test("investor drawer opens from the investors table", async ({ page }) => {
  await page.goto("/investors/");
  await page.locator("table").getByRole("button", { name: "Pantera Capital", exact: true }).first().click();
  await expect(page).toHaveURL(/investor=pantera-capital/);
  await expect(page.getByRole("dialog")).toContainText("Pantera Capital");
});
