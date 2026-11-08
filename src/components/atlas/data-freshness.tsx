import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { meta } from "@/lib/data";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = {
  defillama: "DefiLlama",
  nearblocks: "NearBlocks charts",
  catalog: "NEAR Catalog",
  price: "DefiLlama coins (price)",
  intents: "NEAR Intents Explorer",
  bigquery: "NEAR BigQuery",
};

/** Header badge: when the daily refresh ran, with per-source status on hover. */
export function DataFreshness({ className }: { className?: string }) {
  const live = meta.live;
  const sources = live ? Object.entries(live.perSource) : [];
  const failing = sources.filter(([, s]) => !s.ok && !s.skipped).length;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex cursor-default items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground", className)}>
          Data as of {meta.asOfLabel}
          {live && <span className="hidden text-muted-foreground/80 md:inline">· updated daily</span>}
          {failing > 0 && (
            <span className="rounded bg-[var(--status-warning)]/20 px-1 text-[10px] font-semibold text-foreground" title={`${failing} sources failed on the last refresh`}>
              {failing} stale
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
        {live ? (
          <div className="space-y-1">
            <p>Daily numbers cover complete UTC days up to {meta.asOfLabel}. The research snapshot (sectors, funding, security) is from {meta.snapshotAsOfLabel}.</p>
            <ul className="space-y-0.5">
              {sources.map(([id, s]) => (
                <li key={id} className="flex justify-between gap-3">
                  <span>{SOURCE_LABEL[id] ?? id}</span>
                  <span className={cn(s.ok ? "text-muted-foreground" : "font-medium")}>{s.skipped ? "skipped" : s.ok ? (s.lastSuccess ? `ok · ${s.lastSuccess.slice(0, 10)}` : "not run yet") : "failed"}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p>Traction metrics come from the {meta.snapshotAsOfLabel} research snapshot. No daily history is loaded in this build.</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
