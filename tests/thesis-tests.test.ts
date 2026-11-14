import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/history-types";
import {
  benjaminiHochberg,
  bestLagR,
  blockBootstrapLead,
  blockIndices,
  clarkWest,
  fTail,
  granger,
  hhi,
  lagMatrix,
  monthlySum,
  normCdf,
  olsMulti,
  rng,
  ruleA2,
  ruleA4,
  ruleB1,
  ruleB2,
  ruleB3,
  ruleB4,
  ruleB5,
  tCritical,
  topShare,
  trend,
  type ClarkWestResult,
} from "@/lib/thesis-tests";
import { addDays, type DateStr } from "@/lib/dates";

/** Weekly dates from a Monday. */
function weeks(n: number, start: DateStr = "2025-01-06"): DateStr[] {
  return Array.from({ length: n }, (_, i) => addDays(start, 7 * i));
}

function noise(n: number, seed: number): number[] {
  const r = rng(seed);
  return Array.from({ length: n }, () => r() - 0.5);
}

/** x leads y by `lag`: y_t = x_{t-lag} + small noise. */
function leading(n: number, lag: number, seed = 1): { x: Series; y: Series } {
  const d = weeks(n);
  const xv = noise(n, seed);
  const e = noise(n, seed + 7);
  const x: Series = d.map((dd, i) => [dd, xv[i]]);
  const y: Series = d.map((dd, i) => [dd, (i >= lag ? xv[i - lag] : 0) + 0.2 * e[i]]);
  return { x, y };
}

