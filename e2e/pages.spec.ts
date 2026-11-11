import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

/** Every page, plus a few states worth a picture. */
const PAGES: Array<{ name: string; url: string; expect: string }> = [
  { name: "overview", url: "/", expect: "Sectors by" },
  { name: "overview-tvl-log", url: "/?tm=tvl&cc=fees&scale=log", expect: "Concentration curve" },
  { name: "overview-modal", url: "/?project=near-intents", expect: "Similar projects" },
  { name: "sectors-modal", url: "/sectors/?sectorDrawer=Lending+%26+Credit", expect: "Ranked leaders" },
  { name: "sectors", url: "/sectors/", expect: "Sectors by" },
  { name: "traction", url: "/traction/", expect: "Leaderboard" },
  { name: "traction-fees-momentum", url: "/traction/?lb=fees&cols=momentum", expect: "Leaderboard" },
  { name: "funding", url: "/funding/", expect: "Rounds" },
  { name: "funding-type-modal", url: "/funding/?fundingType=VC-backed", expect: "Filter the atlas to this type" },
  { name: "security", url: "/security/", expect: "NEAR Intents" },
  { name: "explorer", url: "/explorer/", expect: "Download filtered CSV" },
  { name: "explorer-empty", url: "/explorer/?q=zzzzqqq", expect: "No projects match" },
  { name: "intents", url: "/intents/", expect: "Daily volume" },
  { name: "thesis", url: "/thesis/", expect: "Cross-chain volume through NEAR Intents" },
  { name: "investors", url: "/investors/?investor=dragonfly-capital", expect: "Portfolio (" },
  { name: "compare-empty", url: "/compare/", expect: "Liquid staking" },
  { name: "compare-liquid-staking", url: "/compare/?compare=meta-pool,rhea-lst-rnear,linear-protocol&cm=fees", expect: "Meta Pool" },
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

test("each chart owns its metric key; the treemap control writes tm and nothing else", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radiogroup", { name: "Treemap metric" }).getByRole("radio", { name: "Fees" }).click();
  await expect(page).toHaveURL(/tm=fees/);
  await expect(page).not.toHaveURL(/metric=/);
  await expect(page.getByRole("radiogroup", { name: "Concentration metric" }).getByRole("radio", { name: "TVL" })).toHaveAttribute("aria-checked", "true");
});

test("the legacy switch hides exactly the legacy listings and is counted as a filter", async ({ page }) => {
  await page.goto("/explorer/");
  const total = page.getByText(/Showing [\d,]+ of [\d,]+ projects/);
  await expect(total).toBeVisible();
  // Below the xl breakpoint the switch lives inside the Filters sheet.
  let sw = page.getByRole("switch", { name: "Hide legacy listings" }).first();
  if (!(await sw.isVisible())) {
    await page.getByRole("button", { name: /Filters/ }).click();
    sw = page.getByRole("switch", { name: "Hide legacy listings" }).first();
    await expect(sw).toBeVisible();
  }
  const legacyLabel = await page.getByText(/Hide legacy listings/).first().textContent();
  const legacyCount = Number(legacyLabel?.match(/\(([\d,]+)\)/)?.[1].replace(/,/g, ""));
  expect(legacyCount).toBeGreaterThan(0);
  await sw.click();
  await expect(page).toHaveURL(/legacy=hide/);
  await page.keyboard.press("Escape");
  const text = await total.textContent();
  const shown = Number(text?.match(/Showing ([\d,]+) of ([\d,]+)/)?.[1].replace(/,/g, ""));
  const all = Number(text?.match(/Showing ([\d,]+) of ([\d,]+)/)?.[2].replace(/,/g, ""));
  expect(all - shown).toBe(legacyCount);
  await expect(page.getByText("1 filter active").first()).toBeVisible();
});

test("expand opens a larger copy of the chart with a brush, writes ?expand= and closes on Escape", async ({ page }) => {
  await page.goto("/intents/");
  await page.getByRole("button", { name: "Expand Daily volume" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/expand=intents-volume/);
  await expect(dialog.locator(".recharts-brush")).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByRole("tab", { name: "Table" })).toBeVisible();
  const ids = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("[id]")).map((e) => e.id);
    return all.length - new Set(all).size;
  });
  expect(ids, "no duplicate ids while the dialog is open").toBe(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/expand=/);
});

