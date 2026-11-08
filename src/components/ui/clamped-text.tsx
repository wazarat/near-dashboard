"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Long text in a table cell (standard section 11): wraps, clamps at three
 * lines and offers "Show more". The toggle appears for text that is long
 * enough to need it at the cell's width, so no layout measurement is needed.
 */
export function ClampedText({ text, lines = 3, maxWidth = "max-w-sm", threshold = 150, className }: { text: string; lines?: 2 | 3 | 4; maxWidth?: string; threshold?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > threshold;
  const clamp = lines === 2 ? "line-clamp-2" : lines === 4 ? "line-clamp-4" : "line-clamp-3";
  return (
    <span className={cn("block whitespace-normal break-words", maxWidth, className)}>
      <span className={cn(!open && long && clamp)}>{text}</span>
      {long && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          className="mt-0.5 block text-label text-electric-400 hover:text-electric-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60"
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </span>
  );
}
