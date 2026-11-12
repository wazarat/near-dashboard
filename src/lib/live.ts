/**
 * Pure helpers that turn daily history into the "live" numbers the app shows:
 * trailing windows, momentum, sparklines, and the join onto a Project.
 */
import { addDays, dateRange, type DateStr } from "./dates";
import type { Series, SeriesMap } from "./history-types";
import { sumSeries, type MapRow } from "./mapping";
import { isMeasured } from "./sector-metrics";
import { recomputeTier } from "./tier";
import type { LiveMetrics, MetricChange, NumericMetricKey, Project } from "./types";

/** Last complete UTC day at the time of the last refresh. Deterministic across machines. */
export function windowEnd(lastRunDate: DateStr): DateStr {
  return addDays(lastRunDate, -1);
}

export interface WindowSum {
  value: number | null;
  days: number;
}

/** Sum of a flow over the n days ending at `end` (inclusive). Missing days count as 0; null when no point falls in the window. */
export function sumWindow(series: Series, end: DateStr, n: number): WindowSum {
  const start = addDays(end, -(n - 1));
  let total = 0;
  let days = 0;
  for (const [d, v] of series) {
    if (d < start || d > end) continue;
    total += v;
    days += 1;
  }
  return { value: days ? total : null, days };
}

/** Latest stock value at or before `date`, no older than `tolerance` days. */
export function valueAt(series: Series, date: DateStr, tolerance = 3): number | null {
  const floor = addDays(date, -tolerance);
  let best: number | null = null;
  for (const [d, v] of series) {
    if (d > date) break;
    if (d >= floor) best = v;
  }
  return best;
}

export function pctChange(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || !Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) return null;
  return cur / prev - 1;
}

export function flowChange(series: Series, end: DateStr, n: number): number | null {
  const cur = sumWindow(series, end, n);
  const prev = sumWindow(series, addDays(end, -n), n);
  if (prev.days < Math.ceil(n / 2) || cur.days === 0) return null;
  return pctChange(cur.value, prev.value);
}

export function stockChange(series: Series, end: DateStr, n: number): number | null {
  return pctChange(valueAt(series, end), valueAt(series, addDays(end, -n)));
}

export function changes(series: Series, end: DateStr, kind: "flow" | "stock"): MetricChange {
  const f = kind === "flow" ? flowChange : stockChange;
  return { d7: f(series, end, 7), d30: f(series, end, 30), d90: f(series, end, 90) };
}

/** Values aligned to `dates`; flows as daily values with null gaps, stocks forward-filled up to 3 days. */
export function alignSeries(series: Series, dates: DateStr[], kind: "flow" | "stock"): Array<number | null> {
  const m = new Map(series);
  const out: Array<number | null> = [];
  let last: number | null = null;
  let lastDate: DateStr | null = null;
  for (const d of dates) {
    const v = m.get(d);
    if (v !== undefined) {
      last = v;
      lastDate = d;
      out.push(v);
    } else if (kind === "stock" && last !== null && lastDate !== null && d <= addDays(lastDate, 3)) {
      out.push(last);
    } else {
      out.push(null);
    }
  }
  return out;
}

export function sparkDates(end: DateStr, n = 90): DateStr[] {
  return dateRange(addDays(end, -(n - 1)), end);
}

export interface ChainMaps {
  near: SeriesMap;
  aurora: SeriesMap;
}

export interface HistoryStore {
  /** slug -> TVL series on each chain */
  tvl: ChainMaps;
  /** display name -> daily series on each chain */
  volume: ChainMaps;
  fees: ChainMaps;
  revenue: ChainMaps;
  holdersRevenue: ChainMaps;
  supplySideRevenue: ChainMaps;
  /** DEX aggregators and bridge aggregators, by display name. Optional so older stores still load. */
  aggregators?: ChainMaps;
  bridgeAggregators?: ChainMaps;
  nameOfSlug: Map<string, string>;
  mcapOfSlug: Map<string, number | null>;
  /** project name -> [date, calls, signers] from BigQuery, when contracts are tracked */
  activity?: Record<string, Array<[DateStr, number, number]>>;
}

export interface ProjectSeries {
  tvl: Series;
  tvlNear: Series;
  tvlAurora: Series;
  cex: Series;
  volume: Series;
  fees: Series;
  revenue: Series;
  holdersRevenue: Series;
  supplySideRevenue: Series;
}

function pickChain(maps: ChainMaps, keys: string[], chain: MapRow["chain"]): Series[] {
  const out: Series[] = [];
  for (const k of keys) {
    if (chain !== "aurora" && maps.near[k]?.length) out.push(maps.near[k]);
    if (chain !== "near" && maps.aurora[k]?.length) out.push(maps.aurora[k]);
  }
  return out;
}

/** Sum the series of every mapped slug for one project, honouring each row's chain and role. */
export function projectSeries(rows: MapRow[], store: HistoryStore): ProjectSeries {
  const tvlRows = rows.filter((r) => r.role === "tvl" || r.role === "chain-fees");
  const cexRows = rows.filter((r) => r.role === "cex-reserves");
  const flowRows = rows.filter((r) => r.role !== "ignore");
  const tvlNear = sumSeries(tvlRows.filter((r) => r.chain !== "aurora" && r.role === "tvl").map((r) => store.tvl.near[r.slug] ?? []).filter((s) => s.length));
  const tvlAurora = sumSeries(tvlRows.filter((r) => r.chain !== "near" && r.role === "tvl").map((r) => store.tvl.aurora[r.slug] ?? []).filter((s) => s.length));
  const cex = sumSeries(cexRows.flatMap((r) => pickChain(store.tvl, [r.slug], r.chain)));
  const flow = (maps: ChainMaps) =>
    sumSeries(
      flowRows.flatMap((r) => {
        const name = store.nameOfSlug.get(r.slug);
        return name ? pickChain(maps, [name], r.chain) : [];
      }),
    );
  return {
    tvl: sumSeries([tvlNear, tvlAurora]),
    tvlNear,
    tvlAurora,
    cex,
    volume: flow(store.volume),
    fees: flow(store.fees),
    revenue: flow(store.revenue),
    holdersRevenue: flow(store.holdersRevenue),
    supplySideRevenue: flow(store.supplySideRevenue),
  };
}

