import { describe, expect, it } from "vitest";
import { alignByFirstData, availablePresets, compareMatrix, compareRatios, compareSentences, crossSector, indexTo100, nameLookup, normalizeSelection, ratio, resolvePreset, seriesFor } from "@/lib/compare";
import type { MetricChange, Project } from "@/lib/types";

const none: MetricChange = { d7: null, d30: null, d90: null };

interface Synthetic {
  id: string;
  sector: string;
  tvl?: number | null;
  volume?: number | null;
  fees?: number | null;
  revenue?: number | null;
  d30?: number | null;
  calls7d?: number | null;
  signers7d?: number | null;
  ps?: number | null;
  mcap?: number | null;
  live?: boolean;
}

/** Synthetic project with only the fields the compare helpers read. */
const mk = (s: Synthetic): Project =>
  ({
    id: s.id,
    name: s.id.toUpperCase(),
    sector: s.sector,
    tvl: s.tvl ?? null,
    volume: s.volume ?? null,
    fees: s.fees ?? null,
    revenue: s.revenue ?? null,
    revenueCapture: s.fees && s.revenue !== null && s.revenue !== undefined ? s.revenue / s.fees : null,
    hasTraction: true,
    tier: "Tier 3 - Emerging",
    live:
      s.live === false
        ? null
        : {
            change: { tvl: { ...none, d30: s.d30 ?? null }, volume: none, fees: none, revenue: none },
            annualisedRevenue: s.revenue === null || s.revenue === undefined ? null : s.revenue * 12,
            tokenMarketCap: s.mcap ?? null,
            psRatio: s.ps ?? null,
            calls7d: s.calls7d ?? null,
            signers7d: s.signers7d ?? null,
          },
  }) as unknown as Project;

const a = mk({ id: "a", sector: "DEXs", tvl: 1000, volume: 5000, fees: 50, revenue: 10, d30: 0.2, calls7d: 700, ps: 12, mcap: 1_000_000 });
const b = mk({ id: "b", sector: "DEXs", tvl: 500, volume: 1000, fees: 40, revenue: 30, d30: -0.1, calls7d: 100, ps: 4, mcap: 400_000 });
const c = mk({ id: "c", sector: "DEXs", tvl: 200, fees: 1, revenue: 0 });
const d = mk({ id: "d", sector: "Lending", tvl: 800, fees: 8, revenue: 8, d30: 0 });
const e = mk({ id: "e", sector: "Lending", live: false });
const all = [a, b, c, d, e];

describe("selection", () => {
  it("keeps known ids in order, drops duplicates and unknowns, caps at four", () => {
    const known = new Set(["a", "b", "c", "d", "e"]);
    expect(normalizeSelection(["a", "zzz", "a", "b", "c", "d", "e"], known)).toEqual(["a", "b", "c", "d"]);
    expect(normalizeSelection([], known)).toEqual([]);
  });
  it("resolves presets by exact name and hides presets with fewer than two matches", () => {
    const lookup = nameLookup(all);
    expect(resolvePreset(["A", "B", "Missing"], lookup)).toEqual(["a", "b"]);
    expect(resolvePreset(["a"], lookup)).toEqual([]);
    const presets = availablePresets(all, [
      { name: "Pair", projects: ["A", "B", "Nope"] },
      { name: "Solo", projects: ["D", "Nope"] },
    ]);
    expect(presets.map((p) => p.name)).toEqual(["Pair"]);
    expect(presets[0].ids).toEqual(["a", "b"]);
    expect(presets[0].names).toEqual(["A", "B"]);
  });
  it("lists distinct sectors in selection order", () => {
    expect(crossSector([a, d, b])).toEqual(["DEXs", "Lending"]);
  });
});

describe("matrix", () => {
  it("ranks and shares inside each project's own sector and marks the best cell", () => {
    const rows = compareMatrix([b, d], all);
    const tvl = rows.find((r) => r.key === "tvl")!;
    expect(tvl.cells[0]).toMatchObject({ value: 500, rank: 2, of: 3, best: false });
    expect(tvl.cells[0].share).toBeCloseTo(500 / 1700);
    expect(tvl.cells[1]).toMatchObject({ value: 800, rank: 1, of: 1, best: true });
    expect(tvl.cells[1].share).toBe(1);
  });
  it("treats P/S as lower-is-better and gives ratios no share", () => {
    const ps = compareMatrix([a, b], all).find((r) => r.key === "ps")!;
    expect(ps.cells.map((x) => x.best)).toEqual([false, true]);
    expect(ps.cells[0]).toMatchObject({ rank: 2, of: 2, share: null });
    expect(ps.format(4)).toBe("4.0×");
  });
  it("leaves null cells unranked and does not tag a lone value as best", () => {
    const calls = compareMatrix([a, c], all).find((r) => r.key === "calls7d")!;
    expect(calls.cells[1]).toMatchObject({ value: null, rank: null, share: null, best: false });
    expect(calls.cells[0].best).toBe(false);
    expect(calls.cells[0].of).toBe(2);
    expect(calls.format(null)).toBe("Not tracked");
  });
  it("survives projects without live data", () => {
    const rows = compareMatrix([e], all);
    for (const r of rows) expect(r.cells[0].value).toBeNull();
  });
});

