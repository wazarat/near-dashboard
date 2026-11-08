import type { Tier } from "./types";

/** Same thresholds as the Nov 8, 2026 snapshot (memo, Caveats). */
export const TIER_THRESHOLDS = {
  tier1: { tvl: 50_000_000, volume: 500_000_000, fees: 1_000_000 },
  tier2: { tvl: 5_000_000, volume: 50_000_000, fees: 100_000 },
} as const;

export interface TierInput {
  tvl: number | null;
  volume: number | null;
  fees: number | null;
  revenue: number | null;
  /** True when the project has a DefiLlama mapping (so zeros mean "tracked, negligible"). */
  mapped: boolean;
}

export function recomputeTier(m: TierInput): Tier {
  const tvl = m.tvl ?? 0;
  const vol = m.volume ?? 0;
  const fees = m.fees ?? 0;
  const t1 = TIER_THRESHOLDS.tier1;
  const t2 = TIER_THRESHOLDS.tier2;
  if (tvl >= t1.tvl || vol >= t1.volume || fees >= t1.fees) return "Tier 1 - Leader";
  if (tvl >= t2.tvl || vol >= t2.volume || fees >= t2.fees) return "Tier 2 - Strong";
  if (tvl > 0 || vol > 0 || fees > 0 || (m.revenue ?? 0) > 0) return "Tier 3 - Emerging";
  if (m.mapped) return "Tracked, negligible";
  return "Not tracked";
}
