/**
 * NEAR BigQuery public dataset (bigquery-public-data.crypto_near_mainnet_us).
 *
 * Cost guard: every query in queries/*.sql filters on block_date; each job is dry-run first and the
 * bytes are logged; maximumBytesBilled caps every job (BQ_MAX_BYTES, default 20 GB) and the run
 * stops when the cumulative backfill estimate exceeds BQ_BACKFILL_MAX_BYTES (default 300 GB).
 * A backfill of one older window sets BQ_START and BQ_END, and BQ_QUERIES names the queries to run
 * (comma separated, default all three); a cursor never moves backwards, so the next daily run stays small.
 * Bytes per query are kept in data/history/bq-usage.json (last daily run and every backfill window).
 * Results are cached as CSV under data/raw/bigquery/ and merged into data/history, so the site
 * never needs BigQuery to rebuild.
 *
 * Auth: Application Default Credentials locally, Workload Identity Federation in CI. No key files.
 */
import fs from "node:fs";
import path from "node:path";
import { addDays, type DateStr } from "../../src/lib/dates";
import type { Series } from "../../src/lib/history-types";
import { readCsvOrEmpty, toCsv } from "../lib/csv";
import { debug, log } from "../lib/log";
import { DATA, HISTORY, QUERIES, RAW } from "../lib/paths";
import { readJson, upsertSeries, writeJsonStable } from "../lib/store";
import { skipped, type Ctx, type RunResult } from "./context";
import { readChain, writeChain } from "./defillama";

export const BQ_START_DEFAULT: DateStr = "2024-01-01";
/** Bytes one run may scan in total before it stops (BQ_BACKFILL_MAX_BYTES overrides it). */
export const BQ_BACKFILL_MAX_DEFAULT = 300e9;
export const WELL_KNOWN_RECEIVERS = ["aurora", "intents.near"];
const RAW_DIR = path.join(RAW, "bigquery");

export interface QueryJob {
  id: "daily_chain" | "daily_receipts" | "daily_gas";
  sql: string;
  params: Record<string, unknown>;
  start: DateStr;
  end: DateStr;
}

export function loadSql(id: QueryJob["id"]): string {
  return fs.readFileSync(path.join(QUERIES, `${id}.sql`), "utf8");
}

/** Column names in a result row -> series per metric. */
export function rowsToSeries(rows: Array<Record<string, unknown>>, columns: string[]): Record<string, Series> {
  const out: Record<string, Series> = {};
  for (const c of columns) out[c] = [];
  for (const r of rows) {
    const d = String((r.block_date as { value?: string })?.value ?? r.block_date).slice(0, 10);
    for (const c of columns) {
      const v = Number(r[c]);
      if (Number.isFinite(v)) out[c].push([d, v]);
    }
  }
  for (const c of columns) out[c].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return out;
}

/** Receiver rows -> account -> [date, calls, signers]. */
export function receiverRows(rows: Array<Record<string, unknown>>): Record<string, Array<[DateStr, number, number]>> {
  const out: Record<string, Array<[DateStr, number, number]>> = {};
  for (const r of rows) {
    const d = String((r.block_date as { value?: string })?.value ?? r.block_date).slice(0, 10);
    const a = String(r.account_id);
    (out[a] ??= []).push([d, Number(r.function_calls) || 0, Number(r.distinct_signers) || 0]);
  }
  for (const a of Object.keys(out)) out[a].sort((x, y) => (x[0] < y[0] ? -1 : 1));
  return out;
}

/** Split [start, end] into chunks of at most `days` days. */
export function chunks(start: DateStr, end: DateStr, days: number): Array<[DateStr, DateStr]> {
  const out: Array<[DateStr, DateStr]> = [];
  for (let s = start; s <= end; s = addDays(s, days)) {
    const e = addDays(s, days - 1) < end ? addDays(s, days - 1) : end;
    out.push([s, e]);
  }
  return out;
}

export const QUERY_IDS = ["daily_chain", "daily_receipts", "daily_gas"] as const;