test("a shared ?expand= link opens the dialog on load and level charts offer a From zero axis", async ({ page }) => {
  await page.goto("/?expand=chain-over-time");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog).toContainText("Chain over time");
  const axis = dialog.getByRole("radiogroup", { name: "Y axis" });
  await expect(axis.getByRole("radio", { name: "Fitted" })).toHaveAttribute("aria-checked", "true");
  // The first panel is NEAR chain TVL, a level series: fitted by default, from zero on request.
  const tvlPanel = dialog.locator(".recharts-wrapper").first();
  const zeroTick = tvlPanel.locator(".recharts-cartesian-axis-tick-value", { hasText: /^\$0$/ });
  await expect(tvlPanel.locator(".recharts-cartesian-axis-tick-value").first()).toBeVisible({ timeout: 15_000 });
  await expect(zeroTick).toHaveCount(0);
  await axis.getByRole("radio", { name: "From zero" }).click();
  await expect(zeroTick.first()).toBeVisible();
});

test("the treemap drills into a sector, opens a project from a tile and filters only on request", async ({ page }) => {
  await page.goto("/");
  const card = page.locator('[data-chart-card^="Sectors by"]');
  await expect(card.locator('[data-tile-kind="sector"]').first()).toBeVisible({ timeout: 15_000 });
  const total = page.getByText(/Showing [\d,]+ of [\d,]+ projects/);
  const before = await total.textContent();
  await card.locator('[data-tile-kind="sector"]').first().click();
  await expect(page).toHaveURL(/tmSector=/);
  await expect(page.getByRole("navigation", { name: "Treemap level" })).toContainText("All sectors");
  await expect(page.getByRole("navigation", { name: "Treemap level" }).locator("[aria-current=location]")).toBeVisible();
  await expect(total).toHaveText(before ?? "");
  await expect(page.getByRole("button", { name: "Filter to this sector" })).toBeVisible();
  await page.getByRole("button", { name: "Back to all sectors" }).click();
  await expect(page).not.toHaveURL(/tmSector=/);
  // A sector with fewer than three subcategories shows project tiles that open the project modal.
  await page.goto("/?tmSector=Lending+%26+Credit");
  const projectTile = page.locator('[data-chart-card^="Lending"] [data-tile-kind="project"]').first();
  await expect(projectTile).toBeVisible({ timeout: 15_000 });
  await projectTile.click();
  await expect(page).toHaveURL(/project=/);
  await expect(page.getByRole("dialog")).toContainText("Sources");
});

test("the timeline opens on 2024 and keeps earlier events one click away", async ({ page }) => {
  await page.goto("/");
  const card = page.locator('[data-chart-card="Timeline"]');
  const toggle = card.getByRole("button", { name: /Show earlier events \(\d+\)/ });
  await expect(toggle).toBeVisible({ timeout: 15_000 });
  const label = await toggle.textContent();
  const earlier = Number(label?.match(/\((\d+)\)/)?.[1]);
  expect(earlier).toBeGreaterThan(0);
  const markersBefore = await card.locator(".recharts-scatter-symbol").count();
  await toggle.click();
  await expect(card.getByRole("button", { name: /Hide events before/ })).toBeVisible();
  await expect.poll(() => card.locator(".recharts-scatter-symbol").count()).toBe(markersBefore + earlier);
});

test("the funding chart shows disclosed funding only and sums the rest in one line", async ({ page }) => {
  await page.goto("/funding/");
  const card = page.locator('[data-chart-card="Funding type"]');
  await expect(card.getByTestId("funding-coverage")).toBeVisible({ timeout: 15_000 });
  const text = (await card.getByTestId("funding-coverage").textContent()) ?? "";
  const nums = [...text.matchAll(/([\d,]+) (researched|with disclosed funding|not disclosed|not researched)/g)].map((m) => Number(m[1].replace(/,/g, "")));
  expect(nums).toHaveLength(4);
  const [researched, disclosed, notDisclosed, notResearched] = nums;
  expect(researched).toBe(disclosed + notDisclosed);
  const shown = Number((await page.getByText(/Showing [\d,]+ of [\d,]+ projects/).textContent())?.match(/Showing ([\d,]+)/)?.[1].replace(/,/g, ""));
  expect(researched + notResearched).toBe(shown);
  await expect(card.locator(".recharts-yAxis")).not.toContainText("Not disclosed");
  await expect(card.locator(".recharts-cartesian-axis-tick-value", { hasText: "Not researched" })).toHaveCount(0);
});

