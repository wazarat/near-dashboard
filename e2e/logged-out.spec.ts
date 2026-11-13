import { expect, test, type Locator } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * What a judge sees without an account: every evidence route in a brand-new browser context with no cookies and
 * no stored state. Each chart has to render, each chart's query has to open and show SQL or an API call, and no
 * sign-in prompt, pop-up, wall or blur may appear. Runs against the logged-out build (`npm run e2e:wall`) and,
 * with E2E_BASE_URL set, against a deployed site.
 */
const ROUTES = [
  { path: "/", name: "overview" },
  { path: "/thesis/", name: "thesis" },
  { path: "/intents/", name: "intents" },
  { path: "/explorer/", name: "explorer" },
  { path: "/sectors/", name: "sectors" },
  { path: "/traction/", name: "traction" },
  { path: "/about/", name: "methodology" },
];
const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

/** SQL against the BigQuery public dataset, or an HTTP call to a named endpoint. */
const SQL_OR_API = /\bSELECT\b[\s\S]*\bFROM\b|\bGET https:\/\//;

/**
 * The one exception: the events timeline is a hand-researched file with a source link on every row, not the result
 * of a query, so its evidence is the committed CSV it is read from.
 */
const RESEARCH_EVENTS_FILE = /data\/near-events-[\d-]+\.csv/;

async function expectEvidence(scope: Locator, label: string) {
  const blocks = scope.locator("pre code");
  await expect(blocks.first(), `${label} shows a query`).toBeVisible();
  const texts = await blocks.allTextContents();
  const queried = texts.some((t) => SQL_OR_API.test(t));
  const researchFile = !queried && RESEARCH_EVENTS_FILE.test((await scope.textContent()) ?? "");
  expect(queried || researchFile, `${label} shows SQL or an API call, got ${texts.map((t) => t.slice(0, 40)).join(" | ")}`).toBe(true);
}

for (const route of ROUTES) {
  test(`${route.path} is fully readable with no cookies and no sign-in`, async ({ browser, baseURL }, info) => {
    test.setTimeout(120_000);
    const use = info.project.use;
    const context = await browser.newContext({ baseURL, viewport: use.viewport, isMobile: use.isMobile, hasTouch: use.hasTouch, colorScheme: "dark", storageState: { cookies: [], origins: [] } });
    expect(await context.cookies(), "a fresh context has no cookies").toEqual([]);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));

    const response = await page.goto(route.path);
    expect(response?.status(), "the route answers 200").toBe(200);
    expect(new URL(page.url()).pathname, "no redirect to a sign-in page").toBe(route.path);
    await expect(page.locator("main")).toBeVisible();
    expect((await context.cookies()).filter((c) => /session|clerk|__client/i.test(c.name)), "no session cookie is set").toEqual([]);

    const cards = page.locator("[data-chart-card]");
    if (route.path === "/about/") {
      await expect(page.getByRole("heading", { level: 1, name: "About and methodology" })).toBeVisible();
      await expect(page.getByTestId("about-sources")).toBeVisible();
    } else {
      await expect(cards.first()).toBeVisible({ timeout: 20_000 });
    }

    // No sign-in prompt, pop-up, wall or blur anywhere on the page, before or after the charts load.
    const noSignIn = async () => {
      await expect(page.getByTestId("login-dialog")).toHaveCount(0);
      await expect(page.getByTestId("login-wall")).toHaveCount(0);
      await expect(page.getByTestId("login-panel")).toHaveCount(0);
      await expect(page.getByText("Log in for free access")).toHaveCount(0);
      await expect(page.locator("main [inert], main [aria-hidden='true'].blur-sm, main .blur-sm")).toHaveCount(0);
      await expect(page.locator("[class*='cl-rootBox'], [class*='cl-modal'], iframe[src*='clerk']")).toHaveCount(0);
    };
    await noSignIn();

    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const title = (await card.getAttribute("data-chart-card")) ?? `card ${i}`;
      await card.scrollIntoViewIfNeeded();
      // The chart itself: a drawn body, not the empty state.
      const body = card.locator("[data-chart-body]");
      await expect(body, `${title} has a body`).toBeVisible();
      await expect(body.locator("[data-empty-state]"), `${title} is not empty`).toHaveCount(0);
      // A drawing of real size (icons do not count): an SVG or canvas chart, a table, or a marked chart element.
      await expect
        .poll(() => body.evaluate((el) => Array.from(el.querySelectorAll("svg, canvas, table, [data-chart-mark]")).some((n) => n.getBoundingClientRect().width >= 120 && n.getBoundingClientRect().height >= 40)), { message: `${title} draws a chart or a table`, timeout: 20_000 })
        .toBe(true);

      // The query behind it: the Query tab, or for a card without tabs its "How this is calculated" block.
      const tabs = card.getByRole("tablist", { name: "View as" });
      if (await tabs.count()) {
        const queryTab = tabs.getByRole("tab", { name: "Query" });
        await expect(queryTab, `${title} has a Query tab`).toBeVisible();
        await queryTab.click();
        await expect(queryTab).toHaveAttribute("aria-selected", "true");
        await expectEvidence(body, `${title}, Query tab`);
        await tabs.getByRole("tab", { name: "Chart" }).click();
      } else {
        const how = card.locator("[data-how-calculated]");
        await expect(how, `${title} has a How this is calculated block`).toHaveCount(1);
        await how.locator("summary").click();
        await expectEvidence(how, `${title}, How this is calculated`);
        await how.locator("summary").click();
      }
    }
    if (route.path !== "/about/") expect(count, "the route has charts").toBeGreaterThan(0);

    // The footer methodology is part of every page.
    await expect(page.locator("#methodology-title")).toBeVisible();
    await noSignIn();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(SHOTS, `logged-out-${route.name}-${info.project.name}.png`), fullPage: true });
    expect(errors, errors.join("\n")).toEqual([]);
    await context.close();
  });
}
