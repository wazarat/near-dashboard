/**
 * Statistical tests for the thesis page, all pure and deterministic (a seeded generator, no I/O):
 * a moving-block bootstrap for the best positive-lag correlation, Benjamini-Hochberg, a nested out-of-sample
 * comparison with the Clark-West statistic, Granger F-tests, an OLS trend slope with a 90% interval, and the
 * concentration and share measures the related tests use. Every pre-registered pass or fail rule is a function here.
 */
import type { DateStr } from "./dates";
import type { Series } from "./history-types";
import { alignPairs, mean, pearson } from "./stats";

export const BOOT_SEED = 20261114;
export const BOOT_RESAMPLES = 2000;
export const BOOT_BLOCK = 4;
export const BH_Q = 0.1;
export const SIG_P = 0.1;

/** mulberry32: a small seeded generator, so every resample is the same on every machine. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Indices 0..n-1 resampled in moving blocks of `block` consecutive positions, cut to length n. */
export function blockIndices(n: number, block: number, rand: () => number): number[] {
  const out: number[] = [];
  const starts = Math.max(1, n - block + 1);
  while (out.length < n) {
    const s = Math.floor(rand() * starts);
    for (let j = 0; j < block && out.length < n; j++) out.push(Math.min(n - 1, s + j));
  }
  return out;
}

/**
 * Rows t where x_t and y_{t+1..t+maxLag} all exist on the shared weekly axis: column 0 is x_t, column k is y_{t+k}.
 * Resampling whole rows keeps every lag pair intact, so the lag search can run inside each resample.
 */
export function lagMatrix(x: Series, y: Series, maxLag: number): { xs: number[]; ys: number[][] } {
  const pairs = alignPairs(x, y);
  const xs: number[] = [];
  const ys: number[][] = [];
  for (let t = 0; t + maxLag < pairs.length; t++) {
    xs.push(pairs[t][1]);
    const row: number[] = [];
    for (let k = 1; k <= maxLag; k++) row.push(pairs[t + k][2]);
    ys.push(row);
  }
  return { xs, ys };
}

/** Best positive-lag correlation over lags 1..maxLag on the given row indices (x rows and y rows may differ). */
export function bestLagR(xs: number[], ys: number[][], xi: number[], yi: number[]): { lag: number; r: number } {
  const maxLag = ys[0]?.length ?? 0;
  let best = { lag: 0, r: -Infinity };
  const a = xi.map((i) => xs[i]);
  for (let k = 0; k < maxLag; k++) {
    const r = pearson(a, yi.map((i) => ys[i][k]));
    if (r !== null && r > best.r) best = { lag: k + 1, r };
  }
  return best;
}

export interface BootResult {
  lag: number;
  r: number | null;
  /** One-sided p-value of the best positive-lag correlation, with the lag search repeated in every resample. */
  p: number | null;
  /** 90% percentile interval of the correlation at the chosen lag, from paired block resamples. */
  ciLow: number | null;
  ciHigh: number | null;
  n: number;
}

/**
 * Moving-block bootstrap for the best positive-lag correlation of x leading y.
 * Null: rows of x and rows of the lagged y are block-resampled independently (each keeps its own autocorrelation,
 * the link between them is broken), and the best lag is searched again each time, so the p-value pays for the search.
 * Interval: rows are block-resampled together and the correlation at the observed best lag is recomputed. The maximum over
 * lags is biased upward in every resample, so an interval of the maximum would sit above the estimate; this one does not.
 */
export function blockBootstrapLead(x: Series, y: Series, maxLag: number, opts: { resamples?: number; block?: number; seed?: number } = {}): BootResult {
  const B = opts.resamples ?? BOOT_RESAMPLES;
  const block = opts.block ?? BOOT_BLOCK;
  const rand = rng(opts.seed ?? BOOT_SEED);
  const { xs, ys } = lagMatrix(x, y, maxLag);
  const n = xs.length;
  if (n < 12) return { lag: 0, r: null, p: null, ciLow: null, ciHigh: null, n };
  const id = xs.map((_, i) => i);
  const obs = bestLagR(xs, ys, id, id);
  let exceed = 0;
  const paired: number[] = [];
  for (let b = 0; b < B; b++) {
    const nullR = bestLagR(xs, ys, blockIndices(n, block, rand), blockIndices(n, block, rand)).r;
    if (nullR >= obs.r) exceed += 1;
    const idx = blockIndices(n, block, rand);
    paired.push(pearson(idx.map((i) => xs[i]), idx.map((i) => ys[i][obs.lag - 1])) ?? 0);
  }
  paired.sort((a, b) => a - b);
  const q = (p: number) => paired[Math.min(B - 1, Math.max(0, Math.floor(p * (B - 1))))];
  return { lag: obs.lag, r: obs.r, p: (exceed + 1) / (B + 1), ciLow: q(0.05), ciHigh: q(0.95), n };
}