/** The queries a run executes: all of them, or the ones named in BQ_QUERIES (comma separated). Unknown names throw. */
export function selectedQueries(value: string | undefined): Set<QueryJob["id"]> {
  const names = (value ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  if (!names.length) return new Set(QUERY_IDS);
  for (const n of names) if (!(QUERY_IDS as readonly string[]).includes(n)) throw new Error(`Unknown query "${n}" in BQ_QUERIES. Known: ${QUERY_IDS.join(", ")}`);
  return new Set(names as Array<QueryJob["id"]>);
}

/** The later of a cursor and a finished window end, so an older backfill window never pulls a cursor back. */
export function laterDate(a: DateStr | undefined, b: DateStr): DateStr {
  return a && a > b ? a : b;
}

/** The last day a run may query: yesterday, or BQ_END when it is earlier. */
export function windowEnd(yesterday: DateStr, bqEnd: string | undefined): DateStr {
  return bqEnd && /^\d{4}-\d{2}-\d{2}$/.test(bqEnd) && bqEnd < yesterday ? (bqEnd as DateStr) : yesterday;
}

export interface BqUsageRun {
  /** UTC day the run happened. */
  date: DateStr;
  start: DateStr;
  end: DateStr;
  jobs: number;
  bytes: number;
  perQuery: Record<string, number>;
  /** Where the figures come from when they were not written by the run itself. */
  source?: string;
}
export interface BqUsage {
  daily: BqUsageRun | null;
  backfills: BqUsageRun[];
}
export const BQ_USAGE_FILE = path.join(HISTORY, "bq-usage.json");

/** Records a finished run: a daily run replaces `daily`; a backfill replaces the entry with the same window and queries. */
export function recordUsage(usage: BqUsage, mode: "daily" | "backfill", run: BqUsageRun): BqUsage {
  if (mode === "daily") return { ...usage, daily: run };
  const key = (r: BqUsageRun) => `${r.start}|${r.end}|${Object.keys(r.perQuery).sort().join(",")}`;
  return { ...usage, backfills: [...usage.backfills.filter((r) => key(r) !== key(run)), run].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.start < b.start ? -1 : 1)) };
}

/** Launchpad factories (Role factory in data/contracts.csv): account → project. */
export function factoryAccounts(): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of readCsvOrEmpty(path.join(DATA, "contracts.csv"))) {
    if ((r["Role"] ?? "").trim() !== "factory") continue;
    const a = (r["Account ID"] ?? "").trim().toLowerCase();
    const p = (r["Project"] ?? "").trim();
    if (a && p) m.set(a, p);
  }
  return m;
}

/** Gas rows → account → [date, NEAR burnt, outcomes]. */
export function gasRows(rows: Array<Record<string, unknown>>): Record<string, Array<[DateStr, number, number]>> {
  const out: Record<string, Array<[DateStr, number, number]>> = {};
  for (const r of rows) {
    const d = String((r.block_date as { value?: string })?.value ?? r.block_date).slice(0, 10) as DateStr;
    const a = String(r.account_id ?? "");
    if (!a) continue;
    (out[a] ??= []).push([d, Math.round(Number(r.near_burnt) * 1e6) / 1e6 || 0, Number(r.outcomes) || 0]);
  }
  for (const k of Object.keys(out)) out[k].sort((x, y) => (x[0] < y[0] ? -1 : 1));
  return out;
}

/** Gas per project reaches back this many days at most, backfill included (about 0.2 GB a day of execution_outcomes). */
export const GAS_DAYS = 90;

/** A query parameter array cannot be empty (BigQuery cannot type it), so an unused placeholder stands in. */
export const NO_FACTORY = "~no-factory~";

/** Factory rows from the receipts query → factory account → [date, sub-accounts created]. */
export function factoryLaunches(rows: Array<Record<string, unknown>>): Record<string, Array<[DateStr, number]>> {
  const out: Record<string, Array<[DateStr, number]>> = {};
  for (const r of rows) {
    const a = String(r.account_id ?? "");
    if (!a.startsWith("factory:")) continue;
    const d = String((r.block_date as { value?: string })?.value ?? r.block_date).slice(0, 10) as DateStr;
    (out[a.slice(8)] ??= []).push([d, Number(r.new_accounts) || 0]);
  }
  for (const k of Object.keys(out)) out[k].sort((x, y) => (x[0] < y[0] ? -1 : 1));
  return out;
}

