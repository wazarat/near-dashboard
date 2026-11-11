"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Segmented control from the CanHav design system: two to four exclusive
 * options on a flat track, the active segment a raised ink-900 surface.
 * Replaces toggle groups and hand rolled pills. `role="tablist"` when the
 * segments switch views rather than record a choice. Arrow keys move the
 * choice within a radiogroup.
 */
export interface SegmentedOption<V extends string> {
  value: V;
  label: React.ReactNode;
  disabled?: boolean;
  /** Title attribute, for a disabled reason or a longer label. */
  title?: string;
}

const TRACK = "inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg border border-ink-700/60 bg-ink-950/50 p-0.5 light:bg-ink-800/50";
const ITEM =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60 disabled:cursor-not-allowed disabled:opacity-50";
const ITEM_ON = "border-ink-700/60 bg-ink-900 text-ink-50 shadow-segment";
const ITEM_OFF = "text-ink-300 hover:text-ink-50";
const SIZES = { xs: "h-6 px-2 text-label", sm: "h-7 px-2.5 text-label", md: "h-8 px-3.5 text-control" } as const;

export function Segmented<V extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  role = "radiogroup",
  size = "sm",
  fill = false,
  className,
}: {
  value: V | "";
  onChange?: (value: V) => void;
  options: ReadonlyArray<SegmentedOption<V>>;
  ariaLabel?: string;
  /** "tablist" when the segments switch views rather than record a choice. */
  role?: "radiogroup" | "tablist";
  size?: keyof typeof SIZES;
  /** Stretch the segments to fill the track. */
  fill?: boolean;
  className?: string;
}) {
  const itemRole = role === "tablist" ? "tab" : "radio";
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!onChange || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    const enabled = options.filter((o) => !o.disabled);
    if (enabled.length === 0) return;
    const i = enabled.findIndex((o) => o.value === value);
    const next = e.key === "ArrowRight" ? (i + 1) % enabled.length : (i - 1 + enabled.length) % enabled.length;
    e.preventDefault();
    onChange(enabled[next].value);
  };
  return (
    <div role={role} aria-label={ariaLabel} className={cn(TRACK, fill && "flex w-full", className)} onKeyDown={onKeyDown}>
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role={itemRole}
            aria-checked={itemRole === "radio" ? on : undefined}
            aria-selected={itemRole === "tab" ? on : undefined}
            tabIndex={on || value === "" ? 0 : -1}
            disabled={opt.disabled}
            title={opt.title}
            onClick={() => onChange?.(opt.value)}
            className={cn(ITEM, SIZES[size], on ? ITEM_ON : ITEM_OFF, fill && "flex-1")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
