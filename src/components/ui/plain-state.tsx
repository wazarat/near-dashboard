import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A state written as plain text, the design system's replacement for
 * badges, chips and pills. Label size in ink-300, with any proof in mono
 * ink-500 after it. Colour appears only for a change in value or an error,
 * through `tone`.
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
        tone === "strong" && "text-ink-100",
        tone === "up" && "text-signal-400",
        tone === "down" && "text-rose-400",
        className,
      )}
    >
      {children}
      {proof !== undefined && proof !== null && <span className="font-mono text-ink-500">{proof}</span>}
    </span>
  );
}