describe("seeded generator and block indices", () => {
  it("is reproducible", () => {
    const a = rng(5);
    const b = rng(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("draws runs of consecutive indices of the block length", () => {
    const idx = blockIndices(20, 4, rng(3));
    expect(idx).toHaveLength(20);
    for (let i = 0; i < 20; i += 4) for (let j = 1; j < 4; j++) expect(idx[i + j]).toBe(idx[i] + j);
  });
});

describe("block bootstrap of the best positive lag", () => {
  it("keeps every lag pair in one row so the lag search can run inside each resample", () => {
    const { x, y } = leading(30, 2);
    const { xs, ys } = lagMatrix(x, y, 8);
    expect(xs).toHaveLength(22);
    expect(ys[0]).toHaveLength(8);
    // Column k-1 holds y_{t+k}: with y_t = x_{t-2}, column 1 at row t is about x_t.
    const id = xs.map((_, i) => i);
    expect(bestLagR(xs, ys, id, id).lag).toBe(2);
  });
  it("finds a real lead significant and pure noise not", () => {
    const real = blockBootstrapLead(leading(80, 3).x, leading(80, 3).y, 8, { resamples: 300 });
    expect(real.lag).toBe(3);
    expect(real.p).toBeLessThan(0.05);
    expect(real.ciLow).toBeGreaterThan(0.5);
    const d = weeks(80);
    const a = noise(80, 11);
    const b = noise(80, 99);
    const none = blockBootstrapLead(d.map((dd, i) => [dd, a[i]]), d.map((dd, i) => [dd, b[i]]), 8, { resamples: 300 });
    expect(none.p).toBeGreaterThan(0.1);
  });
  it("pays for the lag search: the null maximum over 8 lags is larger than over 1 lag", () => {
    const d = weeks(60);
    const a = noise(60, 4);
    const b = noise(60, 5);
    const x: Series = d.map((dd, i) => [dd, a[i]]);
    const y: Series = d.map((dd, i) => [dd, b[i]]);
    const eight = blockBootstrapLead(x, y, 8, { resamples: 400 });
    // With one lag the same observed lag-1 r would face a smaller null maximum, so its p-value is no larger.
    const one = blockBootstrapLead(x, y, 1, { resamples: 400 });
    expect(eight.r as number).toBeGreaterThanOrEqual(one.r as number);
    expect(eight.p as number).toBeGreaterThan(0.05);
  });
  it("is deterministic with the fixed seed", () => {
    const { x, y } = leading(50, 1);
    expect(blockBootstrapLead(x, y, 8, { resamples: 100 })).toEqual(blockBootstrapLead(x, y, 8, { resamples: 100 }));
  });
});

describe("Benjamini-Hochberg", () => {
  it("matches a worked example", () => {
    const ps = [0.01, 0.04, 0.03, 0.2, null];
    const { significant, adjusted } = benjaminiHochberg(ps, 0.1);
    // Sorted: 0.01 (k1, 0.025), 0.03 (k2, 0.05), 0.04 (k3, 0.075), 0.2 (k4, 0.1): the largest k with p <= k/m q is 3.
    expect(significant).toEqual([true, true, true, false, false]);
    expect(adjusted[0]).toBeCloseTo(0.04, 6);
    expect(adjusted[3]).toBeCloseTo(0.2, 6);
    expect(adjusted[4]).toBeNull();
  });
});

describe("regression and distributions", () => {
  it("fits an exact linear model", () => {
    const X = [[1, 2], [2, 1], [3, 5], [4, 3], [5, 8]];
    const y = X.map(([a, b]) => 1 + 2 * a - 0.5 * b);
    const fit = olsMulti(X, y)!;
    expect(fit.beta[0]).toBeCloseTo(1, 8);
    expect(fit.beta[1]).toBeCloseTo(2, 8);
    expect(fit.beta[2]).toBeCloseTo(-0.5, 8);
  });
  it("has known tail values", () => {
    expect(normCdf(1.6449)).toBeCloseTo(0.95, 3);
    expect(fTail(4.0, 1, 30)).toBeCloseTo(0.0546, 3);
    expect(tCritical(0.1, 10)).toBeCloseTo(1.812, 2);
  });
});

describe("Clark-West", () => {
  it("rejects when the added predictor is real and not when it is noise", () => {
    const d = weeks(90, "2025-01-06");
    const p = noise(90, 21);
    const iv = noise(90, 22);
    const e = noise(90, 23);
    const price: Series = d.map((dd, i) => [dd, p[i]]);
    const intents: Series = d.map((dd, i) => [dd, iv[i]]);
    const y: Series = d.map((dd, i) => [dd, (i >= 2 ? iv[i - 2] : 0) + 0.3 * e[i]]);
    const cutoff = d[50];
    const real = clarkWest(intents, price, y, cutoff, 8);
    expect(real.intentsLag).toBe(2);
    expect(real.mse2!).toBeLessThan(real.mse1!);
    expect(real.p!).toBeLessThan(0.1);
    expect(real.pass).toBe(true);
    const yNoise: Series = d.map((dd, i) => [dd, e[i]]);
    expect(clarkWest(intents, price, yNoise, cutoff, 8).pass).toBe(false);
  });
});

describe("Granger", () => {
  it("finds x causing y and not the reverse", () => {
    const { x, y } = leading(100, 1, 31);
    expect(granger(x, y).significant).toBe(true);
    expect(granger(y, x).significant).toBe(false);
  });
});

describe("trend, concentration and shares", () => {
  it("gives a slope interval above zero for a rising series", () => {
    const t = trend([0.1, 0.12, 0.15, 0.16, 0.2, 0.22]);
    expect(t.slope!).toBeGreaterThan(0);
    expect(t.ciLow!).toBeGreaterThan(0);
  });
  it("computes HHI and top shares", () => {
    expect(hhi([50, 50])).toBeCloseTo(5000, 6);
    expect(hhi([100])).toBe(10000);
    expect(topShare([60, 30, 10], 1)).toBeCloseTo(0.6, 6);
    expect(topShare([60, 30, 10], 5)).toBeCloseTo(1, 6);
  });
  it("sums complete months only", () => {
    const s: Series = [];
    for (let i = 0; i < 40; i++) s.push([addDays("2026-01-01", i), 1]);
    expect(monthlySum(s)).toEqual([["2026-01", 31]]);
  });
});

describe("pre-registered rules", () => {
  const cw = (pass: boolean) => ({ pass }) as ClarkWestResult;
  it("A2 and A4", () => {
    expect(ruleA2([cw(true), cw(true), cw(false)])).toBe(true);
    expect(ruleA2([cw(true), cw(false)])).toBe(false);
    expect(ruleA4(["contract", "contract", "chain"], true)).toBe(true);
    expect(ruleA4(["contract", "contract", "contract"], true)).toBe(false);
    expect(ruleA4(["contract", "chain", "chain"], false)).toBe(false);
  });
  it("B1", () => {
    expect(ruleB1({ r: 0.3, significant: true }, { r: 0.1 }, { r: 0.3 })).toBe("pass");
    expect(ruleB1({ r: 0.35, significant: false }, { r: 0.1 }, { r: 0.2 })).toBe("pass");
    expect(ruleB1({ r: -0.1, significant: false }, { r: -0.2 }, { r: 0.1 })).toBe("fail");
    expect(ruleB1({ r: 0.15, significant: false }, { r: 0.1 }, { r: 0.1 })).toBe("inconclusive");
  });
  it("B2", () => {
    expect(ruleB2(trend([0.1, 0.2, 0.3, 0.4, 0.5]), [0.1, 0.2, 0.3, 0.4, 0.5])).toBe("pass");
    expect(ruleB2(trend([0.01, 0.02, 0.03, 0.04, 0.05]), [0.01, 0.02, 0.03, 0.04, 0.05])).toBe("fail");
    expect(ruleB2(trend([0.5, 0.4, 0.3, 0.3, 0.25]), [0.5, 0.4, 0.3, 0.3, 0.25])).toBe("fail");
  });
  it("B3", () => {
    expect(ruleB3(trend([0.5, 0.45, 0.4, 0.3, 0.2]), trend([0.5, 0.55, 0.6, 0.7, 0.8]))).toBe("pass");
    expect(ruleB3(trend([0.2, 0.3, 0.2, 0.3, 0.25]), trend([0.8, 0.7, 0.8, 0.7, 0.75]))).toBe("fail");
  });
  it("B4", () => {
    expect(ruleB4(trend([3000, 2800, 2500, 2300, 2000]), [0.5, 0.45, 0.35, 0.3, 0.3])).toBe("pass");
    expect(ruleB4(trend([2000, 2300, 2500, 2800, 3000]), [0.3, 0.3, 0.3, 0.3, 0.3])).toBe("fail");
    expect(ruleB4(trend([3000, 2800, 2500, 2300, 2000]), [0.5, 0.45, 0.35, 0.3, 0.45])).toBe("fail");
  });
  it("B5", () => {
    expect(ruleB5(trend([0.4, 0.42, 0.45, 0.47, 0.5]))).toBe("pass");
    expect(ruleB5(trend([0.5, 0.48, 0.47, 0.45, 0.44]))).toBe("fail");
  });
});
