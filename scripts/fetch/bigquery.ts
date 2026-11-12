/**
 * NEAR BigQuery public dataset (bigquery-public-data.crypto_near_mainnet_us).
 *
 * Cost guard: every query in queries/*.sql filters on block_date; each job is dry-run first and the
 * bytes are logged; maximumBytesBilled caps every job (BQ_MAX_BYTES, default 20 GB) and the run
 * stops when the cumulative backfill estimate exceeds BQ_BACKFILL_MAX_BYTES (default 300 GB).
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
export const WELL_KNOWN_RECEIVERS = ["aurora", "intents.near"];
const RAW_DIR = path.join(RAW, "bigquery");

export interface QueryJob {
  id: "daily_chain" | "daily_receipts";
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
  const backfillMax = Number(ctx.env.BQ_BACKFILL_MAX_BYTES ?? 300e9) || 300e9;
  const chunkDays = Math.max(1, Number(ctx.env.BQ_CHUNK_DAYS ?? 30) || 30);
  const perQuery: Record<string, number> = {};
  const { BigQuery } = await import("@google-cloud/bigquery");
  const bq = new BigQuery({ projectId: project });
  const notes: string[] = [];
  let bytes = 0;
  let calls = 0;
  let rows = 0;

  const chain = readChain();
  const cursors = ctx.meta.cursors.bigquery;
  const end = addDays(ctx.today, -1); // last complete UTC day
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
    for (const [s, e] of chunks(start("daily_chain"), end, chunkDays)) {
      const out = await runJob({ id: "daily_chain", sql: loadSql("daily_chain"), params: {}, start: s, end: e });
      rows += out.length;
      persist("daily_chain", s, e, out, ["block_date", ...chainCols]);
      const series = rowsToSeries(out, chainCols);
      for (const c of chainCols) chain.bigquery[c] = upsertSeries(chain.bigquery[c] ?? [], series[c], { today: ctx.today });
      if (!ctx.dryRun) cursors["daily_chain"] = e;
    }
    // 2. Receipt actions: chain-level rows (account_id null) and per-receiver rows in one scan.
    const activity = readJson<Record<string, Array<[DateStr, number, number]>>>(path.join(HISTORY, "bigquery", "receivers.json"), {});
    const launches = readJson<Record<string, Array<[DateStr, number]>>>(path.join(HISTORY, "bigquery", "factory-launches.json"), {});
    const receiptCols = ["function_calls", "distinct_signers", "contracts_called", "new_accounts", "contracts_deployed"];
    for (const [s, e] of chunks(start("daily_receipts"), end, chunkDays)) {
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
      if (!ctx.dryRun) cursors["daily_receipts"] = e;
    }
    if (!ctx.dryRun) {
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
  notes.push(`${calls} jobs, ${(bytes / 1e9).toFixed(2)} GB processed, ${accounts.length} tracked accounts`);
  notes.push(`per query: ${Object.entries(perQuery).map(([k, v]) => `${k} ${(v / 1e9).toFixed(1)} GB`).join(", ")}`);
  log("");
  return { rows, calls, bytes, notes };
}
