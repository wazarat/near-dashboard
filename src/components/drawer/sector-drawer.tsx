"use client";

import { ExternalLink } from "lucide-react";
import { ChainChip, TierBadge } from "@/components/atlas/badges";
import { MetricSegmented } from "@/components/atlas/chart-metric";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { leadersBySector, projects as allProjects } from "@/lib/data";
import { useFilters } from "@/lib/filters";
import { displayUrl, fmtMetric, METRIC_SHORT } from "@/lib/format";
import { metricValue, sumMetric } from "@/lib/metrics";

export function SectorDrawer() {
  const { state, setState, openSector, openProject } = useFilters();
  const metric = state.sm;
  const sector = state.sectorDrawer;
  const open = Boolean(sector);
  const leaders = sector ? (leadersBySector.get(sector) ?? []) : [];
  const leaderIds = new Set(leaders.map((l) => l.projectId).filter(Boolean));
  const inSector = sector ? allProjects.filter((p) => p.sector === sector) : [];
  const rest = inSector.filter((p) => !leaderIds.has(p.id)).sort((a, b) => (metricValue(b, metric) ?? -1) - (metricValue(a, metric) ?? -1) || a.name.localeCompare(b.name));
  const native = inSector.filter((p) => p.chain === "NEAR native").length;
  const live = inSector.filter((p) => p.hasTraction).length;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && openSector(null)}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {sector && (
          <>
            <SheetHeader>
              <SheetTitle className="text-xl">{sector}</SheetTitle>
              <SheetDescription>
                {inSector.length} projects, {native} NEAR-native, {live} with any measurable metric
                {metric !== "count" && (
                  <>
                    {", "}
                    {METRIC_SHORT[metric]} {fmtMetric(metric, sumMetric(inSector, metric))}
                  </>
                )}
              </SheetDescription>
              <div className="flex items-center gap-2 pt-1 text-label text-ink-300">
                Order by
                <MetricSegmented value={metric} onChange={(sm) => void setState({ sm })} ariaLabel="Sector drawer metric" />
              </div>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-8">
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ranked leaders</h4>
                {leaders.length === 0 && <p className="text-sm text-muted-foreground">No ranked leaders recorded for this sector.</p>}
                <ol className="space-y-2">
                  {leaders.map((l) => (
                    <li key={`${l.sector}-${l.rank}`} className="rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="tabular text-xs font-semibold text-muted-foreground">#{l.rank}</span>
                        {l.projectId ? (
                          <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => openProject(l.projectId)}>
                            {l.name}
                          </button>
                        ) : (
                          <span className="font-medium">{l.name}</span>
                        )}
                        <span className="text-xs text-muted-foreground">{l.status}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{l.why}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {l.website && (
                          <a href={l.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                            {displayUrl(l.website)} <ExternalLink className="size-3 text-muted-foreground" />
                          </a>
                        )}
                        {l.evidenceUrl && (
                          <a href={l.evidenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:underline">
                            Evidence <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
              <Separator />
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">All other projects ({rest.length})</h4>
                <ul className="divide-y rounded-md border">
                  {rest.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => openProject(p.id)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium">{p.name}</span>
                          <ChainChip chain={p.chain} />
                          <TierBadge tier={p.tier} className="hidden sm:inline-flex" />
                        </span>
                        <span className="tabular shrink-0 text-xs text-muted-foreground">{metric === "count" ? p.statusGroup : fmtMetric(metric, p[metric])}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
