import { describe, expect, it } from "vitest";
import type { Series } from "../src/lib/history-types";
import { alignPairs, crossCorrelation, indexTo100, leadLag, logChanges, ols, outOfSample, pearson, subtractSeries, toWeekly, trimTop } from "../src/lib/stats";

/** Deterministic pseudo-random noise so the test is reproducible. */
function noise(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296 - 0.5;
  };
}
const day = (i: number) => new Date(Date.UTC(2025, 0, 6) + i * 86_400_000).toISOString().slice(0, 10); // 2025-01-06 is a Monday

describe("resampling", () => {
  it("toWeekly sums flows per ISO week and drops the incomplete trailing week", () => {
    const daily: Series = Array.from({ length: 17 }, (_, i) => [day(i), 1]);
    const w = toWeekly(daily, "flow", day(16));
    expect(w).toEqual([["2025-01-06", 7], ["2025-01-13", 7]]);
    expect(toWeekly(daily, "stock", day(16)).map(([, v]) => v)).toEqual([1, 1]);
  });
  it("logChanges skips non-positive values", () => {
    expect(logChanges([["a", 1], ["b", Math.E], ["c", 0], ["d", 2]])).toEqual([["b", 1]]);
  });
  it("alignPairs inner-joins on date", () => {
    expect(alignPairs([["a", 1], ["b", 2]], [["b", 20], ["c", 30]])).toEqual([["b", 2, 20]]);
  });
});

describe("correlation and lead-lag", () => {
  it("pearson is 1 on a line and null on constants", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(pearson([1, 1, 1], [2, 4, 6])).toBeNull();
  });
  it("finds the planted lead of two weeks", () => {
    const rnd = noise(7);
    const n = 120;
    const x: Series = Array.from({ length: n }, (_, i) => [day(i), rnd()]);
    // y follows x with a two-period lead plus small noise
    const y: Series = Array.from({ length: n }, (_, i) => [day(i), (i >= 2 ? x[i - 2][1] : 0) + 0.1 * rnd()]);
    const ll = leadLag(x, y, 8);
    expect(ll.bestLead?.lag).toBe(2);
    expect(ll.bestPositiveLead?.lag).toBe(2);
    expect(ll.bestLead?.r ?? 0).toBeGreaterThan(0.9);
    expect(Math.abs(ll.r0 ?? 0)).toBeLessThan(0.3);
    expect(crossCorrelation(x, y, 8)).toHaveLength(17);
  });
});

describe("out-of-sample", () => {
  it("a true leading series beats a noise series on the test window", () => {
    const rnd = noise(11);
    const n = 150;
    const x: Series = Array.from({ length: n }, (_, i) => [day(i), rnd()]);
    const z: Series = Array.from({ length: n }, (_, i) => [day(i), rnd()]);
    const y: Series = Array.from({ length: n }, (_, i) => [day(i), (i >= 1 ? x[i - 1][1] : 0) + 0.2 * rnd()]);
    const good = outOfSample(x, y, day(100), 4);
    const bad = outOfSample(z, y, day(100), 4);
    expect(good.lag).toBe(1);
    expect(good.r2Oos ?? -1).toBeGreaterThan(0.6);
    expect(good.hitRate ?? 0).toBeGreaterThan(0.8);
    expect(bad.r2Oos ?? 1).toBeLessThan(0.2);
    expect(ols([1, 2, 3, 4], [3, 5, 7, 9])).toMatchObject({ a: 1, b: 2, r2: 1 });
  });
});

describe("robustness helpers", () => {
  it("trimTop caps the biggest values", () => {
    const s: Series = Array.from({ length: 20 }, (_, i) => [day(i), i + 1]);
    const t = trimTop(s, 0.9);
    expect(t.trimmed).toBe(2);
    expect(Math.max(...t.series.map(([, v]) => v))).toBe(t.cap);
  });
  it("subtractSeries and indexTo100", () => {
    expect(subtractSeries([["a", 10], ["b", 5]], [["a", 3]], [["b", 9]])).toEqual([["a", 7], ["b", 0]]);
    expect(indexTo100([["a", 0], ["b", 2], ["c", 4]])).toEqual([["a", 0], ["b", 100], ["c", 200]]);
  });
});
