import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A state written as plain text, the design system's replacement for
 * badges, chips and pills. Label size in ink-300, with any proof in mono
 * after it in the same tone (the standard allows two text tones, ink-50 and
 * ink-300). Colour appears only for a change in value or an error, through
 * `tone`.
 */
export function PlainState({
  children,
  proof,
  tone = "neutral",
  title,
  className,
}: {
  children: React.ReactNode;
  /** Mono detail after the state, for a hash, a date or a source. */
  proof?: React.ReactNode;
  tone?: "neutral" | "strong" | "up" | "down";
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-baseline gap-1.5 whitespace-nowrap text-label",
        tone === "neutral" && "text-ink-300",
        tone === "strong" && "text-ink-50",
        tone === "up" && "text-signal-400",
        tone === "down" && "text-rose-400",
        className,
      )}
    >
      {children}
      {proof !== undefined && proof !== null && <span className="font-mono text-ink-300">{proof}</span>}
    </span>
  );
}
