import { describe, expect, it } from "vitest";
import { lastShare, selectionSeries, windowSum } from "../src/lib/selection-series";
import type { SeriesFile } from "../src/lib/types";

const blank = [null, null, null];
const file: SeriesFile = {
  dates: ["2026-11-01", "2026-11-02", "2026-11-03"],
  projects: {
    a: { tvl: [10, 20, 30], volume: [1, null, 3], fees: blank, revenue: blank, calls: [5, 5, 5] },
    b: { tvl: [100, null, 300], volume: [10, 10, 10], fees: [1, 1, 1], revenue: blank, calls: blank },
    c: { tvl: [1000, 1000, 1000], volume: blank, fees: blank, revenue: blank, calls: blank },
  },
};

describe("selectionSeries", () => {
  it("sums each day over the selected projects and leaves blanks out", () => {
    const s = selectionSeries(file, ["a", "b"]);
    expect(s.dates).toEqual(file.dates);
    expect(s.metrics.tvl.values).toEqual([110, 20, 330]);
    expect(s.metrics.volume.values).toEqual([11, 10, 13]);
    expect(s.metrics.calls.values).toEqual([5, 5, 5]);
  });

  it("is blank, not zero, on a day no selected project reports", () => {
    expect(selectionSeries(file, ["a"]).metrics.fees.values).toEqual([null, null, null]);
    expect(selectionSeries(file, ["a", "b"]).metrics.revenue.values).toEqual([null, null, null]);
  });

  it("counts the selected projects with history, and skips ids with none", () => {
    const s = selectionSeries(file, ["a", "b", "nope"]);
    expect(s.metrics.tvl.withHistory).toBe(2);
    expect(s.metrics.fees.withHistory).toBe(1);
    expect(s.metrics.calls.withHistory).toBe(1);
    expect(s.withAnyHistory).toBe(2);
  });

  it("compares with the same sum over every project, for a like-for-like share", () => {
    const s = selectionSeries(file, ["a"]);
    expect(s.metrics.tvl.all).toEqual([1110, 1020, 1330]);
    expect(lastShare(s.metrics.tvl)).toBeCloseTo(30 / 1330);
    expect(lastShare(selectionSeries(file, ["c"]).metrics.fees)).toBeNull();
  });

  it("sums a flow over its last n days", () => {
    expect(windowSum([1, null, 3], 2)).toBe(3);
    expect(windowSum([1, null, 3], 10)).toBe(4);
    expect(windowSum([null, null], 2)).toBeNull();
  });
});
