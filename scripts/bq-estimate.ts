/**
 * BigQuery cost estimates, with no data read: dry runs every query in queries/*.sql over a 1-day, a 3-day and
 * a 90-day window ending yesterday, and reads the column list of the tables they use from INFORMATION_SCHEMA
 * (a metadata query, capped by maximumBytesBilled). Writes data/history/bq-estimate.json, which the daily
 * refresh commits, so the numbers can be read without a local Google login.
 *
 *   npm run bq:estimate        # needs GCP_PROJECT_ID and Application Default Credentials (WIF in CI)
 */
import fs from "node:fs";
import path from "node:path";
import { addDays, type DateStr } from "../src/lib/dates";
import { readCsvOrEmpty } from "./lib/csv";
import { DATA, HISTORY, QUERIES } from "./lib/paths";
import { writeJsonStable } from "./lib/store";
import { NO_FACTORY, WELL_KNOWN_RECEIVERS, factoryAccounts } from "./fetch/bigquery";

const DATASET = "bigquery-public-data.crypto_near_mainnet_us";
const TABLES = ["transactions", "receipt_actions", "execution_outcomes"];

async function main() {
  const project = process.env.GCP_PROJECT_ID;
  if (!project) {
    console.log("bq:estimate skipped, GCP_PROJECT_ID not set");
    return;
  }
  const { BigQuery } = await import("@google-cloud/bigquery");
  const bq = new BigQuery({ projectId: project });
  const end = addDays(new Date().toISOString().slice(0, 10) as DateStr, -1);
  const accounts = Array.from(new Set([...WELL_KNOWN_RECEIVERS, ...readCsvOrEmpty(path.join(DATA, "contracts.csv")).map((r) => (r["Account ID"] ?? "").trim().toLowerCase()).filter(Boolean)]));
  const factories = factoryAccounts();
  const params = { accounts, factories: factories.size ? Array.from(factories.keys()) : [NO_FACTORY] };

  const out: { asOf: string; end: string; accounts: number; queries: Record<string, Record<string, number | string>>; columns: Record<string, Array<[string, string]> | string> } = { asOf: new Date().toISOString(), end, accounts: accounts.length, queries: {}, columns: {} };

  for (const file of fs.readdirSync(QUERIES).filter((f) => f.endsWith(".sql")).sort()) {
    const id = file.replace(/\.sql$/, "");
    const sql = fs.readFileSync(path.join(QUERIES, file), "utf8");
    out.queries[id] = {};
    for (const days of [1, 3, 90]) {
      const start = addDays(end, -(days - 1));
      try {
        const [job] = await bq.createQueryJob({ query: sql, params: { ...params, start, end }, useLegacySql: false, dryRun: true });
        out.queries[id][`${days}d_gb`] = Math.round((Number(job.metadata?.statistics?.totalBytesProcessed ?? 0) / 1e9) * 100) / 100;
      } catch (e) {
        out.queries[id][`${days}d_error`] = (e as Error).message.slice(0, 300);
      }
    }
    console.log(id, JSON.stringify(out.queries[id]));
  }

  for (const t of TABLES) {
    try {
      const [job] = await bq.createQueryJob({
        query: `SELECT column_name, data_type FROM \`${DATASET}\`.INFORMATION_SCHEMA.COLUMNS WHERE table_name = @t ORDER BY ordinal_position`,
        params: { t },
        useLegacySql: false,
        maximumBytesBilled: String(200e6),
      });
      const [rows] = await job.getQueryResults();
      out.columns[t] = (rows as Array<{ column_name: string; data_type: string }>).map((r) => [r.column_name, r.data_type]);
    } catch (e) {
      out.columns[t] = `error: ${(e as Error).message.slice(0, 300)}`;
    }
  }
  writeJsonStable(path.join(HISTORY, "bq-estimate.json"), out);
  console.log(`wrote data/history/bq-estimate.json (${Object.keys(out.queries).length} queries, ${accounts.length} accounts)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