/** Benjamini-Hochberg: which of the p-values are significant at false discovery rate q, and the adjusted p-values. */
export function benjaminiHochberg(ps: Array<number | null>, q = BH_Q): { significant: boolean[]; adjusted: Array<number | null> } {
  const idx = ps.map((p, i) => [p, i] as const).filter((e): e is readonly [number, number] => e[0] !== null).sort((a, b) => a[0] - b[0]);
  const m = idx.length;
  const significant = ps.map(() => false);
  const adjusted: Array<number | null> = ps.map(() => null);
  let kMax = -1;
  idx.forEach(([p], k) => {
    if (p <= ((k + 1) / m) * q) kMax = k;
  });
  for (let k = 0; k <= kMax; k++) significant[idx[k][1]] = true;
  let running = 1;
  for (let k = m - 1; k >= 0; k--) {
    running = Math.min(running, (idx[k][0] * m) / (k + 1));
    adjusted[idx[k][1]] = Math.min(1, running);
  }
  return { significant, adjusted };
}

/** Least squares with an intercept: X is rows of regressors (no constant column). Returns coefficients [const, ...] or null. */
export function olsMulti(X: number[][], y: number[]): { beta: number[]; rss: number } | null {
  const n = y.length;
  const p = (X[0]?.length ?? 0) + 1;
  if (n <= p) return null;
  const A = Array.from({ length: p }, () => new Array<number>(p + 1).fill(0));
  for (let i = 0; i < n; i++) {
    const row = [1, ...X[i]];
    for (let a = 0; a < p; a++) {
      for (let b = 0; b < p; b++) A[a][b] += row[a] * row[b];
      A[a][p] += row[a] * y[i];
    }
  }
  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-12) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < p; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= p; k++) A[r][k] -= f * A[c][k];
    }
  }
  const beta = A.map((row, i) => row[p] / row[i]);
  let rss = 0;
  for (let i = 0; i < n; i++) {
    const pred = beta[0] + X[i].reduce((s, v, j) => s + v * beta[j + 1], 0);
    rss += (y[i] - pred) ** 2;
  }
  return { beta, rss };
}

export function predict(beta: number[], row: number[]): number {
  return beta[0] + row.reduce((s, v, j) => s + v * beta[j + 1], 0);
}

// ---- distributions ----

function lgamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp0 = x + 5.5;
  const tmp = tmp0 - (x + 0.5) * Math.log(tmp0);
  let ser = 1.000000000190015;
  for (const v of c) ser += v / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b). */
export function incBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Upper tail P(F > f) of the F distribution with d1, d2 degrees of freedom. */
export function fTail(f: number, d1: number, d2: number): number {
  if (!(f > 0)) return 1;
  return incBeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2);
}

/** Two-sided P(|T| > t) for Student's t with df degrees of freedom. */
export function tTwoSided(t: number, df: number): number {
  return incBeta(df / (df + t * t), df / 2, 0.5);
}

