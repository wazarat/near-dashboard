import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const headings = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8").split("\n").filter((l) => /^## /.test(l)).map((l) => l.slice(3).trim());
const ORDER = ["Claim", "Data and method", "Evidence for", "Evidence against", "What would change my mind", "Metrics that could not be computed", "How to reproduce"];

describe("THESIS.md", () => {
  it("the template has the track's sections in order", () => {
    expect(headings("docs/templates/THESIS.template.md")).toEqual(ORDER);
  });
  it("the committed THESIS.md has the same sections in the same order", () => {
    expect(headings("THESIS.md")).toEqual(ORDER);
  });
  it("README.md carries the thesis, the cost note and the data-as-of marker", () => {
    const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
    expect(readme).toMatch(/\*\*Thesis\.\*\*/);
    expect(readme).toMatch(/NEAR pays to store the BigQuery public dataset/);
    expect(readme).toMatch(/<!-- data-as-of -->Data as of \d{4}-\d{2}-\d{2}/);
  });
});
