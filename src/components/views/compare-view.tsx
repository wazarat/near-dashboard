"use client";

import { AlertTriangle, X } from "lucide-react";
import { useMemo } from "react";
import { TierBadge } from "@/components/atlas/badges";
import { NumericMetricSegmented } from "@/components/atlas/chart-metric";
import { AddProjectPopover, PresetChips, TopProjectButtons } from "@/components/compare/add-project";
import { CompareOverlay } from "@/components/compare/compare-overlay";
import { MetricMatrix } from "@/components/compare/metric-matrix";
import { ProfileGrid } from "@/components/compare/profile-grid";
import { RatiosTable } from "@/components/compare/ratios-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CAT } from "@/lib/colors";
import { COMPARE_MAX, compareSentences, crossSector, numericMetric, useCompare } from "@/lib/compare";
import { useFilters } from "@/lib/filters";
import { METRIC_LABEL } from "@/lib/format";
import { topN } from "@/lib/metrics";

/** Compare page: up to four projects side by side, selection carried in the URL. */
export function CompareView() {
  const { ids, projects, add, remove, set, clear, isFull } = useCompare();
  const { all, rangeOf, setRange, state, setState, openProject } = useFilters();
  const metric = state.cm;
  const m = numericMetric(metric);
  const metricControl = <NumericMetricSegmented value={m} onChange={(cm) => void setState({ cm })} ariaLabel="Compare metric" />;
  const sectors = useMemo(() => crossSector(projects), [projects]);
  const sentences = useMemo(() => compareSentences(projects, metric), [projects, metric]);
  const top = useMemo(() => topN(all, m, 6), [all, m]);

  if (projects.length === 0) {
    return (
      <Card className="gap-3 py-4" data-chart-card="Compare">
        <CardHeader className="px-4">
          <h3 className="text-sm font-semibold">Compare projects</h3>
          <p className="text-sm text-ink-300">
            Put up to {COMPARE_MAX} projects side by side. Each metric with its rank and share inside the project&apos;s own sector, ratios that remove size, indexed trends from DefiLlama daily history, and the funding, token, chain and security profile. Add projects here, from any project pop-up, or with a preset. The selection
            sits in the URL, so the comparison can be shared as a link.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 px-4">
          <PresetChips all={all} onApply={set} />
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-ink-300">Or start from the largest by {METRIC_LABEL[m].toLowerCase()}</p>
              {metricControl}
            </div>
            <TopProjectButtons projects={top} metric={m} onAdd={add} />
          </div>
          <AddProjectPopover all={all} exclude={ids} onAdd={add} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="gap-3 py-4" data-chart-card="Compare">
        <CardHeader className="gap-3 px-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="sr-only">Compare projects</h3>
            {projects.map((p, i) => (
              <span key={p.id} className="inline-flex max-w-full items-center gap-1.5 rounded-md border py-1 pl-2 pr-1 text-sm" style={{ borderLeftWidth: 3, borderLeftColor: CAT[i] }}>
                <button type="button" onClick={() => openProject(p.id)} className="truncate font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {p.name}
                </button>
                <TierBadge tier={p.tier} className="hidden sm:inline-flex" />
                <button type="button" onClick={() => remove(p.id)} aria-label={`Remove ${p.name} from compare`} className="rounded text-ink-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            <AddProjectPopover all={all} exclude={ids} onAdd={add} disabled={isFull} />
            {projects.length > 1 && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clear}>
                Clear
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PresetChips all={all} onApply={set} />
            <label className="flex items-center gap-2 text-label text-ink-300">
              Metric for ratios and trends
              {metricControl}
            </label>
          </div>
          {projects.length === 1 && <p className="text-sm text-ink-300">Add at least one more project to see ranks, ratios and sentences.</p>}
          {sectors.length > 1 && (
            <p className="flex items-start gap-2 rounded-md border px-3 py-2 text-xs" style={{ borderColor: "var(--status-warning)" }} role="note">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" style={{ color: "var(--status-warning)" }} aria-hidden="true" />
              <span>
                These projects span {sectors.length} sectors ({sectors.join(", ")}). Ranks and shares are computed inside each project&apos;s own sector, and the business models differ, so read the ratios as context rather than a league table.
              </span>
            </p>
          )}
          {sentences.length > 0 && (
            <ul className="space-y-1 text-sm" aria-label="Generated summary">
              {sentences.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </CardHeader>
      </Card>

      <MetricMatrix projects={projects} all={all} />
      <RatiosTable projects={projects} metric={metric} />
      <CompareOverlay projects={projects} metric={metric} range={rangeOf("xr")} onRangeChange={(r) => setRange("xr", r)} align={state.align} onAlignChange={(align) => void setState({ align })} />
      <ProfileGrid projects={projects} onOpen={openProject} />
    </div>
  );
}
