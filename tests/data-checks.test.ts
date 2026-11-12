import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv } from "../scripts/lib/csv";
import { crossCheck, gasFeeOutage } from "../src/lib/data-checks";
import type { Series } from "../src/lib/history-types";

const rows = parseCsv(fs.readFileSync(path.join(__dirname, "fixtures", "chain-daily-2026-11-12.csv"), "utf8"));
const series = (col: string): Series => rows.filter((r) => r[col] !== "").map((r) => [r.Date as string, Number(r[col])]);

describe("two-source check", () => {
  const a: Series = [["2026-11-01", 100], ["2026-11-02", 100]];
  it("passes within 10% and fails beyond it", () => {
    expect(crossCheck("x", { label: "A", series: a }, { label: "B", series: [["2026-11-01", 95], ["2026-11-02", 100]] })).toBeNull();
    const f = crossCheck("x", { label: "A", series: a }, { label: "B", series: [["2026-11-01", 50], ["2026-11-02", 100]] });
    expect(f?.severity).toBe("fail");
    expect(f?.message).toContain("25.0% apart");
    expect(f?.message).toMatch(/^x, A 200 vs B 150/);
  });
  it("asks for review, not a failure, when the sources share no day", () => {
    expect(crossCheck("x", { label: "A", series: a }, { label: "B", series: [["2026-10-01", 1]] })?.severity).toBe("review");
  });
});

describe("gas-fee outage", () => {
  it("passes on the Nov 12 fixture, whose Aurora zero days are single days or days with no transactions", () => {
    expect(gasFeeOutage("Aurora", series("Aurora Gas Fees (USD)"), series("Aurora Transactions"))).toBeNull();
  });
  it("fails after more than three straight days of missing fees while the chain has transactions", () => {
    const txns: Series = ["01", "02", "03", "04", "05"].map((d) => [`2026-11-${d}`, 5000]);
    const fees: Series = [["2026-11-01", 60]];
    expect(gasFeeOutage("Aurora", fees, txns)?.message).toContain("4 days in a row");
    expect(gasFeeOutage("Aurora", [["2026-11-01", 60], ["2026-11-04", 70]], txns)).toBeNull();
    // Before the first refresh has fetched the series at all, it is a note for review.
    expect(gasFeeOutage("Aurora", [], txns)?.severity).toBe("review");
  });
});
