import { describe, expect, it } from "vitest";
import type { IntentsDay } from "../src/lib/history-types";
import { summarizeIntents } from "../src/lib/intents";

function day(date: string, rows: number, volumeUsd: number, partial = false): IntentsDay {
  const success = Math.round(rows * 0.9);
  return {
    date,
    rows,
    sha256: "x",
    statuses: { SUCCESS: success, REFUNDED: rows - success - 1, FAILED: 1 },
    volumeUsd,
    volumeOutUsd: volumeUsd * 0.99,
    successCount: success,
    uniqueRecipients: Math.round(success * 0.7),
    medianUsd: 50,
    p90Usd: 900,
    maxUsd: 5000,
    routes: { "eth>near": { count: success, usd: volumeUsd } },
    originChains: { eth: { count: success, usd: volumeUsd } },
    destinationChains: { near: { count: success, usd: volumeUsd } },
    originAssets: { USDC: { count: success, usd: volumeUsd } },
    destinationAssets: { wNEAR: { count: success, usd: volumeUsd } },
    referrals: { "(none)": { count: success, usd: volumeUsd } },
    appFeeRecipients: { "(none)": { count: success, usd: volumeUsd } },
    partial,
  };
}

describe("summarizeIntents", () => {
  const days = [day("2026-11-03", 100, 10_000), day("2026-11-04", 200, 20_000), day("2026-11-05", 50, 5_000, true)];
  const llama = [["2026-11-03", 40_000], ["2026-11-04", 50_000], ["2026-11-05", 60_000]] as Array<[string, number]>;
  const s = summarizeIntents(days, llama, false);
  it("keeps partial days out of the 30-day totals and computes rates and ratios", () => {
    expect(s.coverage).toMatchObject({ days: 3, completeDays: 2, partialDays: 1, firstDay: "2026-11-03", lastDay: "2026-11-05" });
    expect(s.last30.days).toBe(2);
    expect(s.last30.volumeUsd).toBe(30_000);
    expect(s.last30.swaps).toBe(270);
    expect(s.last30.successRate).toBeCloseTo(0.9);
    expect(s.last30.llamaVolume).toBe(90_000);
    expect(s.last30.ratio).toBeCloseTo(30_000 / 90_000);
    expect(s.days[2].ratio).toBeNull(); // partial day has no ratio
    expect(s.days[0].ratio).toBeCloseTo(0.25);
  });
  it("buckets routes with shares and builds weekly rows", () => {
    expect(s.routes[0]).toMatchObject({ key: "eth>near", usd: 30_000, share: 1 });
    expect(s.weekly).toHaveLength(1);
    expect(s.weekly[0]).toMatchObject({ week: "2026-11-02", volumeUsd: 30_000, days: 2, llamaVolume: 90_000 });
    expect(s.ratioStats.days).toBe(2);
    expect(s.anomalies).toEqual([]);
  });
  it("flags refund-heavy days as anomalies", () => {
    const heavy = { ...day("2026-11-06", 1000, 1000), statuses: { SUCCESS: 400, REFUNDED: 600 }, successCount: 400 };
    const normal = [day("2026-11-01", 100, 1000), day("2026-11-02", 100, 1000), day("2026-11-03", 100, 1000)];
    const out = summarizeIntents([...normal, heavy], [], false);
    expect(out.anomalies.map((a) => a.date)).toEqual(["2026-11-06"]);
  });
});
