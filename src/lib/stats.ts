/**
 * Pure statistics for the thesis page: weekly resampling, growth rates, Pearson correlation,
 * lead-lag cross-correlation, an out-of-sample forecasting check and robustness variants.
 * No I/O, no hardcoded data; everything is computed from the series passed in.
 */
import { weekStart, type DateStr } from "./dates";
import type { Series } from "./history-types";

export type Kind = "flow" | "stock";

/** Resample a daily series to ISO weeks (Monday start): flows are summed, stocks take the last value. Partial trailing week dropped. */
export function toWeekly(series: Series, kind: Kind, lastCompleteDay: DateStr): Series {
  const buckets = new Map<DateStr, { sum: number; last: number; days: number }>();
  for (const [d, v] of series) {
    if (d > lastCompleteDay) continue;
    const w = weekStart(d);
    const b = buckets.get(w) ?? { sum: 0, last: v, days: 0 };
    b.sum += v;
    b.last = v;
    b.days += 1;
    buckets.set(w, b);
  }
  const lastWeek = weekStart(lastCompleteDay);
  const out: Series = [];
  for (const [w, b] of Array.from(buckets.entries()).sort((a, c) => (a[0] < c[0] ? -1 : 1))) {
    if (w === lastWeek && b.days < 7) continue; // incomplete week
    if (kind === "flow" && b.days < 4) continue; // too sparse to compare
    out.push([w, kind === "flow" ? b.sum : b.last]);
  }
  return out;
}

/** Log growth between consecutive points; points with a non-positive value are skipped. */
export function logChanges(series: Series): Series {
  const out: Series = [];
  for (let i = 1; i < series.length; i++) {
    const [d, v] = series[i];
    const prev = series[i - 1][1];
    if (v > 0 && prev > 0) out.push([d, Math.log(v / prev)]);
  }
  return out;
}

/** Inner join two series on date. */
export function alignPairs(a: Series, b: Series): Array<[DateStr, number, number]> {
  const m = new Map(b);
  const out: Array<[DateStr, number, number]> = [];
  for (const [d, v] of a) {
    const w = m.get(d);
    if (w !== undefined) out.push([d, v, w]);
  }
  return out;
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export interface LagPoint {
  lag: number;
  r: number | null;
  n: number;
}

/**
 * Cross-correlation of x against y at lags −maxLag…+maxLag on a shared date axis.
 * A positive lag k means x at time t is compared with y at time t+k: x leads y by k periods.
 */
export function crossCorrelation(x: Series, y: Series, maxLag: number): LagPoint[] {
  const pairs = alignPairs(x, y);
  const xs = pairs.map((p) => p[1]);
  const ys = pairs.map((p) => p[2]);
  const out: LagPoint[] = [];
  for (let k = -maxLag; k <= maxLag; k++) {
    const a: number[] = [];
    const b: number[] = [];
    for (let t = 0; t < xs.length; t++) {
      const u = t + k;
      if (u < 0 || u >= ys.length) continue;
      a.push(xs[t]);
      b.push(ys[u]);
    }
    out.push({ lag: k, r: pearson(a, b), n: a.length });
  }
  return out;
}

export interface LeadLagSummary {
  points: LagPoint[];
  r0: number | null;
  /** Strongest correlation (by absolute value) among positive lags (x leading y). */
  bestLead: LagPoint | null;
  /** Strongest positive correlation among positive lags: x up now, y up later. Null when no positive lag correlates positively. */
  bestPositiveLead: LagPoint | null;
  /** Strongest correlation among negative lags (y leading x). */
  bestLagging: LagPoint | null;
  /** Approximate 95% noise band: 2/sqrt(n) at lag 0. */
  noiseBand: number | null;
  n: number;
}

export function leadLag(x: Series, y: Series, maxLag: number): LeadLagSummary {
  const points = crossCorrelation(x, y, maxLag);
  const at0 = points.find((p) => p.lag === 0) ?? null;
  const pick = (ps: LagPoint[]) => ps.filter((p) => p.r !== null).sort((a, b) => Math.abs(b.r as number) - Math.abs(a.r as number))[0] ?? null;
  const positive = points.filter((p) => p.lag > 0 && p.r !== null && (p.r as number) > 0).sort((a, b) => (b.r as number) - (a.r as number))[0] ?? null;
  return {
    points,
    r0: at0?.r ?? null,
    bestLead: pick(points.filter((p) => p.lag > 0)),
    bestPositiveLead: positive,
    bestLagging: pick(points.filter((p) => p.lag < 0)),
    noiseBand: at0 && at0.n > 0 ? 2 / Math.sqrt(at0.n) : null,
    n: at0?.n ?? 0,
  };
}

export interface OlsFit {
  a: number;
  b: number;
  n: number;
  r2: number;
}

export function ols(xs: number[], ys: number[]): OlsFit | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 4) return null;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0) return null;
  const b = sxy / sxx;
  const a = my - b * mx;
  const r2 = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  return { a, b, n, r2 };
}

