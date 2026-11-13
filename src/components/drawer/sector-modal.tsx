"use client";

import { ExternalLink } from "lucide-react";
import { AtlasModal } from "@/components/atlas/atlas-modal";
import { LoginPanel } from "@/components/auth/login-dialog";
import { ChainChip } from "@/components/atlas/badges";
import { ScopeNote } from "@/components/atlas/chart-card";
import { LegacySwitch } from "@/components/atlas/legacy-switch";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { InfoTip } from "@/components/ui/info-tip";
import { useAccess } from "@/lib/access";
import { leadersBySector } from "@/lib/data";
import { useFilters } from "@/lib/filters";
import { displayUrl, fmtPct } from "@/lib/format";
import {
  fmtMetricValue,
  LEADER_FLOOR,
  METRIC_DEFS,
  metricLabel,
  metricOf,
  rankLeaders,
  sectorDef,
  sectorMetricTotal,
  sectorProjects,
  type MetricId,
  type RankedLeader,
  type SectorMetricTotal,
} from "@/lib/sector-metrics";
import type { Leader, Project } from "@/lib/types";

/** A total as text: the sum where values add up, otherwise the largest single value and whose it is. */
function totalText(t: SectorMetricTotal): string {
  if (t.total !== null) return fmtMetricValue(t.id, t.total);
  if (t.top) return `${fmtMetricValue(t.id, t.top.value)} at ${t.top.project.name}, the largest`;
  return "Not tracked";
}

/** "Tracked for X of Y where it applies", or for a fact any project can carry, how many carry it. */
function coverageText(sector: string, t: SectorMetricTotal, set: Project[]): string {
  if (sectorDef(sector).metrics.includes(t.id)) return `Tracked for ${t.tracked} of ${t.applies} where it applies`;
  const n = set.filter((p) => metricOf(p, t.id) !== null).length;
  return `Tracked for ${n} of ${set.length}`;
}

function totalInfo(sector: string, id: MetricId, t: SectorMetricTotal): string {
  const how = t.total !== null ? "Summed over the sector's active projects in the selection." : "Values overlap across projects or do not add up, so the largest one is shown instead of a sum.";
  const note = sectorDef(sector).headline === id && sectorDef(sector).note ? ` ${sectorDef(sector).note}` : "";
  return `${METRIC_DEFS[id].info} ${how} Defunct and Inactive projects are left out.${note}`;
}

