import { describe, expect, it } from "vitest";
import { stableJson, upsertSeries } from "../scripts/lib/store";

describe("upsertSeries", () => {
  const today = "2026-11-08";
  it("appends new dates and sorts", () => {
    const out = upsertSeries([["2026-11-05", 1]], [["2026-11-07", 3], ["2026-11-06", 2]], { today });
    expect(out).toEqual([["2026-11-05", 1], ["2026-11-06", 2], ["2026-11-07", 3]]);
  });
  it("is idempotent: a rerun with the same input is identical", () => {
    const inc: [string, number][] = [["2026-11-06", 2], ["2026-11-07", 3]];
    const once = upsertSeries([], inc, { today });
    expect(upsertSeries(once, inc, { today })).toEqual(once);
    expect(stableJson(upsertSeries(once, inc, { today }))).toBe(stableJson(once));
  });
  it("drops the partial current day for flows, keeps it for stocks", () => {
    expect(upsertSeries([], [[today, 5]], { today })).toEqual([]);
    expect(upsertSeries([], [[today, 5]], { today, allowToday: true })).toEqual([[today, 5]]);
  });
  it("drops future dates and non-finite values", () => {
    expect(upsertSeries([], [["2026-11-09", 1], ["2026-11-01", Number.NaN]], { today })).toEqual([]);
  });
  it("revises recent days but freezes older ones", () => {
    const existing: [string, number][] = [["2026-10-01", 10], ["2026-11-06", 20]];
    const out = upsertSeries(existing, [["2026-10-01", 99], ["2026-11-06", 21]], { today, revisionDays: 3 });
    expect(out).toEqual([["2026-10-01", 10], ["2026-11-06", 21]]);
  });
});

describe("stableJson", () => {
  it("sorts keys and writes one top-level entry per line", () => {
    expect(stableJson({ b: [1], a: { y: 1, x: 2 } })).toBe('{\n  "a": {"x":2,"y":1},\n  "b": [1]\n}\n');
    expect(stableJson([[1, 2], [3, 4]])).toBe("[\n  [1,2],\n  [3,4]\n]\n");
  });
});
