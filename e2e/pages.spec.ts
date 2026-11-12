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
  { name: "explorer-map", url: "/explorer/?view=map", expect: "Box size is" },
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

test("the tabs sit in the header row from 1360px and drop to their own row below it", async ({ page }) => {
  const rows = async () =>
    page.evaluate(() => {
      const top = (s: string) => Math.round(document.querySelector(s)?.getBoundingClientRect().top ?? -1);
      const nav = document.querySelector('header nav[aria-label="Primary"]') as HTMLElement;
      return { lockup: top('header a[href="/"]'), tabs: top('[data-testid="header-tabs"]'), overflow: nav.scrollWidth - nav.clientWidth, page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
  for (const [width, inline] of [[1440, true], [1360, true], [1280, false], [390, false]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Compare" })).toBeVisible({ timeout: 15_000 });
    const r = await rows();
    expect(r.page, `no page overflow at ${width}`).toBeLessThanOrEqual(1);
    if (inline) {
      expect(r.tabs, `tabs share the lockup's row at ${width}`).toBe(r.lockup);
      expect(r.overflow, `every tab visible at ${width}`).toBeLessThanOrEqual(0);
    } else {
      expect(r.tabs, `tabs on their own row at ${width}`).toBeGreaterThan(r.lockup);
    }
  }
});

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

test("legacy listings are hidden by default and each card has its own switch to include them", async ({ page }) => {
  const errors = await collectErrors(page);
  const nums = (t: string | null) => (t?.match(/Showing ([\d,]+) of ([\d,]+)/) ?? []).slice(1).map((v) => Number(v.replace(/,/g, "")));
  await page.goto("/");
  const total = page.getByTestId("result-count");
  await expect(total).toBeVisible({ timeout: 15_000 });
  const [shown, all] = nums(await total.textContent());
  expect(shown).toBeLessThan(all);
  const legacyCount = all - shown;
  await expect(page.getByRole("switch", { name: /legacy/i })).toHaveCount(4);
  await expect(page.locator("[data-scope]")).toHaveCount(0);
  const kpi = page.getByTestId("kpi-sub").first();
  const kpiBefore = await kpi.textContent();
  const projectsTile = Number((await page.getByText(/^Selection, [\d,]+ of [\d,]+ projects/).textContent())?.match(/Selection, ([\d,]+)/)?.[1].replace(/,/g, ""));
  expect(projectsTile).toBe(shown);
  // The treemap's own switch brings the legacy listings back into that card only.
  const map = page.locator('[data-chart-card^="Sectors by"]');
  const mapTable = async () => {
    await map.getByRole("tablist", { name: "View as" }).getByRole("tab", { name: "Table" }).click();
    const cells = await map.locator("tbody tr td:nth-child(3)").allTextContents();
    await map.getByRole("tablist", { name: "View as" }).getByRole("tab", { name: "Chart" }).click();
    return cells.reduce((a, c) => a + Number(c.replace(/,/g, "")), 0);
  };
  const before = await mapTable();
  expect(before).toBe(shown);
  await page.getByTestId("legacy-sectors").click();
  await expect(page).toHaveURL(/[?&]legacy=sectors/);
  await expect(map.locator("[data-scope]")).toHaveText("Includes legacy listings");
  expect(await mapTable()).toBe(shown + legacyCount);
  await expect(kpi).toHaveText(kpiBefore ?? "");
  await expect(total).toHaveText(new RegExp(`Showing ${shown.toLocaleString("en-US")} of`));
  await page.getByTestId("legacy-sectors").click();
  await expect(page).not.toHaveURL(/[?&]legacy=/);
  // The Status filter shows them when Legacy listing is picked by name.
  await page.goto("/explorer/?status=Legacy+listing");
  await expect(page.getByTestId("result-count")).toContainText(`Showing ${legacyCount.toLocaleString("en-US")} of`, { timeout: 15_000 });
  expect(errors, errors.join("\n")).toEqual([]);
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

test("the explorer opens on its table and offers the sector map of the same selection", async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto("/explorer/");
  const card = page.getByTestId("explorer-card");
  const tabs = card.getByRole("tablist", { name: "Explorer view" });
  await expect(tabs.getByRole("tab", { name: "Table" })).toHaveAttribute("aria-selected", "true", { timeout: 15_000 });
  await expect(card.locator("table")).toBeVisible();
  await expect(page.getByTestId("explorer-map")).toHaveCount(0);
  await tabs.getByRole("tab", { name: "Map" }).click();
  await expect(page).toHaveURL(/view=map/);
  const map = page.getByTestId("explorer-map");
  await expect(map.locator('[data-tile-kind="sector"]').first()).toBeVisible();
  await expect(card.locator("table")).toHaveCount(0);
  // The map keeps the treemap's zoom, and filters only on request.
  const total = page.getByText(/Showing [\d,]+ of [\d,]+ projects/);
  const before = await total.textContent();
  await map.locator('[data-tile-kind="sector"]').first().click();
  await expect(page).toHaveURL(/tmSector=/);
  await expect(map.getByRole("navigation", { name: "Treemap level" }).locator("[aria-current=location]")).toBeVisible();
  await expect(total).toHaveText(before ?? "");
  await map.getByRole("button", { name: "Back to all sectors" }).click();
  await expect(page).not.toHaveURL(/tmSector=/);
  await card.getByRole("radiogroup", { name: "Map metric" }).getByRole("radio", { name: "TVL" }).click();
  await expect(page).toHaveURL(/tm=tvl/);
  await tabs.getByRole("tab", { name: "Table" }).click();
  await expect(page).not.toHaveURL(/view=/);
  await expect(card.locator("table")).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("the explorer search writes the same q as the filter bar and its count follows", async ({ page }) => {
  await page.goto("/explorer/");
  const box = page.getByTestId("explorer-search");
  await expect(box).toBeVisible({ timeout: 15_000 });
  const base = (await page.getByTestId("result-count").textContent())?.match(/Showing ([\d,]+)/)?.[1];
  await expect(page.getByTestId("explorer-count")).toHaveText(`${base} projects`);
  await box.fill("rhea");
  await expect(page).toHaveURL(/q=rhea/);
  await expect(page.getByPlaceholder(/Search name/)).toHaveValue("rhea");
  const shown = Number((await page.getByText(/Showing [\d,]+ of 1,088 projects/).textContent())?.match(/Showing ([\d,]+)/)?.[1].replace(/,/g, ""));
  expect(shown).toBeGreaterThan(0);
  await expect(page.getByTestId("explorer-count")).toHaveText(`${shown} ${shown === 1 ? "project" : "projects"}`);
  // An edit in the filter bar shows in the explorer box too.
  await page.getByPlaceholder(/Search name/).fill("aurora");
  await expect(box).toHaveValue("aurora");
});

test("the timeline opens on its table, and its chart opens on 2024 with earlier events one click away", async ({ page }) => {
  await page.goto("/");
  const card = page.locator('[data-chart-card="Timeline"]');
  const views = card.getByRole("tablist", { name: "View as" });
  await expect(views.getByRole("tab", { name: "Table" })).toHaveAttribute("aria-selected", "true", { timeout: 15_000 });
  await expect(card.locator("thead th")).toHaveText(["Date", "Type", "Event", "Projects", "Amount (USD)"]);
  await expect(card.locator(".recharts-scatter-symbol")).toHaveCount(0);
  await views.getByRole("tab", { name: "Chart" }).click();
  const toggle = card.getByRole("button", { name: /Show earlier events \(\d+\)/ });
  await expect(toggle).toBeVisible();
  const label = await toggle.textContent();
  const earlier = Number(label?.match(/\((\d+)\)/)?.[1]);
  expect(earlier).toBeGreaterThan(0);
  const markersBefore = await card.locator(".recharts-scatter-symbol").count();
  await toggle.click();
  await expect(card.getByRole("button", { name: /Hide events before/ })).toBeVisible();
  await expect.poll(() => card.locator(".recharts-scatter-symbol").count()).toBe(markersBefore + earlier);
});

test("a timeline row opens the event pop-up with its source, kept in the URL", async ({ page }, info) => {
  const errors = await collectErrors(page);
  await page.goto("/");
  const card = page.locator('[data-chart-card="Timeline"]');
  const first = card.locator("tbody tr").first();
  await expect(first).toBeVisible({ timeout: 15_000 });
  const title = (await first.getByRole("button").textContent()) ?? "";
  await first.getByRole("button").click();
  await expect(page).toHaveURL(/[?&]event=/);
  const modal = page.getByTestId("event-modal");
  await expect(modal.getByRole("heading", { name: title, exact: true })).toBeVisible();
  for (const label of ["Projects", "Amount", "Source"]) await expect(modal.locator("dt", { hasText: new RegExp(`^${label}$`) })).toBeVisible();
  // Every recorded source link is offered as it is.
  await expect(modal.locator("dd a[href^='http']")).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "no horizontal overflow").toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(SHOTS, `event-modal-${info.project.name}.png`) });
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(page).not.toHaveURL(/[?&]event=/);
  // A chart marker opens the same pop-up.
  await card.getByRole("tablist", { name: "View as" }).getByRole("tab", { name: "Chart" }).click();
  await card.locator(".recharts-scatter-symbol").last().click({ force: true });
  await expect(page).toHaveURL(/[?&]event=/);
  await expect(modal).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("an event opened from a project's Events list sits over the project and closes back to it", async ({ page }) => {
  await page.goto("/?project=near-intents");
  const project = page.getByTestId("project-modal");
  const events = project.locator("section", { has: page.getByRole("heading", { name: "Events", exact: true }) });
  await expect(events).toBeVisible({ timeout: 15_000 });
  await events.getByRole("button").first().click();
  await expect(page).toHaveURL(/[?&]event=/);
  await expect(page).toHaveURL(/project=near-intents/);
  const modal = page.getByTestId("event-modal");
  await expect(modal).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(project).toBeVisible();
  await expect(page).toHaveURL(/project=near-intents/);
});

test("each card owns its time range under its own URL key, and the filter bar has none", async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto("/");
  const group = (name: string) => page.getByRole("radiogroup", { name });
  const cot = group("Chain over time range");
  await expect(cot.getByRole("radio", { name: "30d" })).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
  await expect(group("Date range")).toHaveCount(0);
  const card = page.locator('[data-chart-card="Chain over time"]');
  const stats = card.getByTestId("range-stats").first();
  // The level series keeps its 90-day floor, so its stats line reads 90 days at 30d.
  await expect(stats).toHaveText(/over 90 days$/);
  await expect(card).toContainText("flows follow the range control (last 30 days)");
  await cot.getByRole("radio", { name: "90d" }).click();
  await expect(page).toHaveURL(/[?&]cr=90d/);
  await expect(page).not.toHaveURL(/[?&]range=/);
  await expect(card).toContainText("Every panel covers the last 90 days");
  // Nothing else on the page moved.
  await expect(group("Chain activity range").getByRole("radio", { name: "30d" })).toHaveAttribute("aria-checked", "true");
  await expect(group("Movers range").getByRole("radio", { name: "30d" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator('[data-chart-card^="Risers and fallers"]')).toHaveAttribute("data-chart-card", "Risers and fallers (30d)");
  await group("Movers range").getByRole("radio", { name: "7d" }).click();
  await expect(page).toHaveURL(/[?&]mr=7d/);
  await expect(page.locator('[data-chart-card="Risers and fallers (7d)"]')).toBeVisible();
  await expect(cot.getByRole("radio", { name: "90d" })).toHaveAttribute("aria-checked", "true");
  // Back at the default the key leaves the URL.
  await cot.getByRole("radio", { name: "30d" }).click();
  await expect(page).not.toHaveURL(/[?&]cr=/);
  await expect(page).toHaveURL(/[?&]mr=7d/);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("a link shared with the old global range still opens every card on it", async ({ page }) => {
  await page.goto("/?range=90d");
  const group = (name: string) => page.getByRole("radiogroup", { name });
  for (const name of ["Chain over time range", "Chain activity range", "Movers range"]) await expect(group(name).getByRole("radio", { name: "90d" })).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
  // A pick on one card overrides the old key for that card only.
  await group("Chain activity range").getByRole("radio", { name: "30d" }).click();
  await expect(page).toHaveURL(/[?&]ar=30d/);
  await expect(page).toHaveURL(/[?&]range=90d/);
  await expect(group("Chain over time range").getByRole("radio", { name: "90d" })).toHaveAttribute("aria-checked", "true");
  // The old key follows the reader to another page, as it always did.
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Intents" }).click();
  await expect(page).toHaveURL(/\/intents\/\?.*range=90d/);
  await expect(group("Daily volume range").getByRole("radio", { name: "90d" })).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
});

test("Intents, Traction, Compare and the project pop-up each keep their own range", async ({ page }) => {
  const group = (name: string) => page.getByRole("radiogroup", { name });
  await page.goto("/intents/");
  await expect(group("Daily volume range").getByRole("radio", { name: "30d" })).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
  await group("Daily volume range").getByRole("radio", { name: "All" }).click();
  await expect(page).toHaveURL(/[?&]ir=all/);
  await expect(group("Outcome rates range").getByRole("radio", { name: "30d" })).toHaveAttribute("aria-checked", "true");
  await group("Outcome rates range").getByRole("radio", { name: "7d" }).click();
  await expect(page).toHaveURL(/[?&]rr=7d/);

  // The leaderboard's range drives its Trend column; the Activity column set has no Trend column and stays available.
  await page.goto("/traction/");
  const board = page.locator('[data-chart-card="Leaderboard"]');
  await expect(board.locator("thead")).toContainText("Trend (30d)", { timeout: 15_000 });
  await group("Leaderboard trend range").getByRole("radio", { name: "7d" }).click();
  await expect(page).toHaveURL(/[?&]lr=7d/);
  await expect(board.locator("thead")).toContainText("Trend (7d)");
  await group("Column set").getByRole("radio", { name: "Activity" }).click();
  await expect(board.locator("thead")).toContainText("7d function calls");
  await expect(group("Leaderboard trend range")).toHaveCount(0);

  await page.goto("/compare/?compare=meta-pool,rhea-lst-rnear,linear-protocol");
  await expect(group("Trend range").getByRole("radio", { name: "30d" })).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
  await group("Trend range").getByRole("radio", { name: "90d" }).click();
  await expect(page).toHaveURL(/[?&]xr=90d/);

  await page.goto("/?project=near-intents");
  const history = page.getByTestId("project-modal").getByRole("radiogroup", { name: "History range" });
  await expect(history.getByRole("radio", { name: "30d" })).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
  await history.getByRole("radio", { name: "All" }).click();
  await expect(page).toHaveURL(/[?&]hr=all/);
  // The Overview card behind the pop-up is untouched (it is hidden from the accessibility tree while the pop-up is open).
  await expect(page.locator('[role="radiogroup"][aria-label="Chain over time range"] [aria-checked="true"]')).toHaveText("30d");
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

test("tables of records keep the count out of the title and in their own Showing line", async ({ page }) => {
  const nums = (t: string | null) => (t?.match(/Showing ([\d,]+) of ([\d,]+)/) ?? []).slice(1).map((v) => Number(v.replace(/,/g, "")));
  await page.goto("/funding/?sector=Lending+%26+Credit");
  const roundsCard = page.locator('[data-chart-card="Funding rounds"]');
  await expect(roundsCard.getByRole("heading", { name: "Funding rounds", exact: true })).toBeVisible({ timeout: 15_000 });
  const roundsLine = roundsCard.getByTestId("showing-line");
  await expect(roundsLine).toHaveText(/^Showing \d+ of \d+ rounds$/);
  const [allShown, allTotal] = nums(await roundsLine.textContent());
  expect(allShown).toBe(allTotal);
  // The line follows the table's own filter.
  await roundsCard.getByRole("checkbox").click();
  await expect.poll(async () => nums(await roundsLine.textContent())[0]).toBeLessThan(allTotal);
  expect(nums(await roundsLine.textContent())[1]).toBe(allTotal);

  await page.goto("/investors/");
  const investorsCard = page.locator('[data-chart-card="Investors"]');
  await expect(investorsCard.getByRole("heading", { name: "Investors", exact: true })).toBeVisible({ timeout: 15_000 });
  const [invShown, invTotal] = nums(await investorsCard.getByTestId("showing-line").textContent());
  expect(invShown).toBeGreaterThan(0);
  expect(invShown).toBe(invTotal);

  await page.goto("/explorer/");
  const newly = page.getByRole("heading", { name: "Newly detected", exact: true });
  if ((await newly.count()) > 0) {
    const line = page.getByText(/^Showing \d+ of \d+ protocols$/);
    const [shown, total] = nums(await line.textContent());
    expect(shown).toBeLessThanOrEqual(total);
    if (shown < total) {
      await page.getByRole("button", { name: `Show all ${total}` }).click();
      await expect(line).toHaveText(`Showing ${total} of ${total} protocols`);
    }
  }
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

test("with no filter the chain cards show chain totals and carry no scope note", async ({ page }) => {
  await page.goto("/");
  const card = page.locator('[data-chart-card="Chain over time"]');
  const stats = card.getByTestId("range-stats").first();
  await expect(stats).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Whole chain, not filtered")).toHaveCount(0);
  await expect(card.locator("[data-scope]")).toHaveCount(0);
  await expect(page.locator('[data-chart-card="Chain activity"] [data-scope]')).toHaveCount(0);
  await expect(page.locator('[data-chart-card="Timeline"] [data-scope]')).toHaveCount(0);
  expect(await stats.textContent()).toMatch(/^Low \$[\d.]+[KMB]?, high \$[\d.]+[KMB]?, [+-][\d.]+% over \d+ days$/);
});

test("with a filter every Overview card follows it, the chain cards switching to the selection", async ({ page }, info) => {
  const errors = await collectErrors(page);
  await page.goto("/");
  const chainStats = await page.locator('[data-chart-card="Chain over time"]').getByTestId("range-stats").first().textContent({ timeout: 15_000 });
  const timeline = page.locator('[data-chart-card="Timeline"]');
  await expect(timeline.locator("tbody tr").first()).toBeVisible();
  const allRows = await timeline.locator("tbody tr").count();

  await page.goto("/?chain=Other+EVM");
  await expect(page.locator('[data-chart-card="Chain over time"]')).toHaveCount(0, { timeout: 15_000 });
  const sel = page.locator('[data-chart-card="Selection over time"]');
  await expect(sel.locator("[data-scope]")).toHaveText("1 filter active");
  const selStats = sel.getByTestId("range-stats").first();
  await expect(selStats).toBeVisible();
  expect(await selStats.textContent()).not.toBe(chainStats);
  await expect(sel).toContainText(/Summed from DefiLlama history for \d+ of \d+ selected projects/);
  await expect(sel).toContainText("of the summed TVL of every tracked project");
  // The KPI TVL tile compares the selection with all summed TVL, not with the chain total.
  await expect(page.getByText(/^[\d.]+% of all summed TVL$/)).toBeVisible();
  await expect(page.getByText(/^Chain TVL \$/)).toHaveCount(0);

  const activity = page.locator('[data-chart-card="Chain activity"]');
  await expect(activity.locator("[data-scope]")).toHaveText("1 filter active");
  await expect(activity.getByText("Function calls to the selection's tracked contracts (BigQuery)")).toBeVisible();
  await expect(activity.getByTestId("panel-scope").filter({ hasText: "Selection" })).toHaveCount(1);
  await expect(activity.getByTestId("panel-scope").filter({ hasText: "Whole chain" })).toHaveCount(5);

  // The timeline keeps only events tagged with a selected project.
  await expect(timeline.locator("[data-scope]")).toHaveText("1 filter active");
  const rows = await timeline.locator("tbody tr").count();
  expect(rows).toBeGreaterThan(0);
  expect(rows).toBeLessThan(allRows);
  await page.screenshot({ path: path.join(SHOTS, `overview-filtered-${info.project.name}.png`), fullPage: true });

  // Clearing the filter brings the chain totals back.
  await page.goto("/");
  await expect(page.locator('[data-chart-card="Chain over time"]')).toBeVisible({ timeout: 15_000 });
  expect(errors, errors.join("\n")).toEqual([]);
});

test("KPI tiles count coverage where the metric applies, show total borrowed and DEX volume without NEAR Intents", async ({ page }) => {
  await page.goto("/");
  const tile = (label: string) => page.locator(`[data-kpi="${label}"]`);
  await expect(tile("30d fees").getByTestId("kpi-sub")).toHaveText(/^Tracked for \d+ of \d+ where it applies$/, { timeout: 15_000 });
  const [x, y] = ((await tile("30d fees").getByTestId("kpi-sub").textContent())?.match(/(\d+) of (\d+)/) ?? []).slice(1).map(Number);
  expect(x).toBeLessThanOrEqual(y);
  // Unmeasured sectors are left out of Y, so it is well below the 468 projects shown.
  expect(y).toBeLessThan(300);
  await expect(tile("Total borrowed")).toContainText(/\$[\d.]+[KMB]/);
  await expect(tile("30d DEX volume")).toContainText("Including NEAR Intents");
  await expect(tile("30d DEX volume without NEAR Intents")).toContainText(/NEAR Intents \$[\d.]+[KMB] left out/);
});

test("KPI tiles use the short coverage text and the range line sits under its chart", async ({ page }, info) => {
  await page.goto("/");
  const subs = page.getByTestId("kpi-sub");
  await expect(subs.nth(1)).toHaveText(/^Tracked for [\d,]+ of [\d,]+ where it applies$/, { timeout: 15_000 });
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

  await page.getByRole("button", { name: "Expand Concentration curve" }).click();
  await expect.poll(async () => (await queued(page)).find((e) => e.name === "chart_expand")?.data).toEqual({ chart: "concentration", auth: "off" });
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
