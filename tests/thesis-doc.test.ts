import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const headings = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8").split("\n").filter((l) => /^## /.test(l)).map((l) => l.slice(3).trim());
const ORDER = ["Claim", "Tables used", "Data and method", "Evidence for", "Evidence against", "What would change my mind", "Metrics that could not be computed", "How to reproduce"];

describe("THESIS.md", () => {
  it("the template has the track's sections in order", () => {
    expect(headings("docs/templates/THESIS.template.md")).toEqual(ORDER);
  });
  it("the committed THESIS.md has the same sections in the same order", () => {
    expect(headings("THESIS.md")).toEqual(ORDER);
  });
  it("README.md carries the same generated Tables used block as THESIS.md", () => {
    const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
    const thesis = fs.readFileSync(path.join(ROOT, "THESIS.md"), "utf8");
    const block = readme.match(/<!-- tables-used -->\n([\s\S]*?)\n<!-- \/tables-used -->/)?.[1];
    expect(block, "README has the tables-used markers").toBeTruthy();
    expect(thesis).toContain(block as string);
    for (const needle of ["`transactions`", "`receipt_actions`", "`block_date` DATE", "WHERE block_date BETWEEN @start AND @end", "### Sample query", "FROM `bigquery-public-data.crypto_near_mainnet_us.transactions`", "amountInUsd", "appFees", "referral", "createdAt", "status"]) expect(block, needle).toContain(needle);
    // No token-shaped string anywhere in the block.
    expect(block).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
  });
  it("README.md carries the thesis, the cost note and the data-as-of marker", () => {
    const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
    expect(readme).toMatch(/\*\*Thesis\.\*\*/);
    expect(readme).toMatch(/NEAR pays to store the BigQuery public dataset/);
    expect(readme).toMatch(/<!-- data-as-of -->Data as of \d{4}-\d{2}-\d{2}/);
  });
});
