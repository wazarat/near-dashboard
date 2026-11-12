import { InfoTip } from "@/components/ui/info-tip";
import { meta } from "@/lib/data";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = {
  defillama: "DefiLlama",
  nearblocks: "NearBlocks charts",
  blockscout: "Aurora Blockscout",
  catalog: "NEAR Catalog",
  price: "DefiLlama coins (price)",
  intents: "NEAR Intents Explorer",
  bigquery: "NEAR BigQuery",
};

/** Footer line: when the daily refresh ran, with per-source status behind an InfoTip. The date reads from _meta.json. */
export function DataFreshness({ className }: { className?: string }) {
  const live = meta.live;
  const sources = live ? Object.entries(live.perSource) : [];
  const failing = sources.filter(([, s]) => !s.ok && !s.skipped).length;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-label text-ink-300", className)}>
      <span>
        Data as of {meta.asOfLabel}
        {live ? ", updated daily" : ""}
      </span>
      {failing > 0 && (
        <span className="text-rose-400">
          {failing} {failing === 1 ? "source" : "sources"} failed on the last refresh
        </span>
      )}
      <InfoTip label="About the data refresh" side="top">
        {live ? (
          <div className="space-y-2">
            <p>Daily numbers cover complete UTC days up to {meta.asOfLabel}. The research snapshot (sectors, funding, security) is from {meta.snapshotAsOfLabel}.</p>
            <ul className="space-y-0.5">
              {sources.map(([id, s]) => (
                <li key={id} className="flex justify-between gap-3">
                  <span>{SOURCE_LABEL[id] ?? id}</span>
                  <span className={cn("font-mono", s.ok || s.skipped ? "text-ink-300" : "text-rose-400")}>
                    {s.skipped ? "skipped" : s.ok ? (s.lastSuccess ? `ok ${s.lastSuccess.slice(0, 10)}` : "not run yet") : "failed"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p>Traction metrics come from the {meta.snapshotAsOfLabel} research snapshot. No daily history is loaded in this build.</p>
        )}
      </InfoTip>
    </span>
  );
}
