import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { chunks, loadSql, receiverRows, rowsToSeries } from "../scripts/fetch/bigquery";

describe("bigquery helpers", () => {
  it("every saved query filters on block_date with the start/end parameters", () => {
    for (const f of fs.readdirSync(path.join(__dirname, "..", "queries"))) {
      const sql = fs.readFileSync(path.join(__dirname, "..", "queries", f), "utf8");
      expect(sql, f).toMatch(/block_date BETWEEN @start AND @end/);
    }
    expect(loadSql("daily_chain")).toContain("crypto_near_mainnet_us.transactions");
  });
  it("rowsToSeries accepts BigQuery DATE objects and plain strings", () => {
    const rows = [
      { block_date: { value: "2026-11-02" }, transactions: "100", active_accounts: 7 },
      { block_date: "2026-11-01", transactions: 50, active_accounts: "3" },
    ];
    const s = rowsToSeries(rows, ["transactions", "active_accounts"]);
    expect(s.transactions).toEqual([["2026-11-01", 50], ["2026-11-02", 100]]);
    expect(s.active_accounts).toEqual([["2026-11-01", 3], ["2026-11-02", 7]]);
  });
  it("receiverRows groups by account", () => {
    const out = receiverRows([
      { block_date: { value: "2026-11-02" }, account_id: "aurora", function_calls: "9", distinct_signers: "4" },
      { block_date: { value: "2026-11-01" }, account_id: "aurora", function_calls: "5", distinct_signers: "2" },
      { block_date: { value: "2026-11-01" }, account_id: "intents.near", function_calls: "1", distinct_signers: "1" },
    ]);
    expect(out.aurora).toEqual([["2026-11-01", 5, 2], ["2026-11-02", 9, 4]]);
    expect(out["intents.near"]).toHaveLength(1);
  });
  it("chunks cover the range without gaps or overlap", () => {
    const c = chunks("2026-01-01", "2026-04-15", 90);
    expect(c).toEqual([["2026-01-01", "2026-03-31"], ["2026-04-01", "2026-04-15"]]);
    expect(chunks("2026-11-07", "2026-11-07", 90)).toEqual([["2026-11-07", "2026-11-07"]]);
  });
});
