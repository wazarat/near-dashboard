/**
 * The "Tables used" block of THESIS.md and README.md (thesis track: list the tables used plus one sample query).
 * Everything in it is read from committed files, nothing is typed in:
 *
 *   queries/*.sql                    the table each query reads and the columns it names
 *   data/history/bq-estimate.json    the column types (INFORMATION_SCHEMA, written by `npm run bq:estimate`)
 *   data/raw/bigquery/*.csv          the dates the cached results cover, and the sample rows
 *   data/history/bq-usage.json       bytes scanned by the last daily refresh and by each backfill
 *   logs/bigquery-backfill*.log      the dry-run bytes of each backfill chunk (for the sample query)
 */
import fs from "node:fs";
import path from "node:path";
import { SPECS } from "../../src/lib/query-specs";

export const DATASET = "bigquery-public-data.crypto_near_mainnet_us";
export const PARTITION_FILTER = "WHERE block_date BETWEEN @start AND @end";

/** What each query's result is used for. Prose only; the numbers come from the files above. */
const USED_FOR: Record<string, string> = {
  daily_chain: "daily transactions, active accounts (distinct signers) and distinct receivers; the thesis uses the first two",
  daily_receipts: "daily function calls, contracts called, distinct signers, CREATE_ACCOUNT and DEPLOY_CONTRACT counts, and calls per tracked account; the thesis uses function calls and contracts called",
  daily_gas: "gas burnt per tracked account for the gas fee figures on the site; not used in the thesis",
  top_receivers: "the 10 receiver accounts with the most transactions over one complete month, saved to data/top-receivers.csv (thesis test B1)",
  daily_top_receivers: "daily transactions to those 10 accounts and to every other receiver (thesis test B1)",
  daily_supply: "NEAR total supply at the last block of each day (thesis test B2)",
};

/** The Explorer fields the fetcher reads and what each one is for (scripts/fetch/intents.ts). */
const EXPLORER_FIELDS: Array<[string, string]> = [
  ["createdAt", "UTC day of the swap"],
  ["status", "only `SUCCESS` rows count as volume; `REFUNDED`, `FAILED` and `INCOMPLETE_DEPOSIT` give the rates"],
  ["amountInUsd", "swap volume, summed per day"],
  ["amountOutUsd", "volume on the destination side"],
  ["originAsset, destinationAsset", "routes, chains and assets"],
  ["referral", "volume per referring app"],
  ["appFees[].recipient, appFees[].fee", "fee recipients and app fee rates"],
  ["recipient", "kept only as a 16-character SHA-256 prefix, to count distinct recipients"],
  ["depositAddress, depositMemo", "row identity and the paging cursor"],
];

export interface BqUsageRunLike {
  date: string;
  start: string;
  end: string;
  jobs: number;
  bytes: number;
  perQuery: Record<string, number>;
  /** Set when the figures were taken from another committed file and not written by the run itself. */
  source?: string;
}

export interface TablesUsedInput {
  /** Query id (file name without .sql) → SQL text. */
  queries: Record<string, string>;
  /** Table → [column, type] from INFORMATION_SCHEMA. */
  columns: Record<string, Array<[string, string]> | string>;
  /** File names in data/raw/bigquery. */
  cached: string[];
  usage: { daily: BqUsageRunLike | null; backfills: BqUsageRunLike[] };
  /** Text of every logs/bigquery-backfill*.log, by file name. */
  logs: Record<string, string>;
  /** Reads a cached CSV by file name. */
  readCsv: (file: string) => string;
}

const gb = (bytes: number | undefined) => (bytes === undefined ? "n/a" : `${(bytes / 1e9).toFixed(2)} GB`);

export function tableOf(sql: string): string | null {
  return sql.match(/crypto_near_mainnet_us\.(\w+)/)?.[1] ?? null;
}

/** Columns of `table` that the SQL names outside its comments. */
export function columnsRead(sql: string, tableColumns: Array<[string, string]>): Array<[string, string]> {
  const body = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  return tableColumns.filter(([name]) => new RegExp(`\\b${name}\\b`).test(body));
}

