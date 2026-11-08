/**
 * Renders public/og.png (1200×630) from scripts/og-template.html with the
 * Playwright Chromium already used by the e2e suite. Run after the data
 * build so the counts on the card match the site:
 *
 *   npx tsx scripts/og-image.ts
 *
 * The output is committed; nothing at build time needs a browser or a network.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const metaPath = path.join(root, "src/data/generated/meta.json");
const templatePath = path.join(root, "scripts/og-template.html");
const outPath = path.join(root, "public/og.png");

async function main() {
  if (!fs.existsSync(metaPath)) throw new Error("src/data/generated/meta.json is missing; run npm run rebuild first");
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as { counts: { projects: number; sectors: number }; asOfLabel: string };
  const fontDir = path.join(root, "src/app/fonts");
  const font = (file: string) => `data:font/woff2;base64,${fs.readFileSync(path.join(fontDir, file)).toString("base64")}`;
  const html = fs
    .readFileSync(templatePath, "utf8")
    .replaceAll("{{projects}}", meta.counts.projects.toLocaleString("en-US"))
    .replaceAll("{{sectors}}", String(meta.counts.sectors))
    .replaceAll("{{asOf}}", meta.asOfLabel)
    .replaceAll("{{fontDisplay}}", font("space-grotesk-latin-wght-normal.woff2"))
    .replaceAll("{{fontSans}}", font("inter-latin-wght-normal.woff2"));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: outPath, type: "png" });
  } finally {
    await browser.close();
  }
  console.log(`wrote ${path.relative(root, outPath)} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