describe("ratios", () => {
  it("guards every division", () => {
    expect(ratio(10, 0)).toBeNull();
    expect(ratio(null, 5)).toBeNull();
    expect(ratio(5, null)).toBeNull();
    expect(ratio(5, -1)).toBeNull();
    expect(ratio(10, 4)).toBe(2.5);
  });
  it("computes fees per TVL, capture, turnover, 30d change and calls per $1M TVL", () => {
    const rows = compareRatios([a, b, e], "tvl");
    const by = (k: string) => rows.find((r) => r.key === k)!;
    expect(by("feesPerTvl").values[0]).toBeCloseTo(0.05);
    expect(by("feesPerTvl").values[1]).toBeCloseTo(0.08);
    expect(by("feesPerTvl").values[2]).toBeNull();
    expect(by("feesPerTvl").best).toEqual([false, true, false]);
    expect(by("capture").values.slice(0, 2)).toEqual([0.2, 0.75]);
    expect(by("turnover").values[0]).toBe(5);
    expect(by("change30").values).toEqual([0.2, -0.1, null]);
    expect(by("change30").label).toBe("30d change (TVL)");
    expect(by("callsPerTvl").values[0]).toBeCloseTo(700_000);
    expect(by("callsPerTvl").values[1]).toBeCloseTo(200_000);
  });
  it("follows the current metric for the change row", () => {
    expect(compareRatios([a], "fees").find((r) => r.key === "change30")!.label).toBe("30d change (Fees)");
    expect(compareRatios([a], "count").find((r) => r.key === "change30")!.label).toBe("30d change (TVL)");
  });
});

describe("overlay alignment", () => {
  it("indexes to 100 at the first date shared by every series with data", () => {
    const { start, indexed, skipped } = indexTo100([
      [null, 10, 20, 30],
      [5, 5, 10, null],
    ]);
    expect(start).toBe(1);
    expect(indexed[0]).toEqual([null, 100, 200, 300]);
    expect(indexed[1]).toEqual([null, 100, 200, null]);
    expect(skipped).toEqual([]);
  });
  it("skips empty series instead of blanking the chart", () => {
    const partial = indexTo100([
      [null, null],
      [1, 2],
    ]);
    expect(partial.start).toBe(0);
    expect(partial.skipped).toEqual([0]);
    expect(partial.indexed[0]).toEqual([null, null]);
    expect(partial.indexed[1]).toEqual([100, 200]);
    expect(indexTo100([[null, null]]).start).toBe(-1);
    expect(indexTo100([]).start).toBe(-1);
  });
  it("re-bases each series on its own first positive value", () => {
    expect(
      alignByFirstData([
        [null, 10, 20, 30],
        [5, 5, 10, null],
        [null, null],
      ]),
    ).toEqual([[100, 200, 300], [100, 100, 200, null], []]);
  });
  it("pulls series by id and fills missing projects with nulls", () => {
    const file = { dates: ["2026-01-01", "2026-01-02"], projects: { a: { tvl: [1, 2], volume: [null, null], fees: [0, 1], revenue: [0, 0], calls: [3, 4] } } };
    expect(seriesFor(file, ["a", "zzz"], "tvl")).toEqual([
      [1, 2],
      [null, null],
    ]);
    expect(seriesFor(null, ["a"], "tvl")).toEqual([[]]);
  });
});

describe("sentences", () => {
  it("writes the leader multiple, the fee-efficiency gap and the momentum contrast", () => {
    const s = compareSentences([a, b], "tvl");
    expect(s).toHaveLength(3);
    expect(s[0]).toBe("A leads on TVL with $1.0K, 2.0× B.");
    expect(s[1]).toBe("B earns 1.6× more fees per dollar of TVL than A ($0.0800 vs $0.0500 over 30 days).");
    expect(s[2]).toBe("Over 30 days A grew +20.0% in TVL while B shrank -10.0%.");
    expect(compareSentences([a, b], "fees")[0]).toBe("A leads on 30d fees with $50, 1.3× B.");
  });
  it("says when projects are about level and notes missing figures", () => {
    const near = mk({ id: "n", sector: "DEXs", tvl: 1020 });
    const s = compareSentences([a, near, e], "tvl");
    expect(s[0]).toBe("N leads on TVL with $1.0K, about level with A. 1 of the 3 report no TVL.");
  });
  it("drops the momentum sentence when fewer than two projects have a 30d change", () => {
    const s = compareSentences([a, c], "tvl");
    expect(s.some((x) => x.startsWith("Over 30 days"))).toBe(false);
    expect(s.some((x) => x.includes("fees per dollar of TVL"))).toBe(true);
  });
  it("returns nothing below two projects", () => {
    expect(compareSentences([a], "tvl")).toEqual([]);
    expect(compareSentences([], "fees")).toEqual([]);
  });
  it("handles a selection without any figures", () => {
    const f = mk({ id: "f", sector: "Lending", live: false });
    expect(compareSentences([e, f], "revenue")).toEqual([]);
  });
});
