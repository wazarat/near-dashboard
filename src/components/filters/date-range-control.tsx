"use client";

import { Segmented } from "@/components/ui/segmented";
import { RANGE_LABEL, RANGES, type Range } from "@/lib/ranges";

const OPTIONS = RANGES.map((r) => ({ value: r, label: RANGE_LABEL[r] }));

export function DateRangeControl({ value, onChange, className }: { value: Range; onChange: (r: Range) => void; className?: string }) {
  return <Segmented value={value} onChange={onChange} options={OPTIONS} ariaLabel="Date range" className={className} />;
}
