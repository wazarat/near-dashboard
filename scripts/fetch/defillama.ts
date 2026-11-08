/**
 * DefiLlama free API (api.llama.fi). No key. One request per second.
 * Chain keys: "Near" and "Aurora" in /protocols; lowercase "near" / "aurora" in overview URLs.
 */
import path from "node:path";
import { addDays, dateOfUnix } from "../../src/lib/dates";
import { emptyOverview, LLAMA_CHAINS, type ChainHistory, type LlamaChain, type LlamaProtocolSnap, type Series, type SeriesMap } from "../../src/lib/history-types";
import { mappedSlugs, newlyDetected, parseMapRows, unmatchedMapSlugs } from "../../src/lib/mapping";
import { readCsvOrEmpty } from "../lib/csv";
import { debug } from "../lib/log";
import { DATA, HISTORY } from "../lib/paths";
import { readJson, upsertSeries, writeJsonStable } from "../lib/store";
import type { Ctx, RunResult } from "./context";
import { createClient, HttpError, type HttpClient } from "./http";

const BASE = "https://api.llama.fi";
export const CHAIN_KEY: Record<LlamaChain, string> = { near: "Near", aurora: "Aurora" };
const DIR = path.join(HISTORY, "defillama");

export const FEE_TYPES = {
  fees: "dailyFees",
  revenue: "dailyRevenue",
  "holders-revenue": "dailyHoldersRevenue",
  "supply-side-revenue": "dailySupplySideRevenue",
} as const;

