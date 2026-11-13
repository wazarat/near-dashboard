import { CircleCheck, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { VERDICT_LABEL, type Supported } from "@/lib/verdict";

const META: Record<Supported, { label: string; className: string; Icon: LucideIcon }> = {
  yes: { label: VERDICT_LABEL.yes, className: "text-signal-400", Icon: CircleCheck },
  partly: { label: VERDICT_LABEL.partly, className: "text-ink-50", Icon: TriangleAlert },
  no: { label: VERDICT_LABEL.no, className: "text-rose-400", Icon: OctagonAlert },
};

/** The verdict as plain text with an outline icon. Colour sits on the word only when the claim is met or fails. */
export function VerdictBadge({ supported, className }: { supported: Supported; className?: string }) {
  const m = META[supported];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold", m.className, className)} data-verdict={supported}>
      <m.Icon aria-hidden="true" className="size-4 shrink-0" />
      {m.label}
    </span>
  );
}