/** Critical value c with P(|T| > c) = alpha, by bisection. */
export function tCritical(alpha: number, df: number): number {
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (tTwoSided(mid, df) > alpha) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Standard normal CDF (Abramowitz and Stegun 7.1.26, error below 1.5e-7). */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

// ---- nested out-of-sample comparison ----

export interface ClarkWestResult {
  priceLag: number;
  intentsLag: number;
  trainN: number;
  testN: number;
  mse1: number | null;
  mse2: number | null;
  cw: number | null;
  p: number | null;
  /** Model 2 lowers test MSE and Clark-West p < 0.10. */
  pass: boolean;
}

/** Lag in 1..maxLag with the highest absolute correlation of x_{t-k} with y_t over the given target indices. */
function pickLag(xs: number[], ys: number[], idx: number[], maxLag: number): number {
  let lag = 1;
  let best = -1;
  for (let k = 1; k <= maxLag; k++) {
    const a: number[] = [];
    const b: number[] = [];
    for (const t of idx) if (t - k >= 0) {
      a.push(xs[t - k]);
      b.push(ys[t]);
    }
    const r = Math.abs(pearson(a, b) ?? 0);
    if (r > best) {
      best = r;
      lag = k;
    }
  }
  return lag;
}

/**
 * Model 1: y_t on price_{t-Lp}. Model 2: adds intents_{t-Li}. Both lags are picked on the training weeks only.
 * Clark and West (2007): f_t = e1² − (e2² − (ŷ1 − ŷ2)²); the statistic is mean(f) / se(f), one-sided against the normal.
 */
export function clarkWest(intents: Series, price: Series, y: Series, cutoff: DateStr, maxLag: number): ClarkWestResult {
  const pm = new Map(price);
  const im = new Map(intents);
  const rows = y.filter(([d]) => pm.has(d) && im.has(d));
  const dates = rows.map(([d]) => d);
  const ys = rows.map(([, v]) => v);
  const ps = dates.map((d) => pm.get(d) as number);
  const is = dates.map((d) => im.get(d) as number);
  const trainIdx = dates.map((d, i) => (d < cutoff ? i : -1)).filter((i) => i >= maxLag);
  const testIdx = dates.map((d, i) => (d >= cutoff ? i : -1)).filter((i) => i >= maxLag);
  const priceLag = pickLag(ps, ys, trainIdx, maxLag);
  const intentsLag = pickLag(is, ys, trainIdx, maxLag);
  const empty = { priceLag, intentsLag, trainN: trainIdx.length, testN: testIdx.length, mse1: null, mse2: null, cw: null, p: null, pass: false };
  const m1 = olsMulti(trainIdx.map((t) => [ps[t - priceLag]]), trainIdx.map((t) => ys[t]));
  const m2 = olsMulti(trainIdx.map((t) => [ps[t - priceLag], is[t - intentsLag]]), trainIdx.map((t) => ys[t]));
  if (!m1 || !m2 || testIdx.length < 5) return empty;
  const f: number[] = [];
  let s1 = 0;
  let s2 = 0;
  for (const t of testIdx) {
    const y1 = predict(m1.beta, [ps[t - priceLag]]);
    const y2 = predict(m2.beta, [ps[t - priceLag], is[t - intentsLag]]);
    const e1 = ys[t] - y1;
    const e2 = ys[t] - y2;
    s1 += e1 * e1;
    s2 += e2 * e2;
    f.push(e1 * e1 - (e2 * e2 - (y1 - y2) ** 2));
  }
  const n = f.length;
  const fm = mean(f);
  const sd = Math.sqrt(f.reduce((a, v) => a + (v - fm) ** 2, 0) / (n - 1));
  const cw = sd > 0 ? fm / (sd / Math.sqrt(n)) : null;
  const p = cw === null ? null : 1 - normCdf(cw);
  const mse1 = s1 / n;
  const mse2 = s2 / n;
  return { priceLag, intentsLag, trainN: trainIdx.length, testN: n, mse1, mse2, cw, p, pass: mse2 < mse1 && p !== null && p < SIG_P };
}

// ---- Granger ----

export interface GrangerResult {
  /** p-value of the F-test at lags 1..4, index 0 is lag 1. */
  pByLag: Array<number | null>;
  /** Smallest p across the lags times the number of lags tested (Bonferroni), capped at 1. */
  pMin: number | null;
  significant: boolean;
}

/** Does x help predict y beyond y's own past? F-test of x lags 1..p added to y lags 1..p, for p = 1..maxLag. */
export function granger(x: Series, y: Series, maxLag = 4): GrangerResult {
  const pairs = alignPairs(x, y);
  const xs = pairs.map((p) => p[1]);
  const ys = pairs.map((p) => p[2]);
  const pByLag: Array<number | null> = [];
  for (let p = 1; p <= maxLag; p++) {
    const R: number[][] = [];
    const U: number[][] = [];
    const tgt: number[] = [];
    for (let t = p; t < ys.length; t++) {
      const own = Array.from({ length: p }, (_, j) => ys[t - 1 - j]);
      const other = Array.from({ length: p }, (_, j) => xs[t - 1 - j]);
      R.push(own);
      U.push([...own, ...other]);
      tgt.push(ys[t]);
    }
    const r = olsMulti(R, tgt);
    const u = olsMulti(U, tgt);
    const df2 = tgt.length - 2 * p - 1;
    if (!r || !u || df2 < 5 || u.rss <= 0) {
      pByLag.push(null);
      continue;
    }
    const F = (r.rss - u.rss) / p / (u.rss / df2);
    pByLag.push(fTail(F, p, df2));
  }
  const valid = pByLag.filter((v): v is number => v !== null);
  const pMin = valid.length ? Math.min(1, Math.min(...valid) * valid.length) : null;
  return { pByLag, pMin, significant: pMin !== null && pMin < SIG_P };
}

// ---- trends, shares, concentration ----

export interface TrendResult {
  /** Slope per period (month or week) of an OLS fit on the period index. */
  slope: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  n: number;
}

/** OLS slope of the values on 0..n-1 with a two-sided 90% t interval. */
export function trend(values: number[]): TrendResult {
  const n = values.length;
  if (n < 4) return { slope: null, ciLow: null, ciHigh: null, n };
  const xs = values.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(values);
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    sxy += (xs[i] - mx) * (values[i] - my);
  }
  const b = sxy / sxx;
  const a = my - b * mx;
  const rss = values.reduce((s, v, i) => s + (v - a - b * i) ** 2, 0);
  const se = Math.sqrt(rss / (n - 2) / sxx);
  const c = tCritical(0.1, n - 2);
  return { slope: b, ciLow: b - c * se, ciHigh: b + c * se, n };
}

