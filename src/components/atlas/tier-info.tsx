"use client";

import { InfoTip } from "@/components/ui/info-tip";
import { TIER_COLOR } from "@/lib/colors";
import { fmtUsd } from "@/lib/format";
import { TBD_LINE, TIER_THRESHOLDS } from "@/lib/tier";
import type { Tier } from "@/lib/types";

const t1 = TIER_THRESHOLDS.tier1;
const t2 = TIER_THRESHOLDS.tier2;
const usd = (v: number) => fmtUsd(v, { digits: 0 });

/** One line per tier, built from src/lib/tier.ts so the explanation can never drift from the rule. */
export const TIER_LINES: Array<{ tier: Tier; name: string; rule: string }> = [
  { tier: "Tier 1 - Leader", name: "Tier 1, leader", rule: `TVL of ${usd(t1.tvl)} or more, or 30-day DEX volume of ${usd(t1.volume)} or more, or 30-day fees of ${usd(t1.fees)} or more.` },
  { tier: "Tier 2 - Strong", name: "Tier 2, strong", rule: `TVL of ${usd(t2.tvl)} or more, or 30-day DEX volume of ${usd(t2.volume)} or more, or 30-day fees of ${usd(t2.fees)} or more.` },
  { tier: "Tier 3 - Emerging", name: "Tier 3, emerging", rule: "Any tracked TVL, volume, fees or revenue below Tier 2." },
  { tier: "Tracked, negligible", name: "Tracked, negligible", rule: "Listed on DefiLlama, with every figure at zero." },
  { tier: "Not tracked", name: "TBD", rule: `${TBD_LINE}.` },
];

/** The tier explanation: an intro and one bullet per tier with its legend swatch. */
export function TierInfoContent() {
  return (
    <div className="space-y-2">
      <p>Tiers are CanHav&rsquo;s own thresholds, not a market standard. A project needs to meet only one condition.</p>
      <ul className="space-y-1.5">
        {TIER_LINES.map((t) => (
          <li key={t.tier} className="flex gap-2">
            <span aria-hidden className="mt-1 size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: TIER_COLOR[t.tier] }} />
            <span>
              <strong className="font-semibold text-ink-50">{t.name}.</strong> {t.rule}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The same explanation behind an info icon, for every place a tier is named. */
export function TierInfoTip({ className }: { className?: string }) {
  return (
    <InfoTip label="How tiers are set" className={className}>
      <TierInfoContent />
    </InfoTip>
  );
}