export interface OosResult {
  lag: number;
  train: OlsFit | null;
  testN: number;
  /** Out-of-sample R²: 1 − SSE(model) / SSE(train-mean forecast). Negative means worse than the naive mean. */
  r2Oos: number | null;
  /** Share of test periods where the sign of the forecast matched the sign of the realised change. */
  hitRate: number | null;
  mae: number | null;
  naiveMae: number | null;
}

/**
 * Fit y_t = a + b·x_{t−lag} on dates before `cutoff`, evaluate on dates at or after it.
 * `lag` is in periods of the series (weeks for weekly data). The lag is chosen on the training
 * window only (highest |correlation| among 1…maxLag) unless `fixedLag` is given.
 */
export function outOfSample(x: Series, y: Series, cutoff: DateStr, maxLag: number, fixedLag?: number): OosResult {
  const pairs = alignPairs(x, y);
  const dates = pairs.map((p) => p[0]);
  const xs = pairs.map((p) => p[1]);
  const ys = pairs.map((p) => p[2]);
  const trainIdx = dates.map((d, i) => (d < cutoff ? i : -1)).filter((i) => i >= 0);
  const testIdx = dates.map((d, i) => (d >= cutoff ? i : -1)).filter((i) => i >= 0);
  const build = (idx: number[], lag: number) => {
    const a: number[] = [];
    const b: number[] = [];
    for (const t of idx) if (t - lag >= 0) {
      a.push(xs[t - lag]);
      b.push(ys[t]);
    }
    return { a, b };
  };
  let lag = fixedLag ?? 1;
  if (fixedLag === undefined) {
    let best = -1;
    for (let k = 1; k <= maxLag; k++) {
      const { a, b } = build(trainIdx, k);
      const r = Math.abs(pearson(a, b) ?? 0);
      if (r > best) {
        best = r;
        lag = k;
      }
    }
  }
  const tr = build(trainIdx, lag);
  const fit = ols(tr.a, tr.b);
  const te = build(testIdx, lag);
  if (!fit || te.b.length < 3) return { lag, train: fit, testN: te.b.length, r2Oos: null, hitRate: null, mae: null, naiveMae: null };
  const naive = mean(tr.b);
  let sse = 0;
  let sst = 0;
  let hits = 0;
  let mae = 0;
  let naiveMae = 0;
  for (let i = 0; i < te.b.length; i++) {
    const pred = fit.a + fit.b * te.a[i];
    sse += (te.b[i] - pred) ** 2;
    sst += (te.b[i] - naive) ** 2;
    if (Math.sign(pred) === Math.sign(te.b[i])) hits += 1;
    mae += Math.abs(te.b[i] - pred);
    naiveMae += Math.abs(te.b[i] - naive);
  }
  return { lag, train: fit, testN: te.b.length, r2Oos: sst === 0 ? null : 1 - sse / sst, hitRate: hits / te.b.length, mae: mae / te.b.length, naiveMae: naiveMae / te.b.length };
}

/** Cap the largest values of a daily flow at the given quantile (for the "without the biggest days" robustness variant). */
export function trimTop(series: Series, quantile = 0.95): { series: Series; cap: number; trimmed: number } {
  const vals = series.map(([, v]) => v).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!vals.length) return { series, cap: 0, trimmed: 0 };
  const cap = vals[Math.min(vals.length - 1, Math.floor(quantile * (vals.length - 1)))];
  let trimmed = 0;
  const out: Series = series.map(([d, v]) => {
    if (v > cap) {
      trimmed += 1;
      return [d, cap];
    }
    return [d, v];
  });
  return { series: out, cap, trimmed };
}

/** Element-wise subtraction on a shared date axis (e.g. function calls minus receipts to aurora and intents.near). */
export function subtractSeries(a: Series, ...others: Series[]): Series {
  const maps = others.map((s) => new Map(s));
  return a.map(([d, v]) => [d, Math.max(0, v - maps.reduce((acc, m) => acc + (m.get(d) ?? 0), 0))] as [DateStr, number]);
}

/** Index a series to 100 at its first positive point. */
export function indexTo100(series: Series): Series {
  const base = series.find(([, v]) => v > 0)?.[1];
  if (!base) return [];
  return series.map(([d, v]) => [d, (v / base) * 100] as [DateStr, number]);
}

/** Rolling mean over the previous n points (inclusive), null-free; shorter at the start. */
export function rollingMean(series: Series, n: number): Series {
  const out: Series = [];
  let acc = 0;
  const q: number[] = [];
  for (const [d, v] of series) {
    q.push(v);
    acc += v;
    if (q.length > n) acc -= q.shift() as number;
    out.push([d, acc / q.length]);
  }
  return out;
}
