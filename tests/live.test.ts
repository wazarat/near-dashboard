import { describe, expect, it } from "vitest";
import type { Series } from "../src/lib/history-types";
import { alignSeries, applyLive, computeLive, flowChange, sumWindow, valueAt, windowEnd, type HistoryStore } from "../src/lib/live";
import { newlyDetected, parseMapRows, sumSeries } from "../src/lib/mapping";
import { toProject } from "../src/lib/parse";
import { recomputeTier } from "../src/lib/tier";
import { validate } from "../src/lib/validate";

const days = (start: string, vals: number[]): Series => vals.map((v, i) => [new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10), v]);

describe("windows and momentum", () => {
  it("windowEnd is the day before the run", () => expect(windowEnd("2026-11-08")).toBe("2026-11-07"));
  it("sumWindow ignores days outside and reports coverage", () => {
    const s = days("2026-10-01", Array(40).fill(10));
    expect(sumWindow(s, "2026-11-07", 30)).toEqual({ value: 300, days: 30 });
    expect(sumWindow(s, "2026-12-31", 7).value).toBeNull();
  });
  it("valueAt tolerates gaps of up to 3 days", () => {
    const s: Series = [["2026-11-01", 5], ["2026-11-04", 7]];
    expect(valueAt(s, "2026-11-07")).toBe(7);
    expect(valueAt(s, "2026-11-08")).toBeNull();
  });
  it("flowChange needs half the prior window", () => {
    const s = days("2026-10-25", [...Array(7).fill(10), ...Array(7).fill(20)]);
    expect(flowChange(s, "2026-11-07", 7)).toBeCloseTo(1);
    expect(flowChange(days("2026-11-05", [1, 2, 3]), "2026-11-07", 7)).toBeNull();
  });
  it("alignSeries forward-fills stocks only", () => {
    const dates = ["2026-11-01", "2026-11-02", "2026-11-03"];
    expect(alignSeries([["2026-11-01", 1]], dates, "stock")).toEqual([1, 1, 1]);
    expect(alignSeries([["2026-11-01", 1]], dates, "flow")).toEqual([1, null, null]);
  });
});

