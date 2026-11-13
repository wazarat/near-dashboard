import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { chunks, loadSql, receiverRows, rowsToSeries, exactAccounts, projectActivity } from "../scripts/fetch/bigquery";

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

describe("launchpad factories in the receipts scan", () => {
  it("attributes a factory's sub-account creations to it and keeps them apart from receiver rows", async () => {
    const { factoryLaunches, receiverRows, loadSql, NO_FACTORY } = await import("../scripts/fetch/bigquery");
    const rows = [
      { block_date: { value: "2026-11-10" }, account_id: "factory:meme-cooking.near", new_accounts: 4, function_calls: 0, distinct_signers: 0 },
      { block_date: { value: "2026-11-09" }, account_id: "factory:meme-cooking.near", new_accounts: 2, function_calls: 0, distinct_signers: 0 },
      { block_date: { value: "2026-11-10" }, account_id: "meme-cooking.near", new_accounts: 0, function_calls: 120, distinct_signers: 30 },
    ];
    expect(factoryLaunches(rows)).toEqual({ "meme-cooking.near": [["2026-11-09", 2], ["2026-11-10", 4]] });
    expect(Object.keys(receiverRows(rows.filter((r) => !String(r.account_id).startsWith("factory:"))))).toEqual(["meme-cooking.near"]);
    // The query reads the factories parameter in the same scan, and an empty list has a placeholder.
    expect(loadSql("daily_receipts")).toContain("UNNEST(@factories)");
    expect(NO_FACTORY).not.toMatch(/\./);
  });
});

describe("older backfill windows", () => {
  it("BQ_QUERIES picks the queries to run and rejects unknown names", async () => {
    const { selectedQueries } = await import("../scripts/fetch/bigquery");
    expect(Array.from(selectedQueries(undefined))).toEqual(["daily_chain", "daily_receipts", "daily_gas"]);
    expect(Array.from(selectedQueries("daily_chain"))).toEqual(["daily_chain"]);
    expect(Array.from(selectedQueries(" daily_chain , daily_gas "))).toEqual(["daily_chain", "daily_gas"]);
    expect(() => selectedQueries("daily_chian")).toThrow(/Unknown query/);
  });
  it("BQ_END can only bring the window end earlier than yesterday", async () => {
    const { windowEnd } = await import("../scripts/fetch/bigquery");
    expect(windowEnd("2026-11-12", undefined)).toBe("2026-11-12");
    expect(windowEnd("2026-11-12", "2025-11-07")).toBe("2025-11-07");
    expect(windowEnd("2026-11-12", "2027-01-01")).toBe("2026-11-12");
    expect(windowEnd("2026-11-12", "not a date")).toBe("2026-11-12");
  });
  it("a cursor never moves backwards, so the next daily run does not rescan the gap", async () => {
    const { laterDate } = await import("../scripts/fetch/bigquery");
    expect(laterDate("2026-11-12", "2025-11-07")).toBe("2026-11-12");
    expect(laterDate("2026-11-10", "2026-11-12")).toBe("2026-11-12");
    expect(laterDate(undefined, "2025-11-07")).toBe("2025-11-07");
  });
  it("the usage ledger keeps the last daily run and one entry per backfill window", async () => {
    const { recordUsage } = await import("../scripts/fetch/bigquery");
    const run = (date: string, start: string, end: string, bytes: number) => ({ date, start, end, jobs: 1, bytes, perQuery: { daily_chain: bytes } });
    let u = recordUsage({ daily: null, backfills: [] }, "daily", run("2026-11-13", "2026-11-10", "2026-11-12", 5));
    u = recordUsage(u, "daily", run("2026-11-14", "2026-11-11", "2026-11-13", 6));
    expect(u.daily?.bytes).toBe(6);
    u = recordUsage(u, "backfill", run("2026-11-13", "2024-12-10", "2025-11-07", 90));
    u = recordUsage(u, "backfill", run("2026-11-13", "2024-12-10", "2025-11-07", 97));
    expect(u.backfills).toHaveLength(1);
    expect(u.backfills[0].bytes).toBe(97);
    expect(u.daily?.bytes).toBe(6);
  });
});

describe("suffix accounts and per-project activity", () => {
  it("leaves suffix rows out of the exact receiver list", () => {
    const rows = [
      { Project: "AstroDAO", "Account ID": "sputnik-dao.near", Role: "core" },
      { Project: "AstroDAO", "Account ID": "sputnik-dao.near", Role: "suffix" },
      { Project: "POTLOCK", "Account ID": "v1.potfactory.potlock.near", Role: "suffix" },
    ];
    expect(exactAccounts(rows)).toEqual(["sputnik-dao.near"]);
  });
  it("counts an account listed under two roles once, and sums suffix rows with exact ones", () => {
    const tracked = new Map([
      ["HOT", ["game.hot.tg", "game.hot.tg"]],
      ["AstroDAO", ["sputnik-dao.near", "suffix:sputnik-dao.near"]],
    ]);
    const activity = {
      "game.hot.tg": [["2026-11-12", 10, 4]],
      "sputnik-dao.near": [["2026-11-12", 2, 1]],
      "suffix:sputnik-dao.near": [["2026-11-12", 30, 9]],
    } as unknown as Parameters<typeof projectActivity>[1];
    const out = projectActivity(tracked, activity);
    expect(out.HOT).toEqual([["2026-11-12", 10, 4]]);
    expect(out.AstroDAO).toEqual([["2026-11-12", 32, 10]]);
  });
});
