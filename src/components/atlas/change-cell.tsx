import { NotTracked } from "@/components/atlas/not-tracked";
import { fmtPctSigned } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Signed percent change with a direction glyph, so colour is never the only cue. */
export function ChangeCell({ value, digits = 1, className, label }: { value: number | null | undefined; digits?: number; className?: string; label?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <NotTracked className={className} />;
  const pct = value * 100;
  const flat = Math.abs(pct) < 0.05;
  const up = pct > 0;
  return (
    <span
      className={cn("tabular inline-flex items-center gap-0.5 whitespace-nowrap", flat && "text-ink-300", className)}
      style={flat ? undefined : { color: up ? "var(--status-good)" : "var(--status-critical)" }}
      aria-label={`${label ? `${label} ` : ""}${flat ? "flat" : up ? "up" : "down"} ${Math.abs(pct).toFixed(digits)} percent`}
    >
      <span aria-hidden="true" className="text-[10px]">
        {flat ? "·" : up ? "▲" : "▼"}
      </span>
      {fmtPctSigned(value, digits)}
    </span>
  );
}