describe("mapping, computeLive and applyLive", () => {
  const map = parseMapRows([
    { Project: "Rhea Finance", "DefiLlama slug": "rhea-dex", Chain: "near", Role: "tvl" },
    { Project: "Rhea Finance", "DefiLlama slug": "rhea-cross-chain", Chain: "near", Role: "tvl" },
    { Project: "Binance", "DefiLlama slug": "binance-cex", Chain: "near", Role: "cex-reserves" },
    { Project: "", "DefiLlama slug": "ignored-thing", Role: "ignore" },
  ]);
  const store: HistoryStore = {
    tvl: { near: { "rhea-dex": days("2026-10-01", Array(38).fill(20_000_000)), "rhea-cross-chain": days("2026-10-01", Array(38).fill(3_000_000)), "binance-cex": days("2026-10-01", Array(38).fill(500_000_000)) }, aurora: {} },
    volume: { near: { "Rhea Dex": days("2026-10-01", Array(38).fill(10_000_000)), "RHEA Cross Chain": days("2026-10-01", Array(38).fill(100_000)) }, aurora: {} },
    fees: { near: { "Rhea Dex": days("2026-10-01", Array(38).fill(20_000)) }, aurora: {} },
    revenue: { near: { "Rhea Dex": days("2026-10-01", Array(38).fill(4_000)) }, aurora: {} },
    holdersRevenue: { near: {}, aurora: {} },
    supplySideRevenue: { near: {}, aurora: {} },
    nameOfSlug: new Map([["rhea-dex", "Rhea Dex"], ["rhea-cross-chain", "RHEA Cross Chain"], ["binance-cex", "Binance CEX"]]),
    mcapOfSlug: new Map([["rhea-dex", 50_000_000]]),
  };
  it("sums slugs per project, honours roles, computes 30d flows and P/S", () => {
    const rows = map.filter((r) => r.project === "Rhea Finance");
    const live = computeLive(rows, store, "2026-11-07")!;
    expect(live.tvl).toBe(23_000_000);
    expect(live.tvlNear).toBe(23_000_000);
    expect(live.tvlAurora).toBeNull();
    expect(live.volume).toBe(303_000_000);
    expect(live.fees).toBe(600_000);
    expect(live.revenue).toBe(120_000);
    expect(live.annualisedRevenue).toBeCloseTo(1_460_000);
    expect(live.psRatio).toBeCloseTo(50_000_000 / 1_460_000);
    expect(live.cexReserves).toBeNull();
  });
  it("CEX rows feed reserves, never TVL", () => {
    const live = computeLive(map.filter((r) => r.project === "Binance"), store, "2026-11-07")!;
    expect(live.tvl).toBeNull();
    expect(live.cexReserves).toBe(500_000_000);
  });
  it("applyLive prefers live over snapshot and recomputes the tier", () => {
    const p = toProject({ "Project/Company Name": "Rhea Finance", "Sector/Category": "DEXs & Liquidity", "Native Chain": "NEAR native", "Native Chain Confidence": "High", "Traction Tier": "Tier 2 - Strong", "TVL on NEAR + Aurora (USD)": "1", "Security Risk Level": "High", Description: "x", Status: "Mainnet", "Discovered Via": "DefiLlama", "Funding Type": "Not researched" });
    const live = computeLive(map.filter((r) => r.project === "Rhea Finance"), store, "2026-11-07");
    const out = applyLive(p, live, true);
    expect(out.tvl).toBe(23_000_000);
    expect(out.metricSource.tvl).toBe("live");
    expect(out.tier).toBe("Tier 2 - Strong");
    expect(applyLive(p, null, false).tvl).toBe(1);
  });
  it("newlyDetected lists uncovered protocols and keeps firstSeen", () => {
    const protos = [
      { slug: "rhea-dex", name: "Rhea Dex", parentProtocol: null, category: "Dexs", address: null, tvlNear: 1, tvlAurora: null, mcap: null, geckoId: null, url: null, kinds: ["tvl" as const] },
      { slug: "newbie", name: "Newbie", parentProtocol: null, category: "Yield", address: null, tvlNear: 5, tvlAurora: 2, mcap: null, geckoId: null, url: null, kinds: ["tvl" as const] },
    ];
    const prev = [{ source: "defillama" as const, slug: "newbie", name: "Newbie", category: "Yield", chain: "NEAR", tvl: 1, firstSeen: "2026-10-01", url: "" }];
    const out = newlyDetected(protos, map, prev, "2026-11-08");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ slug: "newbie", firstSeen: "2026-10-01", tvl: 7, chain: "NEAR, Aurora" });
  });
  it("sumSeries merges by date", () => {
    expect(sumSeries([[["2026-01-01", 1]], [["2026-01-01", 2], ["2026-01-02", 3]]])).toEqual([["2026-01-01", 3], ["2026-01-02", 3]]);
  });
});

describe("tier thresholds", () => {
  const base = { tvl: null, volume: null, fees: null, revenue: null, mapped: true };
  it("matches the snapshot rules", () => {
    expect(recomputeTier({ ...base, tvl: 50_000_000 })).toBe("Tier 1 - Leader");
    expect(recomputeTier({ ...base, volume: 500_000_000 })).toBe("Tier 1 - Leader");
    expect(recomputeTier({ ...base, fees: 1_000_000 })).toBe("Tier 1 - Leader");
    expect(recomputeTier({ ...base, tvl: 5_000_000 })).toBe("Tier 2 - Strong");
    expect(recomputeTier({ ...base, fees: 100_000 })).toBe("Tier 2 - Strong");
    expect(recomputeTier({ ...base, tvl: 1 })).toBe("Tier 3 - Emerging");
    expect(recomputeTier({ ...base, tvl: 0 })).toBe("Tracked, negligible");
    expect(recomputeTier({ ...base, mapped: false })).toBe("Not tracked");
  });
});

describe("validate", () => {
  const expected = { static: { projects: 2 }, snapshot: { tvl: 10 }, liveSanity: { maxDayOverDayRatio: 10 } };
  const actual = { static: { projects: 2 }, snapshot: { tvl: 10 }, live: { tvl: 12 }, liveVsSnapshot: { tvl: 1.2 }, dayOverDay: { tvl: 1.01 }, sourceErrors: [], lastRunAgeDays: 1 };
  it("passes when everything matches", () => expect(validate(expected, actual).failures).toEqual([]));
  it("fails on a static or snapshot mismatch and warns on big jumps", () => {
    expect(validate(expected, { ...actual, static: { projects: 3 } }).failures).toHaveLength(1);
    const r = validate(expected, { ...actual, dayOverDay: { tvl: 20 }, lastRunAgeDays: 5, sourceErrors: ["intents: boom"] });
    expect(r.failures).toEqual([]);
    expect(r.warnings).toHaveLength(3);
  });
});