function MetricTable({ sector, ids, set, scope }: { sector: string; ids: MetricId[]; set: Project[]; scope: Project[] }) {
  const rows = ids.map((id) => sectorMetricTotal(sector, scope, id)).filter((t) => !sectorDef(sector).metrics.includes(t.id) || t.applies > 0);
  if (rows.length === 0) return null;
  return (
    <dl className="divide-y rounded-md border" data-testid="sector-metrics">
      {rows.map((t) => (
        <div key={t.id} className="grid grid-cols-1 gap-x-4 gap-y-0.5 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto]" data-testid="sector-metric-row" data-metric={t.id}>
          <dt className="inline-flex items-start gap-1 text-ink-300">
            <span>{metricLabel(sector, t.id)}</span>
            <InfoTip label={`About ${metricLabel(sector, t.id)}`}>{totalInfo(sector, t.id, t)}</InfoTip>
          </dt>
          <dd className="sm:text-right">
            <span className="tabular text-ink-50">{totalText(t)}</span>
            <span className="block text-xs text-ink-300">{coverageText(sector, t, set)}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** What a leader row shows on the right: its ranking value, Not tracked for a measured sector, otherwise its role. */
function leaderValue(sector: string, l: RankedLeader): string {
  const def = sectorDef(sector);
  if (l.key) return fmtMetricValue(l.key, l.value);
  if (def.headline) {
    const v = metricOf(l.project, def.headline);
    return v === null ? "Not tracked" : fmtMetricValue(def.headline, v);
  }
  return l.project.subcategory ?? "";
}

function LeaderRow({ sector, l, i, curated, onOpen }: { sector: string; l: RankedLeader; i: number; curated: Leader | undefined; onOpen: (id: string) => void }) {
  return (
    <li className="px-3 py-2 text-sm" data-testid="sector-leader" data-basis={l.basis}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="tabular w-6 shrink-0 text-xs text-ink-300">{i + 1}.</span>
          <button type="button" className="truncate text-left font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onOpen(l.project.id)}>
            {l.project.name}
          </button>
          <ChainChip chain={l.project.chain} className="hidden sm:inline-flex" />
        </span>
        <span className="tabular shrink-0 text-right text-xs text-ink-300">{leaderValue(sector, l)}</span>
      </div>
      {curated && (
        <div className="mt-1 pl-8 text-xs text-ink-300">
          <p>{curated.why}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {curated.website && (
              <a href={curated.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                {displayUrl(curated.website)} <ExternalLink className="size-3" />
              </a>
            )}
            {curated.evidenceUrl && (
              <a href={curated.evidenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                Evidence <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * A sector's numbers and its full ranked leaders as a centred modal (docs/SECTOR-METRICS.md, section 1c), opened by
 * ?sectorDrawer=<sector>. The cards carry only counts and names; the headline total, the other metrics and every
 * leader's value live here. It follows the active filters and says so. Opening a project replaces this modal.
 */
export function SectorModal() {
  const { state, setState, openSector, projectsFor, legacyOn } = useFilters();
  const legacy = legacyOn("sector-modal");
  const scope = projectsFor("sector-modal");
  // Logged out, a shared sector link shows the title and the summary line; the numbers sit behind one login panel.
  const full = useAccess().can({ action: "sector-detail" });
  const sector = state.sectorDrawer;
  const open = Boolean(sector);
  const openProject = (id: string) => void setState({ sectorDrawer: null, project: id });

  const def = sector ? sectorDef(sector) : null;
  const inSector = sector ? scope.filter((p) => p.sector === sector) : [];
  const set = sector ? sectorProjects(sector, scope) : [];
  const native = inSector.filter((p) => p.chain === "NEAR native").length;
  const leaders = sector ? rankLeaders(sector, scope) : [];
  const curatedById = new Map((sector ? (leadersBySector.get(sector) ?? []) : []).filter((l) => l.projectId).map((l) => [l.projectId as string, l]));
  const left = inSector.length - set.length;
  const headline = def?.headline ?? null;
  const headTotal = sector && headline ? sectorMetricTotal(sector, scope, headline) : null;
  const otherIds = def ? (headline ? def.metrics.filter((id) => id !== headline) : Array.from(new Set([...(def.rankBy ?? []), ...def.metrics]))) : [];

  return (
    <AtlasModal open={open} onOpenChange={(o) => !o && openSector(null)} testId="sector-modal" width="narrow">
      {sector && def && (
        <div className="space-y-5">
          <header className="space-y-2 pr-8">
            <DialogTitle className="font-display text-title text-ink-50">{sector}</DialogTitle>
            <DialogDescription>
              {inSector.length} projects, {native} NEAR-native ({fmtPct(inSector.length ? native / inSector.length : null)})
              {left > 0 ? `, ${left} defunct or inactive and left out of the numbers and leaders` : ""}
            </DialogDescription>
            <ScopeNote className="block" legacy={legacy} />
            <div className="pt-1 text-label text-ink-300">
              <LegacySwitch card="sector-modal" label="the sector pop-up" />
            </div>
          </header>
          {!full && <LoginPanel trigger="sector" />}
          {full && (
            <>
              {headline && headTotal && (
                <section className="space-y-1 rounded-md border p-3" data-testid="sector-headline">
                  <h4 className="inline-flex items-start gap-1 text-label text-ink-300">
                    <span>{metricLabel(sector, headline)}</span>
                    <InfoTip label={`About ${metricLabel(sector, headline)}`}>{`The headline metric for ${sector}, which ranks its leaders. ${totalInfo(sector, headline, headTotal)}`}</InfoTip>
                  </h4>
                  <p className="tabular font-display text-stat tracking-tight text-ink-50">{totalText(headTotal)}</p>
                  <p className="text-xs text-ink-300">{coverageText(sector, headTotal, set)}</p>
                </section>
              )}
              {otherIds.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-300">{headline ? "Other metrics" : "Facts"}</h4>
                  <MetricTable sector={sector} ids={otherIds} set={set} scope={scope} />
                </section>
              )}
              {!headline && otherIds.length === 0 && <p className="text-sm text-ink-300">{sector} has no traction headline, so its projects are described by their role.</p>}
              <section className="space-y-2">
                <h4 className="inline-flex items-start gap-1 text-xs font-semibold uppercase tracking-wide text-ink-300">
                  <span>Sector leaders ({leaders.length})</span>
                  <InfoTip label="How leaders are ranked">{`Active projects whose ${headline ? "headline metric" : "ranking fact"} is at least ${fmtPct(LEADER_FLOOR)} of the sector's top value come first, highest first. The rest follow by research rank, then by name. Defunct and Inactive projects are left out.`}</InfoTip>
                </h4>
                {leaders.length === 0 && <p className="text-sm text-ink-300">No active projects in this selection.</p>}
                <ol className="divide-y rounded-md border">
                  {leaders.map((l, i) => (
                    <LeaderRow key={l.project.id} sector={sector} l={l} i={i} curated={curatedById.get(l.project.id)} onOpen={openProject} />
                  ))}
                </ol>
              </section>
            </>
          )}
        </div>
      )}
    </AtlasModal>
  );
}