interface RawProtocol {
  slug: string;
  name: string;
  parentProtocol?: string | null;
  category?: string;
  chains?: string[];
  chainTvls?: Record<string, number>;
  address?: string | null;
  mcap?: number | null;
  gecko_id?: string | null;
  url?: string | null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Protocols listed on NEAR or Aurora, with the plain per-chain TVL (no -borrowed / -staking variants). */
export function parseProtocols(json: RawProtocol[]): LlamaProtocolSnap[] {
  return json
    .filter((p) => {
      const chains = p.chains ?? [];
      const tv = p.chainTvls ?? {};
      return chains.includes("Near") || chains.includes("Aurora") || "Near" in tv || "Aurora" in tv;
    })
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      parentProtocol: p.parentProtocol ?? null,
      category: p.category ?? "Unknown",
      address: p.address ? String(p.address).toLowerCase() : null,
      tvlNear: p.chainTvls && "Near" in p.chainTvls ? (num(p.chainTvls.Near) ?? 0) : null,
      tvlAurora: p.chainTvls && "Aurora" in p.chainTvls ? (num(p.chainTvls.Aurora) ?? 0) : null,
      mcap: num(p.mcap),
      geckoId: p.gecko_id ?? null,
      url: p.url ?? null,
      kinds: ["tvl"] as LlamaProtocolSnap["kinds"],
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export interface OverviewProtocol {
  name: string;
  module: string | null;
  parentProtocol: string | null;
  category: string | null;
  slug: string | null;
}

export function parseOverviewProtocols(json: { protocols?: Array<Record<string, unknown>> }): OverviewProtocol[] {
  return (json.protocols ?? []).map((p) => ({
    name: String(p.name ?? p.displayName ?? ""),
    module: (p.module as string) ?? null,
    parentProtocol: (p.parentProtocol as string) ?? null,
    category: (p.category as string) ?? null,
    slug: (p.slug as string) ?? null,
  }));
}

/** Fee/volume-only protocols (incl. the chain rows "Near" and "Aurora") never appear in /protocols; merge them in. */
export function mergeOverviewProtocols(base: LlamaProtocolSnap[], extra: Array<{ list: OverviewProtocol[]; kind: "dexs" | "fees" | "aggregators" }>): LlamaProtocolSnap[] {
  const bySlug = new Map(base.map((p) => [p.slug, { ...p, kinds: [...p.kinds] }]));
  const byName = new Map(base.map((p) => [p.name, p.slug]));
  for (const { list, kind } of extra) {
    for (const o of list) {
      const slug = o.slug ?? o.module;
      if (!slug || !o.name) continue;
      const existingSlug = bySlug.has(slug) ? slug : byName.get(o.name);
      if (existingSlug) {
        const e = bySlug.get(existingSlug)!;
        if (!e.kinds.includes(kind)) e.kinds.push(kind);
        continue;
      }
      bySlug.set(slug, { slug, name: o.name, parentProtocol: o.parentProtocol, category: o.category ?? "Unknown", address: null, tvlNear: null, tvlAurora: null, mcap: null, geckoId: null, url: null, kinds: [kind] });
      byName.set(o.name, slug);
    }
  }
  return Array.from(bySlug.values()).sort((a, b) => a.slug.localeCompare(b.slug));
}

type Breakdown = Array<[number, Record<string, number>]>;
export type OverviewJson = { totalDataChart?: Array<[number, number]>; totalDataChartBreakdown?: Breakdown; protocols?: Array<Record<string, unknown>> };

/** Chain overview breakdown -> protocol display name -> daily series. */
export function parseBreakdown(json: { totalDataChartBreakdown?: Breakdown }): SeriesMap {
  const out: Record<string, Map<string, number>> = {};
  for (const [ts, byName] of json.totalDataChartBreakdown ?? []) {
    const d = dateOfUnix(ts);
    for (const [name, v] of Object.entries(byName)) {
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      (out[name] ??= new Map()).set(d, Math.round(v));
    }
  }
  const res: SeriesMap = {};
  for (const [name, m] of Object.entries(out)) res[name] = Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return res;
}

export function parseTotalChart(json: { totalDataChart?: Array<[number, number]> }): Series {
  return (json.totalDataChart ?? []).filter(([, v]) => typeof v === "number" && Number.isFinite(v)).map(([ts, v]) => [dateOfUnix(ts), Math.round(v)] as [string, number]);
}

/** Sum of the breakdown per day (used when totalDataChart is excluded). */
export function sumBreakdown(json: { totalDataChartBreakdown?: Breakdown }): Series {
  return (json.totalDataChartBreakdown ?? []).map(([ts, byName]) => {
    let t = 0;
    for (const v of Object.values(byName)) if (typeof v === "number" && Number.isFinite(v)) t += v;
    return [dateOfUnix(ts), Math.round(t)] as [string, number];
  });
}

/** /protocol/{slug}: per-chain TVL history. */
export function parseProtocolTvl(json: { chainTvls?: Record<string, { tvl?: { date: number; totalLiquidityUSD: number }[] }> }, chain: LlamaChain): Series {
  const pts = json.chainTvls?.[CHAIN_KEY[chain]]?.tvl ?? [];
  const m = new Map<string, number>();
  for (const p of pts) if (Number.isFinite(p.totalLiquidityUSD)) m.set(dateOfUnix(p.date), Math.round(p.totalLiquidityUSD));
  return Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

export function parseChainTvl(json: Array<{ date: number; tvl: number }>): Series {
  return json.filter((p) => Number.isFinite(p.tvl)).map((p) => [dateOfUnix(p.date), Math.round(p.tvl)] as [string, number]);
}

export function readProtocols(): LlamaProtocolSnap[] {
  return readJson<LlamaProtocolSnap[]>(path.join(DIR, "protocols.json"), []);
}

export function readSeriesFile(name: string): SeriesMap {
  return readJson<SeriesMap>(path.join(DIR, `${name}.json`), {});
}

export function readChain(): ChainHistory {
  const c = readJson<Partial<ChainHistory>>(path.join(HISTORY, "chain.json"), {});
  return { near: { ...emptyOverview(), ...(c.near ?? {}) }, aurora: { ...emptyOverview(), ...(c.aurora ?? {}) }, nearblocks: c.nearblocks ?? {}, bigquery: c.bigquery ?? {}, price: c.price ?? {} };
}

export function writeChain(c: ChainHistory): boolean {
  return writeJsonStable(path.join(HISTORY, "chain.json"), c);
}

export async function fetchProtocols(client: HttpClient): Promise<LlamaProtocolSnap[]> {
  return parseProtocols(await client.getJson<RawProtocol[]>(`${BASE}/protocols`));
}

export async function fetchOverview(client: HttpClient, chain: LlamaChain, kind: "dexs" | "fees" | "aggregators", dataType?: string): Promise<OverviewJson> {
  const q = new URLSearchParams({ excludeTotalDataChart: "true" });
  if (dataType) q.set("dataType", dataType);
  return client.getJson<OverviewJson>(`${BASE}/overview/${kind}/${chain}?${q}`);
}

/** The combined protocol snapshot (TVL listing + overviews on both chains) used for mapping. */
export async function fetchAllProtocols(client: HttpClient): Promise<LlamaProtocolSnap[]> {
  const base = await fetchProtocols(client);
  const extra: Array<{ list: OverviewProtocol[]; kind: "dexs" | "fees" | "aggregators" }> = [];
  for (const chain of LLAMA_CHAINS) {
    extra.push({ list: parseOverviewProtocols(await fetchOverview(client, chain, "dexs")), kind: "dexs" });
    extra.push({ list: parseOverviewProtocols(await fetchOverview(client, chain, "fees", "dailyFees")), kind: "fees" });
    extra.push({ list: parseOverviewProtocols(await fetchOverview(client, chain, "aggregators")), kind: "aggregators" });
  }
  return mergeOverviewProtocols(base, extra);
}

function mergeMap(existing: SeriesMap, incoming: SeriesMap, today: string): SeriesMap {
  const out: SeriesMap = { ...existing };
  for (const [name, s] of Object.entries(incoming)) out[name] = upsertSeries(existing[name] ?? [], s, { today, allowToday: false });
  return out;
}

export async function run(ctx: Ctx): Promise<RunResult> {
  const client = createClient({ name: "defillama", minIntervalMs: 1000, timeoutMs: 120_000 });
  const notes: string[] = [];
  let rows = 0;
  const chain = readChain();
  const extra: Array<{ list: OverviewProtocol[]; kind: "dexs" | "fees" | "aggregators" }> = [];

  // 1. Chain overviews: one call per chain and data type gives every protocol's daily series.
  for (const c of LLAMA_CHAINS) {
    const dexs = await fetchOverview(client, c, "dexs");
    const bd = parseBreakdown(dexs);
    if (!ctx.dryRun) writeJsonStable(path.join(DIR, `volume-${c}.json`), mergeMap(readSeriesFile(`volume-${c}`), bd, ctx.today));
    chain[c].volume = upsertSeries(chain[c].volume, sumBreakdown(dexs), { today: ctx.today });
    extra.push({ list: parseOverviewProtocols(dexs), kind: "dexs" });
    rows += Object.keys(bd).length;

    const chainKey: Record<keyof typeof FEE_TYPES, keyof ChainHistory["near"]> = { fees: "fees", revenue: "revenue", "holders-revenue": "holdersRevenue", "supply-side-revenue": "supplySideRevenue" };
    for (const [file, dataType] of Object.entries(FEE_TYPES) as Array<[keyof typeof FEE_TYPES, string]>) {
      try {
        const json = await fetchOverview(client, c, "fees", dataType);
        const fb = parseBreakdown(json);
        if (!ctx.dryRun) writeJsonStable(path.join(DIR, `${file}-${c}.json`), mergeMap(readSeriesFile(`${file}-${c}`), fb, ctx.today));
        chain[c][chainKey[file]] = upsertSeries(chain[c][chainKey[file]], sumBreakdown(json), { today: ctx.today });
        rows += Object.keys(fb).length;
        if (file === "fees") extra.push({ list: parseOverviewProtocols(json), kind: "fees" });
      } catch (e) {
        notes.push(`${c} ${dataType} failed: ${(e as Error).message}`);
      }
    }
    try {
      const agg = await fetchOverview(client, c, "aggregators");
      const ab = parseBreakdown(agg);
      if (!ctx.dryRun) writeJsonStable(path.join(DIR, `aggregators-${c}.json`), mergeMap(readSeriesFile(`aggregators-${c}`), ab, ctx.today));
      extra.push({ list: parseOverviewProtocols(agg), kind: "aggregators" });
      rows += Object.keys(ab).length;
    } catch (e) {
      notes.push(`${c} aggregators failed: ${(e as Error).message}`);
    }
    // Chain TVL (DefiLlama default view, excludes liquid staking and bridges).
    chain[c].tvl = upsertSeries(chain[c].tvl, parseChainTvl(await client.getJson(`${BASE}/v2/historicalChainTvl/${CHAIN_KEY[c]}`)), { today: ctx.today, allowToday: true });
  }
  if (!ctx.dryRun) writeChain(chain);

  // 2. Protocol listing merged with overview-only protocols + mapping report.
  const protocols = mergeOverviewProtocols(await fetchProtocols(client), extra);
  const map = parseMapRows(readCsvOrEmpty(path.join(DATA, "defillama-map.csv")));
  if (!ctx.dryRun) writeJsonStable(path.join(DIR, "protocols.json"), protocols);
  const catalogDetected = ctx.meta.newlyDetected.filter((n) => n.source === "catalog");
  ctx.meta.newlyDetected = [...newlyDetected(protocols, map, ctx.meta.newlyDetected, ctx.today), ...catalogDetected];
  ctx.meta.unmatchedMap = unmatchedMapSlugs(map, protocols);
  notes.push(`${protocols.length} protocols on NEAR or Aurora (${protocols.filter((p) => p.kinds.includes("tvl")).length} with TVL), ${map.length} map rows, ${ctx.meta.newlyDetected.length} newly detected`);
  if (!map.length) notes.push("defillama-map.csv missing or empty: per-protocol TVL history skipped (run npm run seed:map)");

  // 3. Per-protocol TVL per chain. Daily: today's listing value. Backfill (or thin history): full series per slug.
  const bySlug = new Map(protocols.map((p) => [p.slug, p]));
  const slugs = Array.from(mappedSlugs(map)).filter((s) => bySlug.get(s)?.kinds.includes("tvl"));
  const tvl: Record<LlamaChain, SeriesMap> = { near: readSeriesFile("tvl-near"), aurora: readSeriesFile("tvl-aurora") };
  let fetched = 0;
  for (const slug of slugs) {
    const p = bySlug.get(slug)!;
    const thin = LLAMA_CHAINS.some((c) => (c === "near" ? p.tvlNear !== null : p.tvlAurora !== null) && (tvl[c][slug]?.length ?? 0) < 7);
    if (ctx.mode === "backfill" || thin) {
      try {
        const json = await client.getJson<Parameters<typeof parseProtocolTvl>[0]>(`${BASE}/protocol/${encodeURIComponent(slug)}`);
        for (const c of LLAMA_CHAINS) {
          const s = parseProtocolTvl(json, c);
          if (s.length) tvl[c][slug] = upsertSeries(tvl[c][slug] ?? [], s, { today: ctx.today, allowToday: true, revisionDays: 10_000 });
        }
        fetched += 1;
        continue;
      } catch (e) {
        if (!(e instanceof HttpError && e.status === 404)) notes.push(`protocol/${slug} failed: ${(e as Error).message}`);
      }
    }
    if (p.tvlNear !== null) tvl.near[slug] = upsertSeries(tvl.near[slug] ?? [], [[ctx.today, Math.round(p.tvlNear)]], { today: ctx.today, allowToday: true });
    if (p.tvlAurora !== null) tvl.aurora[slug] = upsertSeries(tvl.aurora[slug] ?? [], [[ctx.today, Math.round(p.tvlAurora)]], { today: ctx.today, allowToday: true });
  }
  if (!ctx.dryRun) {
    writeJsonStable(path.join(DIR, "tvl-near.json"), tvl.near);
    writeJsonStable(path.join(DIR, "tvl-aurora.json"), tvl.aurora);
  }
  rows += slugs.length;
  notes.push(`tvl: ${slugs.length} mapped slugs, ${fetched} full histories fetched`);
  void addDays;
  debug(JSON.stringify(client.stats()));
  return { rows, calls: client.stats().calls, notes };
}
