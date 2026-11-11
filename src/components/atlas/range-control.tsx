"use client";

import { Segmented } from "@/components/ui/segmented";
import { RANGE_LABEL, RANGES, type Range } from "@/lib/ranges";

const OPTIONS = RANGES.map((r) => ({ value: r, label: RANGE_LABEL[r] }));

/**
 * The 7d, 30d, 90d, All control of one card (standard section 4). It sits in the card's actions,
 * drives every panel in that card and nothing else, and the card keeps the choice under its own
 * URL key (src/lib/filters.ts, RANGE_KEYS). `ariaLabel` names the card, so two controls on a page
 * can be told apart.
 */
export function RangeControl({ value, onChange, ariaLabel, className }: { value: Range; onChange: (r: Range) => void; ariaLabel: string; className?: string }) {
  return <Segmented value={value} onChange={onChange} options={OPTIONS} ariaLabel={ariaLabel} className={className} />;
}
