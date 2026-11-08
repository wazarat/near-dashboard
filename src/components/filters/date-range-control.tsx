"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RANGE_LABEL, RANGES, type Range } from "@/lib/ranges";

export function DateRangeControl({ value, onChange, className }: { value: Range; onChange: (r: Range) => void; className?: string }) {
  return (
    <ToggleGroup type="single" size="sm" variant="outline" value={value} onValueChange={(v) => v && onChange(v as Range)} aria-label="Date range" className={className}>
      {RANGES.map((r) => (
        <ToggleGroupItem key={r} value={r} className="h-8 px-2.5 text-xs">
          {RANGE_LABEL[r]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
