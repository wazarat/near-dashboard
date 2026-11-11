import { NOT_TRACKED, NOT_TRACKED_HELP } from "@/lib/coverage";
import { cn } from "@/lib/utils";

/** A blank metric cell. Quiet label text with the coverage explanation on hover. */
export function NotTracked({ className }: { className?: string }) {
  return (
    <span className={cn("text-label text-ink-300", className)} title={NOT_TRACKED_HELP}>
      {NOT_TRACKED}
    </span>
  );
}
