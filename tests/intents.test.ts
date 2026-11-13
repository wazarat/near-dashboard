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

describe("backfill resume point", () => {
  const unix = (iso: string) => Math.floor(Date.parse(iso) / 1000);
  const days = [
    { date: "2025-12-21", partial: true },
    { date: "2025-12-22", partial: false },
    { date: "2025-12-23", partial: false },
  ];
  it("continues at the cursor when that day's rows are on disk", async () => {
    const { backfillResume } = await import("../scripts/fetch/intents");
    const cursor = unix("2025-12-21T01:30:48Z");
    expect(backfillResume(cursor, days, (d) => d === "2025-12-21", 0)).toEqual({ before: cursor, ceiling: null });
  });
  it("on a fresh checkout restarts at the oldest complete day, so the partial day is read whole and finished days are left alone", async () => {
    const { backfillResume } = await import("../scripts/fetch/intents");
    const start = unix("2025-12-22T00:00:00Z");
    expect(backfillResume(unix("2025-12-21T01:30:48Z"), days, () => false, 0)).toEqual({ before: start, ceiling: start });
    // A cursor that was put back by mistake does not matter: the committed days decide.
    expect(backfillResume(unix("2026-03-01T12:00:00Z"), days, () => false, 0)).toEqual({ before: start, ceiling: start });
  });
  it("falls back to the cursor, then to the recent window, when nothing is committed yet", async () => {
    const { backfillResume } = await import("../scripts/fetch/intents");
    expect(backfillResume(null, [], () => false, 123)).toEqual({ before: 123, ceiling: null });
    expect(backfillResume(456, [{ date: "2025-12-21", partial: true }], () => false, 123)).toEqual({ before: 456, ceiling: null });
  });
});

describe("backfill commit on top of a moving main", () => {
  it("lays only the Intents cursor and status over the meta file on main", async () => {
    const { mergeIntentsState } = await import("../scripts/ci/keep-intents-backfill");
    const { emptyMeta } = await import("../src/lib/history-types");
    const main = emptyMeta();
    main.lastRunDate = "2026-11-14";
    main.cursors.bigquery = { daily_chain: "2026-11-13" };
    main.cursors.intents = { ...main.cursors.intents, newestCreatedAt: "2026-11-14T03:20:00.000Z", oldestCreatedAt: "2025-12-21T01:30:48.000Z" };
    const ours = emptyMeta();
    ours.cursors.intents = { ...ours.cursors.intents, newestCreatedAt: "2026-11-13T16:24:13.000Z", oldestCreatedAt: "2025-11-20T08:00:00.000Z", backfillDone: false };
    ours.perSource.intents = { ...ours.perSource.intents, calls: 400, rows: 400000 };
    const out = mergeIntentsState(main, ours);
    expect(out.lastRunDate).toBe("2026-11-14");
    expect(out.cursors.bigquery).toEqual({ daily_chain: "2026-11-13" });
    expect(out.cursors.intents.oldestCreatedAt).toBe("2025-11-20T08:00:00.000Z");
    expect(out.cursors.intents.newestCreatedAt).toBe("2026-11-14T03:20:00.000Z");
    expect(out.perSource.intents.calls).toBe(400);
  });
});