test("a funding type opens its projects and rounds in the modal and filters only on request", async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto("/funding/");
  const card = page.locator('[data-chart-card="Funding type"]');
  const entry = card.getByRole("button", { name: /^VC-backed \d+$/ });
  await expect(entry).toBeVisible({ timeout: 15_000 });
  const count = Number((await entry.textContent())?.match(/(\d+)$/)?.[1]);
  await entry.click();
  await expect(page).toHaveURL(/fundingType=VC-backed/);
  await expect(page).not.toHaveURL(/[?&]funding=/);
  const modal = page.getByTestId("funding-type-modal");
  await expect(modal.getByRole("heading", { name: "VC-backed", exact: true })).toBeVisible();
  await expect(modal.getByTestId("funding-type-summary")).toContainText(new RegExp(`^${count} projects`));
  await expect(modal.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await expect(modal.getByRole("heading", { name: "Rounds", exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "no horizontal overflow").toBeLessThanOrEqual(1);
  // The separate action applies the facet and closes the modal.
  await modal.getByRole("button", { name: "Filter the atlas to this type" }).click();
  await expect(page).toHaveURL(/[?&]funding=VC-backed/);
  await expect(page).not.toHaveURL(/fundingType=/);
  await expect(page.getByText(new RegExp(`Showing ${count} of 1,088 projects`))).toBeVisible();
  // A project opened from the modal replaces it.
  await page.goto("/funding/?fundingType=Token-funded");
  await expect(modal.getByRole("heading", { name: "Token-funded", exact: true })).toBeVisible({ timeout: 15_000 });
  await modal.locator("tbody tr").first().getByRole("button").first().click();
  await expect(page).toHaveURL(/project=/);
  await expect(page).not.toHaveURL(/fundingType=/);
  await expect(page.getByTestId("project-modal")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("security publishes facts, not ratings, and lists incidents as a sortable table", async ({ page }) => {
  await page.goto("/security/");
  await expect(page.locator('[data-chart-card="Security facts"]')).toContainText("No published audit found");
  await expect(page.getByText(/\b(High|Medium|Low) risk\b/)).toHaveCount(0);
  await expect(page.getByText(/Security risk levels|High and Medium risk projects/)).toHaveCount(0);
  const table = page.locator('[data-chart-card="Incidents"] table');
  await expect(table).toBeVisible();
  const first = await table.locator("tbody tr").first().locator("td").first().textContent();
  await table.getByRole("button", { name: /Date/ }).click();
  await expect.poll(async () => table.locator("tbody tr").first().locator("td").first().textContent()).not.toBe(first);
  // The explorer and the project modal carry no risk column or label either.
  await page.goto("/explorer/?project=near-intents");
  await expect(page.getByRole("dialog")).toContainText("Security");
  await expect(page.getByRole("dialog").getByText(/^(High|Medium|Low|Unknown)$/)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "Columns" }).click();
  await expect(page.getByRole("menuitemcheckbox", { name: "Security risk" })).toHaveCount(0);
});

test("whole-chain cards carry no scope note and do not change when a filter is applied", async ({ page }) => {
  await page.goto("/");
  const card = page.locator('[data-chart-card="Chain over time"]');
  const stats = card.getByTestId("range-stats").first();
  await expect(stats).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Whole chain, not filtered")).toHaveCount(0);
  await expect(card.locator("[data-scope]")).toHaveCount(0);
  const before = await stats.textContent();
  expect(before).toMatch(/^Low \$[\d.]+[KMB]?, high \$[\d.]+[KMB]?, [+-][\d.]+% over \d+ days$/);
  await page.goto("/?sector=Lending+%26+Credit");
  const after = page.locator('[data-chart-card="Chain over time"]');
  await expect(after.getByTestId("range-stats").first()).toHaveText(before ?? "");
  await expect(after.locator("[data-scope]")).toHaveCount(0);
  await expect(page.locator('[data-chart-card="Native vs imported"]').getByText("1 filter active")).toBeVisible();
});

test("KPI tiles use the short coverage text and the range line sits under its chart", async ({ page }, info) => {
  await page.goto("/");
  const subs = page.getByTestId("kpi-sub");
  await expect(subs.nth(1)).toHaveText(/^Tracked for [\d,]+\/1,088 projects$/, { timeout: 15_000 });
  const card = page.locator('[data-chart-card="Chain over time"]');
  const stats = card.getByTestId("range-stats").first();
  await expect(stats).toBeVisible({ timeout: 15_000 });
  const chartBox = await card.locator(".recharts-wrapper").first().boundingBox();
  const statsBox = await stats.boundingBox();
  expect((statsBox?.y ?? 0) >= (chartBox?.y ?? 0) + (chartBox?.height ?? 0) - 1, "the low, high and change line is below its chart").toBe(true);
  if (info.project.name.startsWith("desktop")) {
    const count = await page.getByTestId("result-count").boundingBox();
    const actions = await page.getByTestId("filter-actions").boundingBox();
    expect((actions?.y ?? 0) > (count?.y ?? 0), "Reset and Copy link sit under the result count").toBe(true);
  }
});

test("chart cards offer a table view", async ({ page }) => {
  await page.goto("/");
  const toggles = page.getByRole("tab", { name: "Table" });
  // count() does not wait, so let the client shell render its cards first.
  await expect(toggles.nth(2)).toBeAttached();
  expect(await toggles.count()).toBeGreaterThan(2);
  await toggles.first().click();
  await expect(page.locator("table").first()).toBeVisible();
});

test("project modal opens from the leaderboard and shows sources", async ({ page }) => {
  await page.goto("/traction/");
  await page.getByRole("button", { name: "NEAR Intents" }).first().click();
  await expect(page).toHaveURL(/project=near-intents/);
  await expect(page.getByRole("dialog")).toContainText("Sources");
});

test("project modal opens from a shared URL with history tabs", async ({ page }) => {
  await page.goto("/traction/?project=meta-pool&range=30d");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Meta Pool", { timeout: 15_000 });
  await expect(dialog).toContainText("History");
});

test("thesis charts expose a Query tab with SQL", async ({ page }) => {
  await page.goto("/thesis/");
  const query = page.getByRole("tab", { name: "Query" });
  await expect(query.nth(2)).toBeAttached();
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

test("investor modal opens from the investors table", async ({ page }) => {
  await page.goto("/investors/");
  await page.locator("table").getByRole("button", { name: "Pantera Capital", exact: true }).first().click();
  await expect(page).toHaveURL(/investor=pantera-capital/);
  await expect(page.getByRole("dialog")).toContainText("Pantera Capital");
});

test("project detail is a centred modal on desktop and a full sheet on a phone, and Escape clears the URL", async ({ page }, info) => {
  await page.goto("/?project=near-intents");
  const modal = page.getByTestId("project-modal");
  await expect(modal).toContainText("NEAR Intents", { timeout: 15_000 });
  // Sector and native chain are one line of plain text, not badges.
  await expect(modal).toContainText("Bridges & Interoperability, NEAR native");
  const box = await modal.boundingBox();
  const vw = page.viewportSize()?.width ?? 0;
  expect(box).not.toBeNull();
  if (info.project.name.startsWith("phone")) expect(box?.width ?? 0).toBeGreaterThanOrEqual(vw - 1);
  else expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - vw / 2)).toBeLessThanOrEqual(2);
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(page).not.toHaveURL(/project=/);
});

test("a project opened from the sector modal replaces it instead of stacking", async ({ page }) => {
  await page.goto("/sectors/?sectorDrawer=Lending+%26+Credit");
  const sector = page.getByTestId("sector-modal");
  await expect(sector).toContainText("Ranked leaders", { timeout: 15_000 });
  await sector.locator("ul button").first().click();
  await expect(page).toHaveURL(/project=/);
  await expect(page).not.toHaveURL(/sectorDrawer=/);
  await expect(page.getByTestId("project-modal")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
});

test("a project opened from the investor modal replaces it instead of stacking", async ({ page }) => {
  await page.goto("/investors/?investor=dragonfly-capital");
  const investor = page.getByTestId("investor-modal");
  await expect(investor).toContainText("Portfolio (", { timeout: 15_000 });
  await investor.locator("ul button").first().click();
  await expect(page).toHaveURL(/project=/);
  await expect(page).not.toHaveURL(/investor=/);
  await expect(page.getByTestId("project-modal")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
});

test("the sector modal follows the active filters and says so", async ({ page }) => {
  await page.goto("/sectors/?chain=NEAR+native&sectorDrawer=Lending+%26+Credit");
  const sector = page.getByTestId("sector-modal");
  await expect(sector).toContainText("1 filter active", { timeout: 15_000 });
  await expect(sector).toContainText(/(\d+) projects, \1 NEAR-native/);
});

/** What the page queued for Vercel Web Analytics (src/lib/track.ts sets up the queue; no script runs off Vercel). */
async function queued(page: Page): Promise<Array<{ name: string; data: Record<string, string | number> }>> {
  return page.evaluate(() => {
    const q = (window as unknown as { vaq?: unknown[][] }).vaq ?? [];
    return q.filter((e) => e[0] === "event").map((e) => e[1] as { name: string; data: Record<string, string | number> });
  });
}

test("analytics events carry closed-set properties only", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one run is enough, the events do not depend on the viewport or theme");
  await page.goto("/?q=rhea");
  await expect.poll(async () => (await queued(page)).map((e) => e.name)).toContain("tab_view");
  // A value the link arrived with is not a filter use.
  expect((await queued(page)).filter((e) => e.name === "filter_use")).toEqual([]);

  await page.getByPlaceholder(/Search name/).fill("meta pool");
  await expect.poll(async () => (await queued(page)).find((e) => e.name === "filter_use")?.data).toEqual({ filter: "q", page: "overview" });

  await page.getByRole("button", { name: "Expand Chain over time" }).click();
  await expect.poll(async () => (await queued(page)).find((e) => e.name === "chart_expand")?.data).toEqual({ chart: "chain-over-time", auth: "off" });
  await page.keyboard.press("Escape");

  await page.goto("/traction/");
  await page.getByRole("button", { name: "NEAR Intents" }).first().click();
  await expect.poll(async () => (await queued(page)).find((e) => e.name === "project_open")?.data).toEqual({ sector: "Bridges & Interoperability", auth: "off" });
  await page.getByTestId("project-modal").getByTestId("compare-button").click();
  await expect.poll(async () => (await queued(page)).find((e) => e.name === "compare_add")?.data).toEqual({ count: 1, auth: "off" });

  await page.goto("/investors/?investor=dragonfly-capital");
  await expect.poll(async () => (await queued(page)).find((e) => e.name === "investor_open")?.data).toEqual({ page: "investors", auth: "off" });

  await page.goto("/thesis/");
  await page.getByRole("tab", { name: "Query" }).first().click();
  await expect.poll(async () => (await queued(page)).find((e) => e.name === "chart_view")?.data).toEqual({ view: "query", page: "thesis" });

  // Nothing typed, no project id, no investor and no URL ever appears in what is queued.
  const all = JSON.stringify(await queued(page));
  expect(all).not.toMatch(/meta pool|rhea|dragonfly|near-intents|https?:/i);
});

test("card summaries show as points in the expanded view, and stay on the card for Thesis and Intents", async ({ page }) => {
  await page.goto("/");
  const card = page.locator('[data-chart-card="Native vs imported"]');
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.getByTestId("takeaway")).toHaveCount(0);
  await page.goto("/?expand=native-vs-imported");
  const dialog = page.locator('[data-expanded-chart="native-vs-imported"]');
  await expect(dialog.getByTestId("takeaway")).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByTestId("takeaway").locator("li").first()).toContainText(/NEAR-native/);
  // The pages whose summaries are the argument keep them on the card.
  await page.goto("/thesis/");
  const thesis = page.locator("[data-chart-card]").first();
  await expect(thesis.locator("p").first()).not.toBeEmpty();
  await page.goto("/intents/");
  await expect(page.locator('[data-chart-card]').first().locator("p").first()).not.toBeEmpty();
});
