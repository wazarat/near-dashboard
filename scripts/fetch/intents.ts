/**
 * NEAR Intents Explorer API (explorer.near-intents.org/api/v0/transactions): 1Click swaps only.
 * JWT from NEAR_INTENTS_JWT; 1 request per 5 seconds; at most 1000 rows per page; cursor is
 * lastDepositAddress + lastDepositMemo with direction=next (older).
 *
 * Storage: trimmed rows per UTC day in data/raw/intents/days/YYYY-MM-DD.json.gz (gitignored,
 * regenerable) and committed per-day aggregates in data/raw/intents/daily/YYYY-MM-DD.json.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { addDays, dateOfUnix, toUnixDay, type DateStr } from "../../src/lib/dates";
import type { IntentsDay } from "../../src/lib/history-types";
import { readJsonGz, writeJsonGz } from "../lib/gzip";
import { debug } from "../lib/log";
import { RAW } from "../lib/paths";
import { readJson, writeJsonStable } from "../lib/store";
import { skipped, type Ctx, type RunResult } from "./context";
import { createClient, type HttpClient } from "./http";

const BASE = "https://explorer.near-intents.org/api/v0/transactions";
export const INTENTS_DIR = path.join(RAW, "intents");
const DAYS_DIR = path.join(INTENTS_DIR, "days");
const DAILY_DIR = path.join(INTENTS_DIR, "daily");

/** Raw row as returned by the API (only the fields we read). */
export interface ApiRow {
  depositAddress: string;
  depositMemo?: string | null;
  status: string;
  createdAt: string;
  createdAtTimestamp?: number;
  originAsset?: string;
  destinationAsset?: string;
  amountInUsd?: string | number | null;
  amountOutUsd?: string | number | null;
  recipient?: string | null;
  referral?: string | null;
  appFees?: Array<{ recipient: string; fee: number }> | null;
  senders?: string[] | null;
}

/**
 * Trimmed row kept on disk: [createdAtUnix, status, originAsset, destinationAsset, amountInUsd, amountOutUsd, recipientHash,
 * referral, appFeeRecipients, depositAddress, depositMemo, appFeeBps]. appFeeBps (the summed app fee in basis points, protocol buyback fee left out) was
 * added on Nov 13, 2026; older rows on disk end at depositMemo.
 */
export type TrimRow = [number, string, string, string, number, number, string, string | null, string[], string, string | null, number?];

function hash(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
}

