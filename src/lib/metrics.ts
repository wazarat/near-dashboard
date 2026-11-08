import type { MetricKey, NativeChain, NumericMetricKey, Project } from "./types";
import { NATIVE_CHAINS } from "./types";

export const NUMERIC_METRICS: NumericMetricKey[] = ["tvl", "volume", "fees", "revenue"];

/** Value of a metric for one project. "count" is 1 per project. Blank stays null. */
export function metricValue(p: Project, metric: MetricKey): number | null {
  if (metric === "count") return 1;
  return p[metric];
}

/** Sum ignoring nulls. Returns null when no project had a value. */
export function sumMetric(projects: Project[], metric: MetricKey): number | null {
  let total = 0;
  let seen = false;
  for (const p of projects) {
    const v = metricValue(p, metric);
    if (v !== null) {
      total += v;
      seen = true;
    }
  }
  return seen ? total : null;
}

export function countWith(projects: Project[], metric: NumericMetricKey): number {
  return projects.filter((p) => p[metric] !== null).length;
}

export interface GroupTotal<K extends string = string> {
  key: K;
  value: number;
  count: number;
  withData: number;
}

export function groupBy<K extends string>(projects: Project[], keyOf: (p: Project) => K, metric: MetricKey): GroupTotal<K>[] {
  const map = new Map<K, GroupTotal<K>>();
  for (const p of projects) {
    const k = keyOf(p);
    const g = map.get(k) ?? { key: k, value: 0, count: 0, withData: 0 };
    g.count += 1;
    const v = metricValue(p, metric);
    if (v !== null) {
      g.value += v;
      g.withData += 1;
    }
    map.set(k, g);
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

export function bySector(projects: Project[], metric: MetricKey) {
  return groupBy(projects, (p) => p.sector, metric);
}

export function byChain(projects: Project[], metric: MetricKey) {
  return groupBy(projects, (p) => p.chain, metric);
}

/** Share of each native chain for one metric, in NATIVE_CHAINS order. */
export function chainShares(projects: Project[], metric: MetricKey): Record<NativeChain, number> {
  const totals = byChain(projects, metric);
  const total = totals.reduce((a, g) => a + g.value, 0);
  const out = {} as Record<NativeChain, number>;
  for (const c of NATIVE_CHAINS) {
    const g = totals.find((t) => t.key === c);
    out[c] = total > 0 && g ? g.value / total : 0;
  }
  return out;
}

/** Share held by NEAR-native projects. */
export function nativeShare(projects: Project[], metric: MetricKey): number | null {
  const total = sumMetric(projects, metric);
  if (total === null || total === 0) return null;
  const native = sumMetric(projects.filter((p) => p.chain === "NEAR native"), metric) ?? 0;
  return native / total;
}

export interface ConcentrationPoint {
  rank: number;
  name: string;
  id: string;
  value: number;
  cumulative: number;
  share: number;
}

export function concentration(projects: Project[], metric: NumericMetricKey): ConcentrationPoint[] {
  const ranked = projects
    .filter((p) => p[metric] !== null && (p[metric] as number) > 0)
    .sort((a, b) => (b[metric] as number) - (a[metric] as number));
  const total = ranked.reduce((a, p) => a + (p[metric] as number), 0);
  let cum = 0;
  return ranked.map((p, i) => {
    const v = p[metric] as number;
    cum += v;
    return { rank: i + 1, name: p.name, id: p.id, value: v, cumulative: cum, share: total > 0 ? cum / total : 0 };
  });
}

export function topNShare(points: ConcentrationPoint[], n: number): number | null {
  if (points.length === 0) return null;
  const idx = Math.min(n, points.length) - 1;
  return points[idx].share;
}

export function topN(projects: Project[], metric: MetricKey, n: number): Project[] {
  return projects
    .filter((p) => metricValue(p, metric) !== null)
    .sort((a, b) => (metricValue(b, metric) ?? 0) - (metricValue(a, metric) ?? 0))
    .slice(0, n);
}

/** Same sector, nearest by metric (falls back to same sector with traction first). */
export function similarProjects(all: Project[], target: Project, metric: MetricKey, n = 5): Project[] {
  const peers = all.filter((p) => p.sector === target.sector && p.id !== target.id);
  const tv = metric === "count" ? null : target[metric];
  if (tv === null) {
    return peers.sort((a, b) => Number(b.hasTraction) - Number(a.hasTraction) || a.tier.localeCompare(b.tier)).slice(0, n);
  }
  const key = metric as NumericMetricKey;
  return peers
    .filter((p) => p[key] !== null)
    .sort((a, b) => Math.abs(Math.log((a[key] as number) + 1) - Math.log(tv + 1)) - Math.abs(Math.log((b[key] as number) + 1) - Math.log(tv + 1)))
    .slice(0, n);
}
