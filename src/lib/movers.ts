import { changeKey, type Range } from "./ranges";
import type { MetricKey, NumericMetricKey, Project } from "./types";

export const MIN_SIZES = ["any", "100k", "1m", "10m"] as const;
export type MinSize = (typeof MIN_SIZES)[number];

export const MIN_SIZE_LABEL: Record<MinSize, string> = {
  any: "Any size",
  "100k": "TVL ≥ $100K or fees ≥ $5K",
  "1m": "TVL ≥ $1M or fees ≥ $50K",
  "10m": "TVL ≥ $10M or fees ≥ $500K",
};

const MIN_SIZE_RULE: Record<MinSize, { tvl: number; fees: number }> = {
  any: { tvl: 0, fees: 0 },
  "100k": { tvl: 100_000, fees: 5_000 },
  "1m": { tvl: 1_000_000, fees: 50_000 },
  "10m": { tvl: 10_000_000, fees: 500_000 },
};

export function passesMinSize(p: Project, size: MinSize): boolean {
  if (size === "any") return true;
  const r = MIN_SIZE_RULE[size];
  return (p.tvl ?? 0) >= r.tvl || (p.fees ?? 0) >= r.fees;
}

/** The value at the start of the window must also be meaningful, or a $500 base shows as +380,000%. */
export function priorFloor(metric: NumericMetricKey, size: MinSize): number {
  const r = MIN_SIZE_RULE[size];
  const base = metric === "tvl" || metric === "volume" ? r.tvl : r.fees;
  return Math.max(1000, base / 10);
}

export interface Mover {
  project: Project;
  change: number;
  value: number;
}

export interface Movers {
  metric: NumericMetricKey;
  window: ReturnType<typeof changeKey>;
  risers: Mover[];
  fallers: Mover[];
  eligible: number;
}

export function movers(projects: Project[], metric: MetricKey, range: Range, size: MinSize, limit = 5): Movers {
  const m: NumericMetricKey = metric === "count" ? "tvl" : metric;
  const key = changeKey(range);
  const rows: Mover[] = [];
  for (const p of projects) {
    if (!p.live || !passesMinSize(p, size)) continue;
    const change = p.live.change[m][key];
    const value = p[m];
    if (change === null || value === null || value <= 0) continue;
    const prior = value / (1 + change);
    if (prior < priorFloor(m, size)) continue;
    rows.push({ project: p, change, value });
  }
  const sorted = [...rows].sort((a, b) => b.change - a.change);
  return {
    metric: m,
    window: key,
    risers: sorted.filter((r) => r.change > 0).slice(0, limit),
    fallers: sorted.filter((r) => r.change < 0).reverse().slice(0, limit),
    eligible: rows.length,
  };
}
