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

/** Trimmed row kept on disk: [createdAtUnix, status, originAsset, destinationAsset, amountInUsd, amountOutUsd, recipientHash, referral, appFeeRecipients, depositAddress, depositMemo] */
export type TrimRow = [number, string, string, string, number, number, string, string | null, string[], string, string | null];

function hash(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
}

function usd(v: string | number | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

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
  ];
}

/**
 * Chain of an asset id. NEAR Intents assets are `nep141:<token>` where bridged tokens end in
 * `.omft.near` with a chain prefix (e.g. `eth-0x…omft.near`, `sol-….omft.near`, `btc.omft.near`),
 * native NEAR tokens are plain `.near` accounts, and some ids carry an explicit chain prefix.
 */
export function assetChain(asset: string): string {
  if (!asset) return "unknown";
  const id = asset.replace(/^nep141:|^nep245:|^nep171:/, "");
  const m = id.match(/^([a-z0-9]+)[-.]([a-z0-9-]*\.)?omft\.near$/i) ?? id.match(/^([a-z0-9]+)-0x[0-9a-f]+\.omft\.near$/i);
  if (m) return m[1].toLowerCase();
  if (/\.omft\.near$/i.test(id)) return id.split(".")[0].toLowerCase();
  if (/^v2_1\.omni\.hot\.tg:(\d+)_/.test(id)) return `hot-${id.match(/^v2_1\.omni\.hot\.tg:(\d+)_/)![1]}`;
  if (/\.near$|^[a-f0-9]{64}$/i.test(id)) return "near";
  return id.split(/[:.]/)[0].toLowerCase() || "unknown";
}

/** Short asset label: the token symbol part of the id when recognisable. */
export function assetLabel(asset: string): string {
  const id = asset.replace(/^nep141:|^nep245:|^nep171:/, "");
  if (/^[a-f0-9]{64}$/i.test(id)) return "USDC (native)";
  if (id === "wrap.near") return "wNEAR";
  const m = id.match(/^([a-z0-9]+)\.omft\.near$/i);
  if (m) return m[1].toUpperCase();
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
  const flush = () => {
    for (const [d, list] of buffer) {
      if (!ctx.dryRun) writeJsonGz(dayFile(d), mergeDayRows(readDayRows(d), list));
      touched.add(d);
    }
    buffer.clear();
  };
  const absorb = (page: ApiRow[]) => {
    for (const r of page) {
      const t = trimRow(r);
      const d = dateOfUnix(t[0]);
      (buffer.get(d) ?? buffer.set(d, []).get(d)!).push(t);
    }
    rows += page.length;
  };

  // Phase A (every run): newest rows first, from "now" back to the start of yesterday so the last
  // two UTC days are complete. Stops early once a page is entirely older than that window.
  const recentStart = toUnixDay(addDays(ctx.today, -1));
  let pageCursor: Page["cursor"] = null;
  let newest: number | null = null;
  while (calls < ctx.maxCalls) {
    const page = await fetchPage(client, jwt, { direction: "next", startTimestampUnix: recentStart - 1, lastDepositAddress: pageCursor?.lastDepositAddress, lastDepositMemo: pageCursor?.lastDepositMemo });
    calls += 1;
    if (!page.rows.length) break;
    newest ??= trimRow(page.rows[0])[0];
    absorb(page.rows);
    pageCursor = page.cursor;
    if (page.rows.length < 1000) break;
    if (calls % 20 === 0) flush();
  }
  flush();
  if (newest) cursor.newestCreatedAt = new Date(newest * 1000).toISOString();
  notes.push(`recent window: ${rows} rows in ${calls} calls`);

  // Phase B (remaining budget): walk older from the backfill cursor until the target date.
  if (!cursor.backfillDone) {
    const before = cursor.oldestCreatedAt ? Math.floor(Date.parse(cursor.oldestCreatedAt) / 1000) : recentStart;
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
      absorb(page.rows);
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
      if (calls % 20 === 0) flush();
    }
    flush();
    notes.push(`backfill: ${bRows} rows in ${calls - startCalls} calls, oldest ${cursor.oldestCreatedAt ?? "-"}, target ${target}${cursor.backfillDone ? " (done)" : ""}`);
  }

  // Re-aggregate every day touched; the oldest day of an unfinished backfill is marked partial.
  const oldestDay = cursor.oldestCreatedAt ? dateOfUnix(Math.floor(Date.parse(cursor.oldestCreatedAt) / 1000)) : null;
  if (!ctx.dryRun) {
    for (const d of touched) {
      const partial = d === ctx.today || (!cursor.backfillDone && d === oldestDay);
      writeJsonStable(path.join(DAILY_DIR, `${d}.json`), aggregateDay(d, readDayRows(d), partial));
    }
  }
  debug(JSON.stringify(client.stats()));
  return { rows, calls, notes: [...notes, `${touched.size} days aggregated`] };
}
