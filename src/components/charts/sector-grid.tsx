"use client";

import { NONE } from "@/lib/coverage";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { EmptyState } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { Button } from "@/components/ui/button";
import { leadersBySector } from "@/lib/data";
import { fmtMetric, fmtMetricFull, fmtPct, METRIC_SHORT } from "@/lib/format";
import { sumMetric } from "@/lib/metrics";
import type { Leader, MetricKey, Project } from "@/lib/types";

export interface SectorCard {
  [key: string]: unknown;
  sector: string;
  count: number;
  live: number;
  native: number;
  nativeShare: number | null;
  total: number | null;
  /** Ranked leaders for the sector from the research CSV, independent of the filters. */
  leaders: Leader[];
}

export function sectorCards(projects: Project[], metric: MetricKey): SectorCard[] {
  const sectors = Array.from(new Set(projects.map((p) => p.sector)));
  return sectors
    .map((s) => {
      const inS = projects.filter((p) => p.sector === s);
      const native = inS.filter((p) => p.chain === "NEAR native").length;
      return {
        sector: s,
        count: inS.length,
        live: inS.filter((p) => p.hasTraction).length,
        native,
        nativeShare: inS.length ? native / inS.length : null,
        total: sumMetric(inS, metric),
        leaders: (leadersBySector.get(s) ?? []).slice(0, 3),
      };
    })
    .sort((a, b) => (b.total ?? -1) - (a.total ?? -1) || b.count - a.count || a.sector.localeCompare(b.sector));
}

export function sectorCardTable(cards: SectorCard[], metric: MetricKey): ChartTableSpec {
  return {
    caption: "Sector summary",
    filename: "sector-cards.csv",
    columns: [
      { key: "sector", label: "Sector" },
      { key: "count", label: "Projects", align: "right" },
      { key: "live", label: "With traction", align: "right" },
      { key: "nativeShare", label: "NEAR-native share", align: "right", format: (v) => fmtPct(v as number | null) },
      { key: "total", label: METRIC_SHORT[metric], align: "right", format: (v) => fmtMetricFull(metric, v as number | null) },
      { key: "top", label: "Top leaders" },
    ],
    rows: cards.map((c) => ({ ...c, top: c.leaders.map((l) => `${l.rank}. ${l.name}`).join("; ") || NONE })),
  };
}

interface Props {
  projects: Project[];
  metric: MetricKey;
  onSelect: (sector: string) => void;
  onOpen: (id: string) => void;
}

export function SectorGrid({ projects, metric, onSelect, onOpen }: Props) {
  const cards = useMemo(() => sectorCards(projects, metric), [projects, metric]);

  if (cards.length === 0) return <EmptyState />;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((c) => (
        <div key={c.sector} className="flex flex-col rounded-lg border bg-card p-3 text-sm">
          <h4 className="font-semibold leading-tight">{c.sector}</h4>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-ink-300">Projects</dt>
            <dd className="tabular text-right">{c.count}</dd>
            <dt className="text-ink-300">NEAR-native</dt>
            <dd className="tabular text-right">
              {c.native} <span className="text-ink-300">({fmtPct(c.nativeShare)})</span>
            </dd>
            <dt className="text-ink-300">With traction</dt>
            <dd className="tabular text-right">
              {c.live} <span className="text-ink-300">({fmtPct(c.count ? c.live / c.count : null)})</span>
            </dd>
            {metric !== "count" && (
              <>
                <dt className="text-ink-300">{METRIC_SHORT[metric]}</dt>
                <dd className="tabular text-right" title={fmtMetricFull(metric, c.total)}>
                  {fmtMetric(metric, c.total)}
                </dd>
              </>
            )}
          </dl>
          <div className="mt-2 flex-1 border-t pt-2 text-xs">
            <div className="mb-1 text-ink-300">Ranked leaders</div>
            {c.leaders.length === 0 && <div className="text-ink-300">No leaders ranked for this sector.</div>}
            <ol className="space-y-0.5">
              {c.leaders.map((l) => (
                <li key={`${l.rank}-${l.name}`} className="flex items-center gap-1.5">
                  <span className="tabular w-4 shrink-0 text-ink-300">{l.rank}.</span>
                  {l.projectId ? (
                    <button type="button" onClick={() => onOpen(l.projectId as string)} className="truncate text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title={l.why}>
                      {l.name}
                    </button>
                  ) : (
                    <span className="truncate" title={l.why}>
                      {l.name}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
          <Button variant="outline" size="sm" className="mt-3 h-7 w-full justify-between text-xs" onClick={() => onSelect(c.sector)} aria-label={`Open sector ${c.sector}`}>
            Open sector <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      ))}
    </div>
  );
}