/** Herfindahl-Hirschman index of shares, on the 0 to 10,000 scale. */
export function hhi(values: number[]): number | null {
  const total = values.reduce((a, v) => a + Math.max(0, v), 0);
  if (total <= 0) return null;
  return values.reduce((a, v) => a + (Math.max(0, v) / total) ** 2, 0) * 10_000;
}

/** Share of the k largest values in the total. */
export function topShare(values: number[], k: number): number | null {
  const total = values.reduce((a, v) => a + Math.max(0, v), 0);
  if (total <= 0) return null;
  return [...values].sort((a, b) => b - a).slice(0, k).reduce((a, v) => a + Math.max(0, v), 0) / total;
}

/** Calendar month of a date, "YYYY-MM". */
export function monthOf(d: DateStr): string {
  return d.slice(0, 7);
}

/** Group daily [date, value] into calendar-month sums, keeping only months with at least `minDays` days. */
export function monthlySum(series: Series, minDays = 25): Array<[string, number]> {
  const m = new Map<string, { sum: number; days: number }>();
  for (const [d, v] of series) {
    const k = monthOf(d);
    const e = m.get(k) ?? { sum: 0, days: 0 };
    e.sum += v;
    e.days += 1;
    m.set(k, e);
  }
  return Array.from(m.entries()).filter(([, e]) => e.days >= minDays).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, e]) => [k, e.sum]);
}

// ---- pre-registered rules ----

export type TestStatus = "pass" | "fail" | "inconclusive" | "not computed";

/** A2: Model 2 lowers test MSE with Clark-West p < 0.10 for at least two series. */
export function ruleA2(results: ClarkWestResult[]): boolean {
  return results.filter((r) => r.pass).length >= 2;
}

/** A4: "supported" needs BH significance for Intents on three or more series, one of them chain-level, and A2 passing. */
export function ruleA4(sigLevels: Array<"chain" | "contract">, a2Pass: boolean): boolean {
  return sigLevels.length >= 3 && sigLevels.includes("chain") && a2Pass;
}

/** B1 pass: Intents leads the excluding-top-10 series significantly, or clearly better (r at least 0.10 higher) than total transactions. Fail: no positive lead on either. */
export function ruleB1(ex: { r: number | null; significant: boolean }, top: { r: number | null }, total: { r: number | null }): TestStatus {
  const exR = ex.r ?? 0;
  if (ex.significant || (ex.r !== null && ex.r > 0 && exR >= (total.r ?? 0) + 0.1)) return "pass";
  if ((ex.r ?? 0) <= 0 && (top.r ?? 0) <= 0) return "fail";
  return "inconclusive";
}

/** B2 pass: positive trend with the slope's 90% interval above zero. Fail: flat or falling, or below 20% in each of the last three months. */
export function ruleB2(t: TrendResult, monthly: number[]): TestStatus {
  if (t.slope === null) return "not computed";
  const last3 = monthly.slice(-3);
  if (last3.length === 3 && last3.every((v) => v < 0.2)) return "fail";
  if ((t.ciLow ?? 0) > 0) return "pass";
  return "fail";
}

/** B3 pass: L1 gas share falls with a negative 90% interval while the Intents layers' share rises. Fail otherwise. */
export function ruleB3(gas: TrendResult, intentsLayers: TrendResult): TestStatus {
  if (gas.slope === null || intentsLayers.slope === null) return "not computed";
  return (gas.ciHigh ?? 0) < 0 && (intentsLayers.slope ?? 0) > 0 ? "pass" : "fail";
}

/** B4 pass: HHI trends down and top-1 share under 40% in each of the last three months. Fail: HHI trends up or top-1 over 40%. */
export function ruleB4(h: TrendResult, top1: number[]): TestStatus {
  if (h.slope === null) return "not computed";
  const last3 = top1.slice(-3);
  if ((h.slope ?? 0) > 0 || last3.some((v) => v > 0.4)) return "fail";
  return (h.slope ?? 0) < 0 && last3.length === 3 && last3.every((v) => v < 0.4) ? "pass" : "fail";
}

/** B5 pass: the non-group share has a positive trend with the 90% interval above zero. Fail: flat or falling. */
export function ruleB5(t: TrendResult): TestStatus {
  if (t.slope === null) return "not computed";
  return (t.ciLow ?? 0) > 0 ? "pass" : "fail";
}
