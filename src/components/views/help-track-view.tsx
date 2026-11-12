"use client";

import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { projects } from "@/lib/data";
import { TALLY_CORRECT_URL, tallyCorrectUrl, SITE_URL } from "@/lib/env";
import { LEGACY_GROUP, useFilters } from "@/lib/filters";
import { METRIC_DEFS, METRIC_IDS, valueState, type MetricId } from "@/lib/sector-metrics";

/** Every measured-sector project whose metric applies but has no source yet, grouped by the missing metric. Legacy listings are left out. */
export function notTrackedByMetric(list = projects): Array<{ id: MetricId; projects: Array<{ id: string; name: string; sector: string }> }> {
  const groups = new Map<MetricId, Array<{ id: string; name: string; sector: string }>>();
  for (const p of list) {
    if (p.statusGroup === LEGACY_GROUP) continue;
    for (const id of METRIC_IDS) {
      if (valueState(p, id).state !== "not-tracked") continue;
      const g = groups.get(id) ?? [];
      g.push({ id: p.id, name: p.name, sector: p.sector });
      groups.set(id, g);
    }
  }
  return METRIC_IDS.filter((id) => groups.has(id)).map((id) => ({ id, projects: (groups.get(id) ?? []).sort((a, b) => a.name.localeCompare(b.name)) }));
}

/**
 * "Help us track this" (docs/LIVE-DATA.md, requirement 9): a public list of the projects whose metric applies
 * but no source covers yet, grouped by that metric, each with a link to the correction form pre-filled with
 * its name. Open to every reader, like the methodology.
 */
export function HelpTrackView() {
  const groups = useMemo(() => notTrackedByMetric(), []);
  const { openProject } = useFilters();
  const total = new Set(groups.flatMap((g) => g.projects.map((p) => p.id))).size;

  return (
    <div className="space-y-4">
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <h1 className="font-display text-title text-ink-50">Help us track this</h1>
          <p className="text-sm text-ink-300">
            {total} projects in sectors with a traction headline have at least one metric that applies to them but that no free source covers yet. They read Not tracked on the site, never zero. If you know where a figure is published, send it through the correction form and it can be added with its source.
          </p>
        </CardHeader>
      </Card>
      {groups.map((g) => (
        <Card key={g.id} className="gap-3 py-4" data-testid="help-track-group">
          <CardHeader className="px-4">
            <h2 className="inline-flex items-center gap-1 text-sm font-semibold">
              {METRIC_DEFS[g.id].label}
              <InfoTip label={`About ${METRIC_DEFS[g.id].label}`}>{METRIC_DEFS[g.id].info}</InfoTip>
            </h2>
            <p className="text-label text-ink-300">
              {g.projects.length} {g.projects.length === 1 ? "project" : "projects"}
            </p>
          </CardHeader>
          <CardContent className="px-4">
            <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 xl:grid-cols-3">
              {g.projects.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-3 border-b border-ink-700/40 py-1">
                  <button type="button" onClick={() => openProject(p.id)} className="min-w-0 truncate text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60">
                    {p.name}
                  </button>
                  {TALLY_CORRECT_URL ? (
                    <a href={tallyCorrectUrl(TALLY_CORRECT_URL, p.name, `${SITE_URL}/help-track/`)} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-label text-ink-300 underline-offset-2 hover:text-ink-50 hover:underline">
                      Suggest a source <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span className="shrink-0 text-label text-ink-300">{p.sector}</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