function usd(v: string | number | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Fee recipients that are the protocol, not an app: since the Feb 2026 fee switch every swap pays about 1 basis
 * point to buybacks.multisignature.near, which funds NEAR buybacks. It is left out of app fees.
 */
export const PROTOCOL_FEE_RECIPIENTS = new Set(["buybacks.multisignature.near"]);

export function trimRow(r: ApiRow): TrimRow {
  const ts = typeof r.createdAtTimestamp === "number" ? r.createdAtTimestamp : Math.floor(Date.parse(r.createdAt) / 1000);
  return [
    ts,
    r.status,
    r.originAsset ?? "",
    r.destinationAsset ?? "",
    usd(r.amountInUsd),
    usd(r.amountOutUsd),
    hash(r.recipient ?? ""),
    r.referral ?? null,
    Array.from(new Set((r.appFees ?? []).map((f) => f.recipient))),
    r.depositAddress,
    r.depositMemo ?? null,
    (r.appFees ?? []).reduce((s, f) => s + (PROTOCOL_FEE_RECIPIENTS.has(f.recipient) || !Number.isFinite(f.fee) ? 0 : f.fee), 0),
  ];
}

/** EVM chain ids used in HOT omni token ids (nep245:v2_1.omni.hot.tg:<chainId>_<token>). */
const EVM_CHAIN_NAMES: Record<string, string> = {
  "1": "eth",
  "10": "op",
  "56": "bsc",
  "100": "gnosis",
  "137": "pol",
  "143": "monad",
  "196": "xlayer",
  "1100": "ton",
  "1111": "ton",
  "1117": "tron",
  "2000": "doge",
  "8453": "base",
  "42161": "arb",
  "43114": "avax",
  "80094": "bera",
  "534352": "scroll",
  "1313161554": "aurora",
};

/**
 * Chain of a NEAR Intents asset id. Three id families appear in the Explorer rows:
 *  - `nep141:<chain>.omft.near` / `nep141:<chain>-0x….omft.near`: bridged tokens, the prefix is the chain;
 *  - `nep245:v2_1.omni.hot.tg:<evmChainId>_<token>`: HOT omni tokens, mapped through EVM_CHAIN_NAMES;
 *  - `1cs_v1:<chain>:<standard>:<id>`: 1Click canonical ids, the chain is the second segment;
 * anything else (`nep141:usdt.tether-token.near`, `nep141:token.sweat`, 64-hex native USDC) is NEAR itself.
 */
export function assetChain(asset: string): string {
  if (!asset) return "unknown";
  const cs = asset.match(/^1cs_v1:([a-z0-9]+):/i);
  if (cs) return cs[1].toLowerCase();
  const hot = asset.match(/^nep245:v2_1\.omni\.hot\.tg:(\d+)_/);
  if (hot) return EVM_CHAIN_NAMES[hot[1]] ?? `hot-${hot[1]}`;
  const id = asset.replace(/^nep(141|245|171):/, "");
  const omft = id.match(/^([a-z0-9]+)(?:-0x[0-9a-f]+|-[a-z0-9]+)?\.omft\.near$/i);
  if (omft) return omft[1].toLowerCase();
  if (/\.omft\.near$/i.test(id)) return id.split(/[.-]/)[0].toLowerCase();
  return "near";
}

/** Short asset label: the token symbol part of the id when recognisable. */
export function assetLabel(asset: string): string {
  const cs = asset.match(/^1cs_v1:([a-z0-9]+):([a-z0-9]+):(.+)$/i);
  if (cs) return cs[3] === "coin" || cs[3] === "native" ? `${cs[1].toUpperCase()} (native)` : `${cs[1]}:${cs[3].length > 14 ? `${cs[3].slice(0, 6)}…${cs[3].slice(-4)}` : cs[3]}`;
  const hot = asset.match(/^nep245:v2_1\.omni\.hot\.tg:(\d+)_(.*)$/);
  if (hot) {
    const chain = EVM_CHAIN_NAMES[hot[1]] ?? `hot-${hot[1]}`;
    const tok = hot[2];
    return /^1+$/.test(tok) || tok === "" ? `${chain.toUpperCase()} (native, HOT)` : `${chain}:${tok.slice(0, 6)}… (HOT)`;
  }
  const id = asset.replace(/^nep(141|245|171):/, "");
  if (/^[a-f0-9]{64}$/i.test(id)) return "USDC (native NEAR)";
  if (id === "wrap.near") return "wNEAR";
  if (id === "usdt.tether-token.near") return "USDT (native NEAR)";
  if (id === "token.sweat") return "SWEAT";
  const m = id.match(/^([a-z0-9]+)\.omft\.near$/i);
  if (m) return m[1].toUpperCase();
  const m2 = id.match(/^([a-z0-9]+)-0x([0-9a-f]+)\.omft\.near$/i);
  if (m2) return `${m2[1]}:0x${m2[2].slice(0, 6)}…`;
  return id.length > 28 ? `${id.slice(0, 12)}…${id.slice(-10)}` : id;
}

function tally(map: Record<string, { count: number; usd: number }>, key: string, v: number) {
  const e = (map[key] ??= { count: 0, usd: 0 });
  e.count += 1;
  e.usd += v;
}

function roundMap(map: Record<string, { count: number; usd: number }>, top = 60): Record<string, { count: number; usd: number }> {
  const entries = Object.entries(map).sort((a, b) => b[1].usd - a[1].usd || b[1].count - a[1].count);
  const kept = entries.slice(0, top);
  const rest = entries.slice(top);
  const out: Record<string, { count: number; usd: number }> = {};
  for (const [k, v] of kept) out[k] = { count: v.count, usd: Math.round(v.usd) };
  if (rest.length) out["(other)"] = { count: rest.reduce((a, [, v]) => a + v.count, 0), usd: Math.round(rest.reduce((a, [, v]) => a + v.usd, 0)) };
  return out;
}

function quantile(sorted: number[], q: number): number | null {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[i];
}

/** Pure aggregation of one day's trimmed rows. Volume uses amountInUsd of SUCCESS swaps only. */
export function aggregateDay(date: DateStr, rows: TrimRow[], partial: boolean): IntentsDay {
  const statuses: Record<string, number> = {};
  const routes: Record<string, { count: number; usd: number }> = {};
  const originChains: Record<string, { count: number; usd: number }> = {};
  const destinationChains: Record<string, { count: number; usd: number }> = {};
  const originAssets: Record<string, { count: number; usd: number }> = {};
  const destinationAssets: Record<string, { count: number; usd: number }> = {};
  const referrals: Record<string, { count: number; usd: number }> = {};
  const appFeeRecipients: Record<string, { count: number; usd: number }> = {};
  const referralFees: Record<string, number> = {};
  // App fees per referral need every row's fee rate; rows trimmed before the rate was kept have none.
  const feesKnown = rows.length > 0 && rows.every((r) => typeof r[11] === "number");
  const recipients = new Set<string>();
  const sizes: number[] = [];
  let volumeUsd = 0;
  let volumeOutUsd = 0;
  let successCount = 0;
  for (const r of rows) {
    const [, status, oa, da, inUsd, outUsd, recip, referral, fees] = r;
    statuses[status] = (statuses[status] ?? 0) + 1;
    if (status !== "SUCCESS") continue;
    successCount += 1;
    volumeUsd += inUsd;
    volumeOutUsd += outUsd;
    sizes.push(inUsd);
    if (recip) recipients.add(recip);
    const oc = assetChain(oa);
    const dc = assetChain(da);
    tally(routes, `${oc}>${dc}`, inUsd);
    tally(originChains, oc, inUsd);
    tally(destinationChains, dc, inUsd);
    tally(originAssets, assetLabel(oa), inUsd);
    tally(destinationAssets, assetLabel(da), inUsd);
    tally(referrals, referral ?? "(none)", inUsd);
    if (fees.length) for (const f of fees) tally(appFeeRecipients, f, inUsd);
    else tally(appFeeRecipients, "(none)", inUsd);
    const bps = r[11];
    if (feesKnown && typeof bps === "number" && bps > 0) {
      const key = referral ?? "(none)";
      referralFees[key] = (referralFees[key] ?? 0) + (inUsd * bps) / 10_000;
    }
  }
  sizes.sort((a, b) => a - b);
  return {
    date,
    rows: rows.length,
    sha256: crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
    statuses,
    volumeUsd: Math.round(volumeUsd),
    volumeOutUsd: Math.round(volumeOutUsd),
    successCount,
    uniqueRecipients: recipients.size,
    medianUsd: quantile(sizes, 0.5),
    p90Usd: quantile(sizes, 0.9),
    maxUsd: sizes.length ? sizes[sizes.length - 1] : null,
    routes: roundMap(routes),
    originChains: roundMap(originChains, 40),
    destinationChains: roundMap(destinationChains, 40),
    originAssets: roundMap(originAssets, 40),
    destinationAssets: roundMap(destinationAssets, 40),
    referrals: roundMap(referrals, 40),
    appFeeRecipients: roundMap(appFeeRecipients, 40),
    ...(feesKnown ? { referralFees: Object.fromEntries(Object.entries(referralFees).map(([k, v]) => [k, Math.round(v * 100) / 100] as [string, number]).sort((a, b) => (a[0] < b[0] ? -1 : 1))) } : {}),
    partial,
  };
}

function dayFile(d: DateStr) {
  return path.join(DAYS_DIR, `${d}.json.gz`);
}

export function readDayRows(d: DateStr): TrimRow[] {
  return readJsonGz<TrimRow[]>(dayFile(d), []);
}

/** Merge rows into a day's file, deduplicating on depositAddress+memo (the API's row identity). */
export function mergeDayRows(existing: TrimRow[], incoming: TrimRow[]): TrimRow[] {
  const m = new Map<string, TrimRow>();
  for (const r of existing) m.set(`${r[9]}|${r[10] ?? ""}`, r);
  for (const r of incoming) m.set(`${r[9]}|${r[10] ?? ""}`, r);
  return Array.from(m.values()).sort((a, b) => a[0] - b[0]);
}

export function readDaily(): IntentsDay[] {
  if (!fs.existsSync(DAILY_DIR)) return [];
  return fs
    .readdirSync(DAILY_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .map((f) => readJson<IntentsDay>(path.join(DAILY_DIR, f), null as unknown as IntentsDay))
    .filter(Boolean);
}

/**
 * Where a backfill run picks up, and the newest second it may keep rows from.
 *
 * With the cursor day's rows on disk (a machine that ran the earlier pages) it continues at the cursor. On a fresh
 * checkout the trimmed rows are not there (they are gitignored), so continuing inside a day would rebuild that day's
 * aggregate from part of its rows. It then restarts at the start of the oldest complete committed day: every older
 * day is read whole, and rows from that day onward are dropped (`ceiling`) so finished aggregates are never rewritten.
 */
export function backfillResume(cursorUnix: number | null, days: Array<Pick<IntentsDay, "date" | "partial">>, hasRows: (d: DateStr) => boolean, fallbackUnix: number): { before: number; ceiling: number | null } {
  if (cursorUnix !== null && hasRows(dateOfUnix(cursorUnix))) return { before: cursorUnix, ceiling: null };
  const oldestComplete = days.filter((d) => !d.partial).map((d) => d.date).sort()[0];
  if (oldestComplete) return { before: toUnixDay(oldestComplete), ceiling: toUnixDay(oldestComplete) };
  return { before: cursorUnix ?? fallbackUnix, ceiling: null };
}

interface Page {
  rows: ApiRow[];
  cursor: { lastDepositAddress: string; lastDepositMemo: string | null } | null;
}

export async function fetchPage(client: HttpClient, jwt: string, params: Record<string, string | number | null | undefined>): Promise<Page> {
  const q = new URLSearchParams();
  q.set("numberOfTransactions", "1000");
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") q.set(k, String(v));
  const rows = await client.getJson<ApiRow[]>(`${BASE}?${q}`, { headers: { Authorization: `Bearer ${jwt}` }, noCache: true });
  if (!Array.isArray(rows)) throw new Error("Explorer API returned a non-array payload");
  const last = rows.at(-1);
  return { rows, cursor: last ? { lastDepositAddress: last.depositAddress, lastDepositMemo: last.depositMemo ?? null } : null };
}

let saveProgress: (() => void) | null = null;
/** The orchestrator registers its _meta.json writer so cursors persist mid-run. */
export function onProgress(fn: (() => void) | null) {
  saveProgress = fn;
}

export async function run(ctx: Ctx): Promise<RunResult> {
  const jwt = ctx.env.NEAR_INTENTS_JWT;
  if (!jwt) return skipped("NEAR_INTENTS_JWT not set; DefiLlama NEAR Intents volume stands in on the site");
  const client = createClient({ name: "intents", minIntervalMs: 5200, timeoutMs: 90_000, maxRetries: 6 });
  const notes: string[] = [];
  const backfillDays = Math.max(1, Number(ctx.env.INTENTS_BACKFILL_DAYS ?? 90) || 90);
  const target = addDays(ctx.today, -backfillDays);
  const cursor = ctx.meta.cursors.intents;
  const touched = new Set<DateStr>();
  let rows = 0;
  let calls = 0;
  const buffer = new Map<DateStr, TrimRow[]>();
  const aggregate = (days: Iterable<DateStr>) => {
    if (ctx.dryRun) return;
    const oldestDay = cursor.oldestCreatedAt ? dateOfUnix(Math.floor(Date.parse(cursor.oldestCreatedAt) / 1000)) : null;
    for (const d of days) {
      const partial = d === ctx.today || (!cursor.backfillDone && d === oldestDay);
      writeJsonStable(path.join(DAILY_DIR, `${d}.json`), aggregateDay(d, readDayRows(d), partial));
    }
  };
  /** Rows go to disk and the touched days are re-aggregated at every flush, so a stopped run keeps its progress. */
  const flush = () => {
    const days = Array.from(buffer.keys());
    for (const [d, list] of buffer) {
      if (!ctx.dryRun) writeJsonGz(dayFile(d), mergeDayRows(readDayRows(d), list));
      touched.add(d);
    }
    buffer.clear();
    aggregate(days);
    saveProgress?.();
  };
  const absorb = (page: ApiRow[], ceiling: number | null = null) => {
    for (const r of page) {
      const t = trimRow(r);
      if (ceiling !== null && t[0] >= ceiling) continue;
      const d = dateOfUnix(t[0]);
      (buffer.get(d) ?? buffer.set(d, []).get(d)!).push(t);
    }
    rows += page.length;
  };

  // Phase A (every run): newest rows first, from "now" back to the start of yesterday so the last
  // two UTC days are complete. Stops early once a page is entirely older than that window.
  // INTENTS_REFETCH_DAYS widens this window to re-read whole days again (used once to add app fee rates to
  // rows trimmed before they were kept); rows merge by deposit address, so a re-read never double counts.
  const refetchDays = Math.max(1, Number(ctx.env.INTENTS_REFETCH_DAYS ?? 1) || 1);
  const recentStart = toUnixDay(addDays(ctx.today, -refetchDays));
  // INTENTS_SKIP_RECENT=1 leaves this phase out, for backfill runs that only continue the cursor.
  const skipRecent = ctx.env.INTENTS_SKIP_RECENT === "1";
  let pageCursor: Page["cursor"] = null;
  let newest: number | null = null;
  while (!skipRecent && calls < ctx.maxCalls) {
    const page = await fetchPage(client, jwt, { direction: "next", startTimestampUnix: recentStart - 1, lastDepositAddress: pageCursor?.lastDepositAddress, lastDepositMemo: pageCursor?.lastDepositMemo });
    calls += 1;
    if (!page.rows.length) break;
    newest ??= trimRow(page.rows[0])[0];
    absorb(page.rows);
    pageCursor = page.cursor;
    if (page.rows.length < 1000) break;
    if (calls % 5 === 0) flush();
  }
  flush();
  if (newest) cursor.newestCreatedAt = new Date(newest * 1000).toISOString();
  notes.push(skipRecent ? "recent window skipped (INTENTS_SKIP_RECENT)" : `recent window: ${rows} rows in ${calls} calls`);

  // Phase B (remaining budget): walk older from the backfill cursor until the target date.
  // Daily runs only continue an unfinished backfill when asked (INTENTS_CONTINUE_BACKFILL=1), so a
  // scheduled run never races a long local backfill for the same cursor.
  const continueBackfill = ctx.mode === "backfill" || ctx.env.INTENTS_CONTINUE_BACKFILL === "1";
  if (!cursor.backfillDone && continueBackfill) {
    const { before, ceiling } = backfillResume(cursor.oldestCreatedAt ? Math.floor(Date.parse(cursor.oldestCreatedAt) / 1000) : null, readDaily(), (d) => fs.existsSync(dayFile(d)), recentStart);
    if (ceiling !== null) notes.push(`backfill resumed at ${dateOfUnix(ceiling)} 00:00 UTC (no row files on disk, so the day before it is read whole)`);
    let older: Page["cursor"] = null;
    let oldest = before;
    let bRows = 0;
    const startCalls = calls;
    while (calls < ctx.maxCalls) {
      const page = await fetchPage(client, jwt, { direction: "next", endTimestampUnix: before, startTimestampUnix: toUnixDay(target) - 1, lastDepositAddress: older?.lastDepositAddress, lastDepositMemo: older?.lastDepositMemo });
      calls += 1;
      if (!page.rows.length) {
        cursor.backfillDone = true;
        break;
      }
      absorb(page.rows, ceiling);
      bRows += page.rows.length;
      older = page.cursor;
      oldest = trimRow(page.rows.at(-1)!)[0];
      cursor.oldestCreatedAt = new Date(oldest * 1000).toISOString();
      cursor.lastDepositAddress = older?.lastDepositAddress ?? null;
      cursor.lastDepositMemo = older?.lastDepositMemo ?? null;
      if (page.rows.length < 1000 || oldest <= toUnixDay(target)) {
        cursor.backfillDone = oldest <= toUnixDay(target) || page.rows.length < 1000;
        break;
      }
      if (calls % 5 === 0) flush();
    }
    flush();
    notes.push(`backfill: ${bRows} rows in ${calls - startCalls} calls, oldest ${cursor.oldestCreatedAt ?? "-"}, target ${target}${cursor.backfillDone ? " (done)" : ""}`);
  }

  // Final pass over every touched day (clears the partial flag once the backfill is done).
  aggregate(touched);
  debug(JSON.stringify(client.stats()));
  return { rows, calls, notes: [...notes, `${touched.size} days aggregated`] };
}
