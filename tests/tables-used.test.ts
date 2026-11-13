import { describe, expect, it } from "vitest";
import { cachedRange, chunkDryRun, columnsRead, tableOf, tablesUsedMarkdown, type TablesUsedInput } from "../scripts/lib/tables-used";

const SQL = "-- reads block_height in a comment only\nSELECT block_date, COUNT(*) AS transactions, COUNT(DISTINCT signer_account_id) AS active_accounts\nFROM `bigquery-public-data.crypto_near_mainnet_us.transactions`\nWHERE block_date BETWEEN @start AND @end\nGROUP BY block_date";
const COLUMNS: Array<[string, string]> = [["block_date", "DATE"], ["block_height", "INT64"], ["signer_account_id", "STRING"], ["receiver_account_id", "STRING"]];

describe("Tables used block", () => {
  it("finds the table and only the columns the SQL names outside comments", () => {
    expect(tableOf(SQL)).toBe("transactions");
    expect(columnsRead(SQL, COLUMNS).map(([n]) => n)).toEqual(["block_date", "signer_account_id"]);
  });
  it("reads the cached date range from the file names of one query", () => {
    const files = ["daily_chain_2024-12-10_2024-12-23.csv", "daily_chain_2026-11-09_2026-11-12.csv", "daily_receipts_2025-11-08_2025-11-21.csv"];
    expect(cachedRange("daily_chain", files)).toEqual({ start: "2024-12-10", end: "2026-11-12", files: 2 });
    expect(cachedRange("daily_gas", files)).toBeNull();
  });
  it("takes a chunk's dry-run size from the backfill log that ran it", () => {
    const logs = { "bigquery-backfill.log": "  · daily_chain 2025-11-08..2025-11-21 dry run 3.12 GB\n", "bigquery-backfill-2024-12-10_2025-11-07.log": "  bigquery       · daily_chain 2024-12-10..2024-12-23 dry run 5.97 GB\n" };
    expect(chunkDryRun("daily_chain", "2024-12-10", "2024-12-23", logs)).toEqual({ gb: "5.97", log: "bigquery-backfill-2024-12-10_2025-11-07.log" });
    expect(chunkDryRun("daily_chain", "2023-01-01", "2023-01-14", logs)).toBeNull();
  });
  it("renders the table row, the sample query with real dates and its first three cached rows", () => {
    const input: TablesUsedInput = {
      queries: { daily_chain: SQL },
      columns: { transactions: COLUMNS },
      cached: ["daily_chain_2024-12-10_2024-12-23.csv"],
      usage: { daily: { date: "2026-11-13", start: "2026-11-10", end: "2026-11-12", jobs: 1, bytes: 140_000_000, perQuery: { daily_chain: 140_000_000 } }, backfills: [{ date: "2026-11-13", start: "2024-12-10", end: "2025-11-07", jobs: 24, bytes: 97_201_122_351, perQuery: { daily_chain: 97_201_122_351 } }] },
      logs: { "bigquery-backfill-2024-12-10_2025-11-07.log": "· daily_chain 2024-12-10..2024-12-23 dry run 5.97 GB" },
      readCsv: () => "block_date,transactions,active_accounts\n2024-12-10,8979346,949143\n2024-12-11,8399830,938360\n2024-12-12,9551708,968516\n2024-12-13,1,1\n",
    };
    const md = tablesUsedMarkdown(input);
    expect(md).toContain("| `transactions` | `queries/daily_chain.sql` | `block_date` DATE, `signer_account_id` STRING |");
    expect(md).toContain("0.14 GB");
    expect(md).toContain("97.20 GB for 2024-12-10 to 2025-11-07");
    expect(md).toContain("WHERE block_date BETWEEN DATE '2024-12-10' AND DATE '2024-12-23'");
    expect(md).toContain("Dry run: 5.97 GB");
    expect(md).toContain("| 2024-12-12 | 9551708 | 968516 |");
    expect(md).not.toContain("2024-12-13 | 1");
    expect(md).toContain("amountInUsd");
  });
});
