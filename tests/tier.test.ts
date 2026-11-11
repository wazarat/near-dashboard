import { describe, expect, it } from "vitest";
import { TIER_LINES } from "@/components/atlas/tier-info";
import { TIER_SHORT } from "@/lib/colors";
import { recomputeTier, TIER_LABEL, TIER_THRESHOLDS, tierLabel } from "@/lib/tier";
import { TIERS } from "@/lib/types";

describe("tier labels", () => {
  it("shows TBD for an untracked tier and leaves every other tier as it is", () => {
    for (const t of TIERS) expect(tierLabel(t)).toBe(t === "Not tracked" ? "TBD" : t);
    expect(TIER_SHORT["Not tracked"]).toBe("TBD");
    expect(Object.keys(TIER_LABEL).sort()).toEqual([...TIERS].sort());
  });
  it("leaves the tier in the data untouched", () => {
    expect(recomputeTier({ tvl: null, volume: null, fees: null, revenue: null, mapped: false })).toBe("Not tracked");
    expect(recomputeTier({ tvl: 0, volume: 0, fees: 0, revenue: 0, mapped: true })).toBe("Tracked, negligible");
  });
  it("explains every tier, with figures read from the thresholds", () => {
    expect(TIER_LINES.map((l) => l.tier)).toEqual([...TIERS]);
    expect(TIER_THRESHOLDS.tier2.tvl).toBe(5_000_000);
    expect(TIER_LINES[0].rule).toContain("$50M");
    expect(TIER_LINES[0].rule).toContain("$500M");
    expect(TIER_LINES[0].rule).toContain("$1M");
    expect(TIER_LINES[1].rule).toContain("$5M");
    expect(TIER_LINES[1].rule).toContain("$50M");
    expect(TIER_LINES[1].rule).toContain("$100K");
  });
});
