import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseTransactionsChart } from "../scripts/fetch/blockscout";
import { parseFeeSummary } from "../scripts/fetch/defillama";
import { parseCsv } from "../scripts/lib/csv";
import { flowGaps, gasFeeGaps, txnGaps } from "../src/lib/chain-gaps";

const fixture = (...p: string[]) => path.join(__dirname, "fixtures", ...p);
const rows = parseCsv(fs.readFileSync(fixture("chain-daily-2026-11-12.csv"), "utf8"));
const col = (name: string) => rows.map((r) => (r[name] === "" || r[name] === undefined ? null : Number(r[name])));
const dates = rows.map((r) => r.Date);

describe("chain gas fees and the zero-gap rule (docs/LIVE-DATA.md, section 0)", () => {
  const auroraFees = col("Aurora Gas Fees (USD)");
  const auroraTxns = col("Aurora Transactions");

  it("sums Aurora's gas fees from Oct 13 to Nov 11 to $2,071", () => {
    const from = dates.indexOf("2026-10-13");
    const to = dates.indexOf("2026-11-11");
    const sum = gasFeeGaps(auroraFees).slice(from, to + 1).reduce((a: number, v) => a + (v ?? 0), 0);
    expect(sum).toBe(2071);
  });

  it("draws Nov 10 as a gap, for both fees and transactions", () => {
    const i = dates.indexOf("2026-11-10");
    expect(auroraFees[i]).toBe(0);
    expect(auroraTxns[i]).toBe(0);
    expect(gasFeeGaps(auroraFees)[i]).toBeNull();
    expect(txnGaps(auroraTxns)[i]).toBeNull();
  });

  it("draws every reported $0 gas day as a gap, as the fixture marks them", () => {
    const gaps = gasFeeGaps(auroraFees);
    const marked = rows.map((r, i) => ((r.Note ?? "").includes("Aurora fees 0 reported") ? i : -1)).filter((i) => i >= 0);
    expect(marked.map((i) => dates[i])).toEqual(["2026-10-11", "2026-11-01", "2026-11-05", "2026-11-09", "2026-11-10"]);
    for (const i of marked) expect(gaps[i]).toBeNull();
    // Real values are untouched.
    expect(gaps[dates.indexOf("2026-11-11")]).toBe(71);
  });

  it("for other flows, keeps a 0 when the chain had transactions and gaps it when it had none", () => {
    expect(flowGaps([0, 0, 0, 5], [100, 0, null, 0])).toEqual([0, null, null, 5]);
  });
});

describe("new chain parsers", () => {
  it("reads DefiLlama's chain fee summary as daily gas fees", () => {
    const s = parseFeeSummary(JSON.parse(fs.readFileSync(fixture("defillama", "fee-summary-aurora.json"), "utf8")));
    expect(s).toHaveLength(40);
    expect(s.at(-1)).toEqual(["2026-11-11", 71]);
    expect(s.find(([d]) => d === "2026-11-10")).toEqual(["2026-11-10", 0]);
    expect(parseFeeSummary({})).toEqual([]);
  });

  it("reads Aurora Blockscout's transactions chart, oldest first", () => {
    const s = parseTransactionsChart(JSON.parse(fs.readFileSync(fixture("blockscout", "transactions.json"), "utf8")));
    expect(s.length).toBe(31);
    expect(s.at(-1)).toEqual(["2026-11-11", 6876]);
    expect(s.find(([d]) => d === "2026-11-10")).toEqual(["2026-11-10", 0]);
    expect(s.map(([d]) => d)).toEqual([...s.map(([d]) => d)].sort());
    expect(parseTransactionsChart({ chart_data: [{ date: "bad", transactions_count: 1 }, { date: "2026-11-01", transactions_count: null }] })).toEqual([]);
  });
});