/** One flow (an overview breakdown keyed by display name) summed over a project's mapped slugs. */
export function projectFlow(rows: MapRow[], store: HistoryStore, maps: ChainMaps | undefined): Series {
  if (!maps) return [];
  return sumSeries(
    rows
      .filter((r) => r.role !== "ignore")
      .flatMap((r) => {
        const name = store.nameOfSlug.get(r.slug);
        return name ? pickChain(maps, [name], r.chain) : [];
      }),
  );
}

export function emptyLive(end: DateStr, slugs: string[]): LiveMetrics {
  const nul = { d7: null, d30: null, d90: null };
  return {
    asOf: end,
    slugs,
    tvl: null,
    tvlNear: null,
    tvlAurora: null,
    volume: null,
    fees: null,
    revenue: null,
    holdersRevenue: null,
    supplySideRevenue: null,
    feesDaily: null,
    change: { tvl: nul, volume: nul, fees: nul, revenue: nul },
    annualisedRevenue: null,
    tokenMarketCap: null,
    psRatio: null,
    cexReserves: null,
    calls7d: null,
    calls30d: null,
    signers7d: null,
    activityAsOf: null,
  };
}

export function computeLive(rows: MapRow[], store: HistoryStore, end: DateStr): LiveMetrics | null {
  const s = projectSeries(rows, store);
  const has = Object.values(s).some((x) => x.length > 0);
  if (!has) return null;
  const sum30 = (x: Series) => sumWindow(x, end, 30).value;
  const slugs = rows.map((r) => r.slug);
  const tvlNear = valueAt(s.tvlNear, end);
  const tvlAurora = valueAt(s.tvlAurora, end);
  const tvl = tvlNear === null && tvlAurora === null ? null : (tvlNear ?? 0) + (tvlAurora ?? 0);
  const volume = sum30(s.volume);
  const fees = sum30(s.fees);
  const revenue = sum30(s.revenue);
  const annualisedRevenue = revenue !== null ? (revenue * 365) / 30 : null;
  const mcaps = slugs.map((sl) => store.mcapOfSlug.get(sl) ?? null).filter((v): v is number => v !== null && v > 0);
  const tokenMarketCap = mcaps.length ? Math.max(...mcaps) : null;
  return {
    ...emptyLive(end, slugs),
    tvl,
    tvlNear,
    tvlAurora,
    volume,
    fees,
    revenue,
    holdersRevenue: sum30(s.holdersRevenue),
    supplySideRevenue: sum30(s.supplySideRevenue),
    feesDaily: valueAt(s.fees, end, 0),
    change: {
      tvl: changes(s.tvl, end, "stock"),
      volume: changes(s.volume, end, "flow"),
      fees: changes(s.fees, end, "flow"),
      revenue: changes(s.revenue, end, "flow"),
    },
    annualisedRevenue,
    tokenMarketCap,
    psRatio: tokenMarketCap !== null && annualisedRevenue !== null && annualisedRevenue > 0 ? tokenMarketCap / annualisedRevenue : null,
    cexReserves: valueAt(s.cex, end),
  };
}

/** Effective = live ?? snapshot. Keeps every consumer of tvl/volume/fees/revenue working. */
export function applyLive(p: Project, live: LiveMetrics | null, mapped: boolean): Project {
  const snapshot = p.snapshot;
  const pick = (k: NumericMetricKey): [number | null, "live" | "snapshot" | "none"] => {
    const lv = live?.[k] ?? null;
    if (lv !== null) return [lv, "live"];
    if (snapshot[k] !== null) return [snapshot[k], "snapshot"];
    return [null, "none"];
  };
  const [tvl, sTvl] = pick("tvl");
  const [volume, sVol] = pick("volume");
  const [fees, sFees] = pick("fees");
  const [revenue, sRev] = pick("revenue");
  const tvlNear = live?.tvlNear ?? (live?.tvl !== null && live?.tvl !== undefined ? null : snapshot.tvlNear);
  const tvlAurora = live?.tvlAurora ?? (live?.tvl !== null && live?.tvl !== undefined ? null : snapshot.tvlAurora);
  return {
    ...p,
    live,
    tvl,
    tvlNear,
    tvlAurora,
    volume,
    fees,
    revenue,
    metricSource: { tvl: sTvl, volume: sVol, fees: sFees, revenue: sRev },
    // A sector with no traction headline has no tier (docs/LIVE-DATA.md, section 2). Otherwise recompute
    // only when daily data exists; an unmapped project keeps its researched tier.
    tier: !isMeasured(p.sector) ? "Not applicable" : live ? recomputeTier({ tvl, volume, fees, revenue, mapped }) : snapshot.tier,
    hasTraction: [tvl, volume, fees, revenue].some((v) => v !== null),
    revenueCapture: fees !== null && revenue !== null && fees > 0 ? revenue / fees : null,
  };
}
