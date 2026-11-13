import { describe, expect, it } from "vitest";
import { brushSlice, changePhrase, fittedDomain, levelWindow, MIN_USD_START, rangeStats, sanitizeId } from "../src/lib/chart-frame";

describe("chart frame helpers", () => {
  it("fits a level series with 10% padding and never below zero for positive data", () => {
    expect(fittedDomain([100, 110, 120])).toEqual([98, 122]);
    expect(fittedDomain([1, 3, null, undefined, Number.NaN])).toEqual([0.8, 3.2]);
    const [lo, hi] = fittedDomain([0.5, 100]) as [number, number];
    expect(lo).toBe(0);
    expect(hi).toBeCloseTo(109.95);
    expect(fittedDomain([-10, 10])).toEqual([-12, 12]);
  });

  it("gives a flat series a band, zero a unit band, and nothing when every value is blank", () => {
    const flat = fittedDomain([50, 50, 50]) as [number, number];
    expect(flat[0]).toBeCloseTo(45);
    expect(flat[1]).toBeCloseTo(55);
    expect(fittedDomain([0, 0])).toEqual([0, 1]);
    expect(fittedDomain([null, undefined])).toBeUndefined();
  });

  it("reports min, max, first, last and change over the visible range", () => {
    const s = rangeStats(["d1", "d2", "d3", "d4"], [null, 100, 80, 120]);
    expect(s).toMatchObject({ min: 80, max: 120, first: 100, last: 120, minDate: "d3", maxDate: "d4" });
    expect(s?.change).toBeCloseTo(0.2);
    expect(rangeStats(["d1"], [0])?.change).toBeNull();
    expect(rangeStats(["d1"], [null])).toBeNull();
  });

  it("gives level series a 90-day floor and leaves All alone", () => {
    expect(levelWindow("7d", 400)).toBe(90);
    expect(levelWindow("30d", 400)).toBe(90);
    expect(levelWindow("90d", 400)).toBe(90);
    expect(levelWindow("all", 400)).toBe(400);
    expect(levelWindow("30d", 50)).toBe(50);
    expect(levelWindow("all", 0)).toBe(1);
  });

  it("makes React ids safe for SVG references and slices by a brush window", () => {
    expect(sanitizeId("«r1»")).toBe("r1");
    expect(sanitizeId(":r2:")).toBe("r2");
    expect(brushSlice([1, 2, 3, 4, 5], [1, 3])).toEqual([2, 3, 4]);
    expect(brushSlice([1, 2, 3], null)).toEqual([1, 2, 3]);
    expect(brushSlice([1, 2, 3], [-2, 10])).toEqual([1, 2, 3]);
  });
});

describe("long-range change", () => {
  const dates = ["2020-10-01", "2020-10-02", "2021-03-01", "2021-03-02", "2026-11-12"];
  it("does not compare from a start under $1M or under 1% of the last value (no +7,125,924%)", () => {
    const s = rangeStats(dates, [2_300, 400_000, 1_200_000, 5_000_000, 169_300_000], { minStart: MIN_USD_START });
    // 1% of $169.3M is $1.693M, so the first qualifying day is 2021-03-02 at $5M.
    expect(s?.changeSince).toBe("2021-03-02");
    expect(s?.change).toBeCloseTo(169.3 / 5 - 1, 6);
    expect(changePhrase(s!, 5, (v) => `${((v ?? 0) * 100).toFixed(1)}%`, (d) => d)).toBe("3286.0% since 2021-03-02");
  });
  it("keeps the plain change when the start is large enough", () => {
    const s = rangeStats(dates, [100e6, 110e6, 120e6, 130e6, 150e6], { minStart: MIN_USD_START });
    expect(s?.changeSince).toBeNull();
    expect(s?.change).toBeCloseTo(0.5, 6);
    expect(changePhrase(s!, 5, (v) => `${((v ?? 0) * 100).toFixed(0)}%`, (d) => d)).toBe("50% over 5 days");
  });
  it("gives no change when no day reaches the bar", () => {
    const s = rangeStats(dates, [10, 20, 30, 40, 50], { minStart: MIN_USD_START });
    expect(s?.change).toBeNull();
    expect(changePhrase(s!, 5, () => "x", (d) => d)).toBe("over 5 days");
  });
});
