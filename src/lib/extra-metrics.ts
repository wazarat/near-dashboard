/**
 * Registry metrics beyond DefiLlama's four (src/lib/sector-metrics.ts), merged per project from two places:
 * this build's live fetches, and the dated snapshot in data/near-live-metrics-*.csv (docs/LIVE-DATA.md,
 * requirement 7). A live value replaces the snapshot value for the same metric as soon as it lands.
 */
import type { MetricId } from "./sector-metrics";
import type { ProjectExtra } from "./types";

/** Snapshot CSV column → metric. Two stablecoin columns add up to one metric. */
export const SEED_COLUMNS: Array<{ column: string; id: MetricId }> = [
  { column: "Borrowed (USD)", id: "borrowed" },
  { column: "Total Deposited (USD)", id: "totalDeposited" },
  { column: "Own-token Staking (USD)", id: "ownStaking" },
  { column: "30d Holders Revenue (USD)", id: "holdersRevenue" },
  { column: "30d Supply-side Revenue (USD)", id: "supplySideRevenue" },
  { column: "30d Aggregator Volume (USD)", id: "aggregatorVolume" },
  { column: "30d Bridge Aggregator Volume (USD)", id: "bridgeAggregatorVolume" },
  { column: "Stablecoin Supply on NEAR (USD)", id: "stablecoinSupply" },
  { column: "Stablecoin Supply on Aurora (USD)", id: "stablecoinSupply" },
  { column: "Token Holders on NEAR", id: "tokenHolders" },
  { column: "Token Holders on Aurora", id: "tokenHoldersAurora" },
  { column: "Token Supply x Price on NEAR (USD)", id: "tokenSupplyValue" },
];

export interface SeedRow {
  name: string;
  asOf: string;
  values: Partial<Record<MetricId, number>>;
}

function num(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const t = raw.trim().replace(/[$,]/g, "");
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/** One row of the snapshot CSV → the metrics it carries. Blank cells are absent, never zero. */
export function parseSeedRow(row: Record<string, string>): SeedRow | null {
  const name = (row["Project/Company Name"] ?? "").trim();
  const asOf = (row["As Of"] ?? "").trim().slice(0, 10);
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return null;
  const values: Partial<Record<MetricId, number>> = {};
  for (const { column, id } of SEED_COLUMNS) {
    const v = num(row[column]);
    if (v === null) continue;
    values[id] = (values[id] ?? 0) + v;
  }
  return { name, asOf, values };
}

export type LivePart = { values: Partial<Record<MetricId, number>>; asOf: string };

/**
 * Live values first, then snapshot values for metrics no live source covered, each with its own date. Several
 * live sources can each add metrics, each with the day it was read. Total deposited is recomputed from live
 * TVL plus live borrowed when both exist, so it never mixes days.
 */
export function mergeExtra(lives: LivePart | LivePart[] | null, seed: SeedRow | null, tvl: number | null): ProjectExtra | undefined {
  const parts = lives === null ? [] : Array.isArray(lives) ? lives : [lives];
  const out: ProjectExtra = { values: {}, asOf: {}, from: {} };
  if (seed) {
    for (const [id, v] of Object.entries(seed.values) as Array<[MetricId, number]>) {
      out.values[id] = v;
      out.asOf[id] = seed.asOf;
      out.from[id] = "snapshot";
    }
  }
  for (const live of parts) {
    for (const [id, v] of Object.entries(live.values) as Array<[MetricId, number]>) {
      out.values[id] = v;
      out.asOf[id] = live.asOf;
      out.from[id] = "live";
    }
    const borrowed = live.values.borrowed;
    if (borrowed !== undefined && tvl !== null) {
      out.values.totalDeposited = tvl + borrowed;
      out.asOf.totalDeposited = live.asOf;
      out.from.totalDeposited = "live";
    }
  }
  return Object.keys(out.values).length ? out : undefined;
}
