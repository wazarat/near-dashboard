"use client";

import { ExternalLink } from "lucide-react";
import { AtlasModal } from "@/components/atlas/atlas-modal";
import { LoginPanel } from "@/components/auth/login-dialog";
import { ChainChip, TierBadge } from "@/components/atlas/badges";
import { ScopeNote } from "@/components/atlas/chart-card";
import { MetricSegmented } from "@/components/atlas/chart-metric";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAccess } from "@/lib/access";
import { leadersBySector, projects as allProjects } from "@/lib/data";
import { useFilters } from "@/lib/filters";
import { displayUrl, fmtMetric, METRIC_SHORT } from "@/lib/format";
import { metricValue, sumMetric } from "@/lib/metrics";

/**
 * A sector's ranked leaders and its other projects as a centred modal (docs/ATLAS-UI.md, section 3),
 * opened by ?sectorDrawer=<sector>. It follows the active filters and says so, like every filtered card.
 * Opening a project from here replaces this modal rather than stacking a second one.
 */
export function SectorModal() {
  const { state, setState, openSector, filtered, activeCount } = useFilters();
  const metric = state.sm;
  // Logged out, a shared sector link shows the title and the summary line; the lists sit behind one login panel.
  const full = useAccess().can({ action: "sector-detail" });
  const sector = state.sectorDrawer;
  const open = Boolean(sector);
  const scope = activeCount > 0 ? filtered : allProjects;
  const inScope = new Set(scope.map((p) => p.id));
  const openProject = (id: string | null) => void setState({ sectorDrawer: null, project: id });
  const leaders = sector ? (leadersBySector.get(sector) ?? []).filter((l) => activeCount === 0 || (l.projectId !== null && inScope.has(l.projectId))) : [];
  const leaderIds = new Set(leaders.map((l) => l.projectId).filter(Boolean));
  const inSector = sector ? scope.filter((p) => p.sector === sector) : [];
  const rest = inSector.filter((p) => !leaderIds.has(p.id)).sort((a, b) => (metricValue(b, metric) ?? -1) - (metricValue(a, metric) ?? -1) || a.name.localeCompare(b.name));
  const native = inSector.filter((p) => p.chain === "NEAR native").length;
  const live = inSector.filter((p) => p.hasTraction).length;

  return (
    <AtlasModal open={open} onOpenChange={(o) => !o && openSector(null)} testId="sector-modal" width="narrow">
      {sector && (
        <div className="space-y-5">
          <header className="space-y-2 pr-8">
            <DialogTitle className="font-display text-title text-ink-50">{sector}</DialogTitle>
            <DialogDescription>
              {inSector.length} projects, {native} NEAR-native, {live} with any measurable metric
              {metric !== "count" && (
                <>
                  {", "}
                  {METRIC_SHORT[metric]} {fmtMetric(metric, sumMetric(inSector, metric))}
                </>
              )}
            </DialogDescription>
            <ScopeNote className="block" />
            <div className="flex items-center gap-2 pt-1 text-label text-ink-300">
              Order by
              <MetricSegmented value={metric} onChange={(sm) => void setState({ sm })} ariaLabel="Sector pop-up metric" />
            </div>
          </header>
          {!full && <LoginPanel trigger="sector" />}
          {full && (
          <>
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-300">Ranked leaders</h4>
            {leaders.length === 0 && <p className="text-sm text-ink-300">No ranked leaders recorded for this sector.</p>}
            <ol className="space-y-2">
              {leaders.map((l) => (
                <li key={`${l.sector}-${l.rank}`} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular text-xs font-semibold text-ink-300">#{l.rank}</span>
                    {l.projectId ? (
                      <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => openProject(l.projectId)}>
                        {l.name}
                      </button>
                    ) : (
                      <span className="font-medium">{l.name}</span>
                    )}
                    <span className="text-xs text-ink-300">{l.status}</span>
                  </div>
                  <p className="mt-1 text-ink-300">{l.why}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {l.website && (
                      <a href={l.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                        {displayUrl(l.website)} <ExternalLink className="size-3 text-ink-300" />
                      </a>
                    )}
                    {l.evidenceUrl && (
                      <a href={l.evidenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink-300 underline-offset-2 hover:underline">
                        Evidence <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-300">All other projects ({rest.length})</h4>
            <ul className="divide-y rounded-md border">
              {rest.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => openProject(p.id)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{p.name}</span>
                      <ChainChip chain={p.chain} />
                      <TierBadge tier={p.tier} className="hidden sm:inline-flex" />
                    </span>
                    <span className="tabular shrink-0 text-xs text-ink-300">{metric === "count" ? p.statusGroup : fmtMetric(metric, p[metric])}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          </>
          )}
        </div>
      )}
    </AtlasModal>
  );
}
