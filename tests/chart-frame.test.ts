import { describe, expect, it } from "vitest";
import { brushSlice, fittedDomain, levelWindow, rangeStats, sanitizeId } from "../src/lib/chart-frame";

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
