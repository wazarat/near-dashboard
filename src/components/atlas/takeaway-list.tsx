import type { Takeaway } from "@/lib/takeaways";
import { cn } from "@/lib/utils";

/** The takeaway in a card's expanded view: short points under the chart (standard section 6). */
export function TakeawayList({ takeaway, className }: { takeaway: Takeaway; className?: string }) {
  if (takeaway.points.length === 0) return null;
  return (
    <ul className={cn("space-y-1 text-body text-ink-300", className)} data-testid="takeaway">
      {takeaway.points.map((p) => (
        <li key={p} className="flex gap-2">
          <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-ink-400" />
          <span>{p}</span>
        </li>
      ))}
    </ul>
  );
}