/** Cached result files of one query: first day, last day and file count. */
export function cachedRange(id: string, files: string[]): { start: string; end: string; files: number } | null {
  const spans = files.map((f) => f.match(new RegExp(`^${id}_(\\d{4}-\\d{2}-\\d{2})_(\\d{4}-\\d{2}-\\d{2})\\.csv$`))).filter((m): m is RegExpMatchArray => Boolean(m));
  if (!spans.length) return null;
  return { start: spans.map((m) => m[1]).sort()[0], end: spans.map((m) => m[2]).sort().at(-1) as string, files: spans.length };
}

/** Dry-run GB of one chunk as the backfill run logged it. */
export function chunkDryRun(id: string, start: string, end: string, logs: Record<string, string>): { gb: string; log: string } | null {
  for (const [name, text] of Object.entries(logs).sort()) {
    const m = text.match(new RegExp(`${id} ${start}\\.\\.${end} dry run ([\\d.]+) GB`));
    if (m) return { gb: m[1], log: name };
  }
  return null;
}

export function tablesUsedMarkdown(input: TablesUsedInput): string {
  const { queries, columns, cached, usage, logs } = input;
  const ids = Object.keys(queries).sort();
  const lines: string[] = [];
  const filtered = ids.filter((id) => /block_date BETWEEN @start AND @end/.test(queries[id]));
  lines.push(
    `Dataset \`${DATASET}\`. ${filtered.length === ids.length ? `All ${ids.length} queries` : `${filtered.length} of ${ids.length} queries`} filter on the \`block_date\` partition column with \`${PARTITION_FILTER}\`; each job is dry-run first and runs with \`maximumBytesBilled\` set (\`scripts/fetch/bigquery.ts\`).`,
  );
  lines.push("");
  const daily = usage.daily;
  lines.push(`| Table | Query | Columns read | Used for | Cached result dates | Last daily refresh${daily ? ` (${daily.date})` : ""} | Backfills |`);
  lines.push("|---|---|---|---|---|---|---|");
  for (const id of ids) {
    const table = tableOf(queries[id]);
    const cols = table && Array.isArray(columns[table]) ? columnsRead(queries[id], columns[table] as Array<[string, string]>) : [];
    const range = cachedRange(id, cached);
    const fills = usage.backfills.filter((b) => b.perQuery[id] !== undefined).map((b) => `${gb(b.perQuery[id])} for ${b.start} to ${b.end}`);
    lines.push(
      `| \`${table ?? "n/a"}\` | \`queries/${id}.sql\` | ${cols.length ? cols.map(([n, t]) => `\`${n}\` ${t}`).join(", ") : "n/a"} | ${USED_FOR[id] ?? "n/a"} | ${range ? `${range.start} to ${range.end} (${range.files} files in \`data/raw/bigquery/\`)` : "none"} | ${daily ? gb(daily.perQuery[id]) : "n/a"} | ${fills.length ? fills.join("; ") : "none"} |`,
    );
  }
  lines.push("");
  const from = (r: BqUsageRunLike) => (r.source ? `, figures from \`${r.source}\`` : "");
  if (daily) lines.push(`- The last daily refresh (${daily.date}, ${daily.jobs} jobs${from(daily)}) scanned ${gb(daily.bytes)} in total.`);
  for (const b of usage.backfills) lines.push(`- The backfill of ${b.start} to ${b.end} (run ${b.date}, ${b.jobs} jobs${from(b)}) scanned ${gb(b.bytes)} in total.`);
  lines.push("");
  lines.push("Bytes are the ones BigQuery reported for the jobs, kept in `data/history/bq-usage.json`; `npm run bq:estimate` dry-runs every query without reading data.");
  lines.push("");

  // Sample query: daily_chain.sql over its first cached chunk, with the real dates filled in.
  const sampleId = "daily_chain";
  const first = cached.map((f) => f.match(new RegExp(`^${sampleId}_(\\d{4}-\\d{2}-\\d{2})_(\\d{4}-\\d{2}-\\d{2})\\.csv$`))).filter((m): m is RegExpMatchArray => Boolean(m)).sort((a, b) => (a[1] < b[1] ? -1 : 1))[0];
  lines.push("### Sample query");
  lines.push("");
  if (first && queries[sampleId]) {
    const [file, start, end] = first;
    const dry = chunkDryRun(sampleId, start, end, logs);
    const sql = queries[sampleId].trim().replace("@start", `DATE '${start}'`).replace("@end", `DATE '${end}'`);
    lines.push(`\`queries/${sampleId}.sql\` as it ran for the first cached chunk, with \`@start\` and \`@end\` filled in:`);
    lines.push("");
    lines.push("```sql");
    lines.push(sql);
    lines.push("```");
    lines.push("");
    lines.push(`Dry run: ${dry ? `${dry.gb} GB (\`logs/${dry.log}\`)` : "not logged"}. First three rows of its cached output, \`data/raw/bigquery/${file}\`:`);
    lines.push("");
    const rows = input.readCsv(file).trim().split(/\r?\n/).slice(0, 4).map((l) => l.split(","));
    if (rows.length) {
      lines.push(`| ${rows[0].join(" | ")} |`);
      lines.push(`|${rows[0].map(() => "---").join("|")}|`);
      for (const r of rows.slice(1)) lines.push(`| ${r.join(" | ")} |`);
    }
  } else {
    lines.push("No cached result of `queries/daily_chain.sql` yet. Run `npm run refresh -- --only bigquery`.");
  }
  lines.push("");

  lines.push("### NEAR Intents Explorer API");
  lines.push("");
  lines.push("One endpoint, read page by page. The JWT comes from the `NEAR_INTENTS_JWT` environment variable and is never written to a file or a log.");
  lines.push("");
  lines.push("```text");
  lines.push(SPECS.intentsExplorer.code);
  lines.push("```");
  lines.push("");
  lines.push("| Field | Used for |");
  lines.push("|---|---|");
  for (const [f, use] of EXPLORER_FIELDS) lines.push(`| ${f.split(", ").map((x) => `\`${x}\``).join(", ")} | ${use} |`);
  lines.push("");
  lines.push("Rows are aggregated per UTC day into `data/raw/intents/daily/YYYY-MM-DD.json` (`scripts/fetch/intents.ts`, `aggregateDay`). It covers 1Click swaps only.");
  return lines.join("\n");
}

/** Reads the inputs from the repository at `root`. */
export function readTablesUsedInput(root: string): TablesUsedInput {
  const qdir = path.join(root, "queries");
  const queries = Object.fromEntries(fs.readdirSync(qdir).filter((f) => f.endsWith(".sql")).sort().map((f) => [f.replace(/\.sql$/, ""), fs.readFileSync(path.join(qdir, f), "utf8")]));
  const readJson = <T,>(file: string, fallback: T): T => (fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : fallback);
  const estimate = readJson<{ columns?: TablesUsedInput["columns"] }>(path.join(root, "data", "history", "bq-estimate.json"), {});
  const usage = readJson<TablesUsedInput["usage"]>(path.join(root, "data", "history", "bq-usage.json"), { daily: null, backfills: [] });
  const rawDir = path.join(root, "data", "raw", "bigquery");
  const cached = fs.existsSync(rawDir) ? fs.readdirSync(rawDir).filter((f) => f.endsWith(".csv")).sort() : [];
  const logDir = path.join(root, "logs");
  const logs = Object.fromEntries((fs.existsSync(logDir) ? fs.readdirSync(logDir) : []).filter((f) => /^bigquery-backfill.*\.log$/.test(f)).sort().map((f) => [f, fs.readFileSync(path.join(logDir, f), "utf8")]));
  return { queries, columns: estimate.columns ?? {}, cached, usage, logs, readCsv: (file) => fs.readFileSync(path.join(rawDir, file), "utf8") };
}