function trackedAccounts(): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const r of readCsvOrEmpty(path.join(DATA, "contracts.csv"))) {
    const a = (r["Account ID"] ?? "").trim().toLowerCase();
    const p = (r["Project"] ?? "").trim();
    if (a && p) m.set(p, [...(m.get(p) ?? []), a]);
  }
  return m;
}

function csvPath(id: string, start: DateStr, end: DateStr) {
  return path.join(RAW_DIR, `${id}_${start}_${end}.csv`);
}

export async function run(ctx: Ctx): Promise<RunResult> {
  const project = ctx.env.GCP_PROJECT_ID;
  if (!project) return skipped("GCP_PROJECT_ID not set");
  const maxBytes = Number(ctx.env.BQ_MAX_BYTES ?? 20e9) || 20e9;
  const backfillMax = Number(ctx.env.BQ_BACKFILL_MAX_BYTES ?? BQ_BACKFILL_MAX_DEFAULT) || BQ_BACKFILL_MAX_DEFAULT;
  const chunkDays = Math.max(1, Number(ctx.env.BQ_CHUNK_DAYS ?? 30) || 30);
  const perQuery: Record<string, number> = {};
  const wanted = selectedQueries(ctx.env.BQ_QUERIES);
  const { BigQuery } = await import("@google-cloud/bigquery");
  const bq = new BigQuery({ projectId: project });
  const notes: string[] = [];
  let bytes = 0;
  let calls = 0;
  let rows = 0;

  const chain = readChain();
  const cursors = ctx.meta.cursors.bigquery;
  const end = windowEnd(addDays(ctx.today, -1), ctx.env.BQ_END); // last complete UTC day, or BQ_END for an older window
  const start = (id: string) => (ctx.mode === "backfill" || !cursors[id] ? (ctx.env.BQ_START as DateStr | undefined) ?? BQ_START_DEFAULT : addDays(cursors[id], -2));
  const tracked = trackedAccounts();
  const accounts = Array.from(new Set([...WELL_KNOWN_RECEIVERS, ...Array.from(tracked.values()).flat()]));
  const factories = factoryAccounts();
  const factoryList = factories.size ? Array.from(factories.keys()) : [NO_FACTORY];

  async function runJob(job: QueryJob): Promise<Array<Record<string, unknown>>> {
    const base = { query: job.sql, params: { ...job.params, start: job.start, end: job.end }, useLegacySql: false };
    const [dry] = await bq.createQueryJob({ ...base, dryRun: true });
    const est = Number(dry.metadata?.statistics?.totalBytesProcessed ?? 0);
    perQuery[job.id] = (perQuery[job.id] ?? 0) + est;
    debug(`${job.id} ${job.start}..${job.end} dry run ${(est / 1e9).toFixed(2)} GB`);
    if (est > maxBytes) throw new Error(`${job.id} ${job.start}..${job.end} would scan ${(est / 1e9).toFixed(1)} GB > BQ_MAX_BYTES`);
    if (bytes + est > backfillMax) throw new Error(`backfill budget reached (${((bytes + est) / 1e9).toFixed(1)} GB > BQ_BACKFILL_MAX_BYTES)`);
    if (ctx.dryRun) {
      bytes += est;
      calls += 1;
      return [];
    }
    const [j] = await bq.createQueryJob({ ...base, maximumBytesBilled: String(Math.ceil(maxBytes)) });
    const [out] = await j.getQueryResults();
    const [meta] = await j.getMetadata();
    bytes += Number(meta?.statistics?.totalBytesProcessed ?? est);
    calls += 1;
    return out as Array<Record<string, unknown>>;
  }

  const persist = (id: string, s: DateStr, e: DateStr, out: Array<Record<string, unknown>>, columns: string[]) => {
    if (!out.length || ctx.dryRun) return;
    fs.mkdirSync(RAW_DIR, { recursive: true });
    const flat = out.map((r) => Object.fromEntries(columns.map((c) => [c, c === "block_date" ? String((r[c] as { value?: string })?.value ?? r[c]).slice(0, 10) : (r[c] as string | number)])));
    fs.writeFileSync(csvPath(id, s, e), toCsv(flat, columns));
  };

  try {
    // 1. Signed transactions: daily transactions, active accounts (distinct signers), distinct receivers.
    const chainCols = ["transactions", "active_accounts", "distinct_receivers"];
    for (const [s, e] of wanted.has("daily_chain") ? chunks(start("daily_chain"), end, chunkDays) : []) {
      const out = await runJob({ id: "daily_chain", sql: loadSql("daily_chain"), params: {}, start: s, end: e });
      rows += out.length;
      persist("daily_chain", s, e, out, ["block_date", ...chainCols]);
      const series = rowsToSeries(out, chainCols);
      for (const c of chainCols) chain.bigquery[c] = upsertSeries(chain.bigquery[c] ?? [], series[c], { today: ctx.today });
      if (!ctx.dryRun) cursors["daily_chain"] = laterDate(cursors["daily_chain"], e);
    }
    // 2. Receipt actions: chain-level rows (account_id null) and per-receiver rows in one scan.
    const activity = readJson<Record<string, Array<[DateStr, number, number]>>>(path.join(HISTORY, "bigquery", "receivers.json"), {});
    const launches = readJson<Record<string, Array<[DateStr, number]>>>(path.join(HISTORY, "bigquery", "factory-launches.json"), {});
    const receiptCols = ["function_calls", "distinct_signers", "contracts_called", "new_accounts", "contracts_deployed"];
    for (const [s, e] of wanted.has("daily_receipts") ? chunks(start("daily_receipts"), end, chunkDays) : []) {
      const out = await runJob({ id: "daily_receipts", sql: loadSql("daily_receipts"), params: { accounts, factories: factoryList }, start: s, end: e });
      rows += out.length;
      persist("daily_receipts", s, e, out, ["block_date", "account_id", ...receiptCols]);
      const chainRows = out.filter((r) => r.account_id === null || r.account_id === undefined);
      const series = rowsToSeries(chainRows, receiptCols);
      for (const c of receiptCols) chain.bigquery[c] = upsertSeries(chain.bigquery[c] ?? [], series[c], { today: ctx.today });
      for (const [f, pts] of Object.entries(factoryLaunches(out))) {
        const m = new Map<string, number>((launches[f] ?? []).map(([d, n]) => [d, n]));
        for (const [d, n] of pts) if (d < ctx.today) m.set(d, n);
        launches[f] = Array.from(m.entries()).map(([d, n]) => [d, n] as [DateStr, number]).sort((x, y) => (x[0] < y[0] ? -1 : 1));
      }
      for (const [a, pts] of Object.entries(receiverRows(out.filter((r) => r.account_id && !String(r.account_id).startsWith("factory:"))))) {
        const m = new Map<string, [number, number]>((activity[a] ?? []).map(([d, c, g]) => [d, [c, g]]));
        for (const [d, c, g] of pts) if (d < ctx.today) m.set(d, [c, g]);
        activity[a] = Array.from(m.entries()).map(([d, [c, g]]) => [d, c, g] as [DateStr, number, number]).sort((x, y) => (x[0] < y[0] ? -1 : 1));
      }
      if (!ctx.dryRun) cursors["daily_receipts"] = laterDate(cursors["daily_receipts"], e);
    }
    // 3. Gas burnt per tracked account (execution_outcomes), for gas fees generated per project. Its own cursor,
    // and never more than GAS_DAYS back, even in a backfill, to stay inside the scan budget.
    const gas = readJson<Record<string, Array<[DateStr, number, number]>>>(path.join(HISTORY, "bigquery", "gas.json"), {});
    const gasFloor = addDays(end, -(GAS_DAYS - 1));
    const gasStart = cursors["daily_gas"] && cursors["daily_gas"] >= gasFloor ? addDays(cursors["daily_gas"], -2) : gasFloor;
    for (const [s, e] of wanted.has("daily_gas") && gasStart <= end ? chunks(gasStart, end, chunkDays) : []) {
      const out = await runJob({ id: "daily_gas", sql: loadSql("daily_gas"), params: { accounts }, start: s, end: e });
      rows += out.length;
      persist("daily_gas", s, e, out, ["block_date", "account_id", "outcomes", "gas_burnt", "near_burnt"]);
      for (const [a, pts] of Object.entries(gasRows(out))) {
        const m = new Map<string, [number, number]>((gas[a] ?? []).map(([d, n, o]) => [d, [n, o]]));
        for (const [d, n, o] of pts) if (d < ctx.today) m.set(d, [n, o]);
        gas[a] = Array.from(m.entries()).map(([d, [n, o]]) => [d, n, o] as [DateStr, number, number]).filter(([d]) => d >= gasFloor).sort((x, y) => (x[0] < y[0] ? -1 : 1));
      }
      if (!ctx.dryRun) cursors["daily_gas"] = laterDate(cursors["daily_gas"], e);
    }
    if (!ctx.dryRun && wanted.has("daily_gas")) writeJsonStable(path.join(HISTORY, "bigquery", "gas.json"), gas);
    if (!ctx.dryRun && !wanted.has("daily_receipts")) writeChain(chain);
    if (!ctx.dryRun && wanted.has("daily_receipts")) {
      writeJsonStable(path.join(HISTORY, "bigquery", "receivers.json"), activity);
      writeJsonStable(path.join(HISTORY, "bigquery", "factory-launches.json"), launches);
      // Per-project activity = sum of its tracked accounts per day.
      const perProject: Record<string, Array<[DateStr, number, number]>> = {};
      for (const [p, accts] of tracked) {
        const m = new Map<string, [number, number]>();
        for (const a of accts) for (const [d, c, g] of activity[a] ?? []) {
          const cur = m.get(d) ?? [0, 0];
          m.set(d, [cur[0] + c, cur[1] + g]);
        }
        if (m.size) perProject[p] = Array.from(m.entries()).map(([d, [c, g]]) => [d, c, g] as [DateStr, number, number]).sort((x, y) => (x[0] < y[0] ? -1 : 1));
      }
      writeJsonStable(path.join(HISTORY, "bigquery", "project-activity.json"), perProject);
      for (const a of WELL_KNOWN_RECEIVERS) {
        const key = a === "aurora" ? "auroraCalls" : "intentsCalls";
        const skey = a === "aurora" ? "auroraSigners" : "intentsSigners";
        chain.bigquery[key] = upsertSeries(chain.bigquery[key] ?? [], (activity[a] ?? []).map(([d, c]) => [d, c] as [DateStr, number]), { today: ctx.today });
        chain.bigquery[skey] = upsertSeries(chain.bigquery[skey] ?? [], (activity[a] ?? []).map(([d, , g]) => [d, g] as [DateStr, number]), { today: ctx.today });
      }
      writeChain(chain);
    }
  } catch (e) {
    notes.push(`stopped: ${(e as Error).message}`);
    if (!ctx.dryRun) writeChain(chain);
    if (calls === 0) throw e;
  }
  if (!ctx.dryRun && calls > 0) {
    const first = Array.from(wanted).map((id) => (id === "daily_gas" ? null : start(id))).filter((d): d is DateStr => Boolean(d)).sort()[0] ?? end;
    const usage = readJson<BqUsage>(BQ_USAGE_FILE, { daily: null, backfills: [] });
    writeJsonStable(BQ_USAGE_FILE, recordUsage(usage, ctx.mode, { date: ctx.today, start: first, end, jobs: calls, bytes, perQuery: { ...perQuery } }));
  }
  notes.push(`${calls} jobs, ${(bytes / 1e9).toFixed(2)} GB processed, ${accounts.length} tracked accounts`);
  notes.push(`per query: ${Object.entries(perQuery).map(([k, v]) => `${k} ${(v / 1e9).toFixed(1)} GB`).join(", ")}`);
  log("");
  return { rows, calls, bytes, notes };
}
