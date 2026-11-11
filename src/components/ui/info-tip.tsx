"use client";

import { Info } from "lucide-react";
import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Info icon that opens a small popover, the home of any helper copy longer
 * than one line (CanHav design system). Click or Enter opens; Escape and an
 * outside click close. Radix handles placement so the popover never leaves
 * the viewport.
 */
export function InfoTip({
  children,
  title,
  label = "More about this",
  side = "top",
  align = "start",
  className,
}: {
  children: React.ReactNode;
  title?: string;
  /** Accessible name of the icon button. */
  label?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex size-5 shrink-0 items-center justify-center rounded-md align-middle text-ink-300 transition-colors hover:bg-ink-800/60 hover:text-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60 data-[state=open]:text-ink-50",
            className,
          )}
        >
          <Info aria-hidden className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={6}
        onClick={(e) => e.stopPropagation()}
        className="w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-ink-700/60 bg-ink-900 p-3 text-left text-xs font-normal leading-relaxed text-ink-300 shadow-popover"
      >
        {title && <p className="mb-1 font-medium text-ink-50">{title}</p>}
        {children}
      </PopoverContent>
    </Popover>
  );
}
