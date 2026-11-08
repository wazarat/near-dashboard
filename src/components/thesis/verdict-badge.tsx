import { CircleCheck, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ThesisJson } from "@/lib/thesis-types";
import { cn } from "@/lib/utils";

type Supported = ThesisJson["verdict"]["supported"];

const META: Record<Supported, { label: string; color: string; Icon: LucideIcon }> = {
  yes: { label: "Supported", color: "var(--status-good)", Icon: CircleCheck },
  partly: { label: "Partly supported", color: "var(--status-warning)", Icon: TriangleAlert },
  no: { label: "Not supported", color: "var(--status-critical)", Icon: OctagonAlert },
};

/** Verdict pill: status colour plus icon plus the word, so the state is never colour alone. */
export function VerdictBadge({ supported, className }: { supported: Supported; className?: string }) {
  const m = META[supported];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold text-foreground", className)}
      style={{ borderColor: m.color, backgroundColor: `color-mix(in oklab, ${m.color} 12%, transparent)` }}
      data-verdict={supported}
    >
      <m.Icon aria-hidden="true" className="size-3.5 shrink-0" style={{ color: m.color }} />
      {m.label}
    </span>
  );
}
