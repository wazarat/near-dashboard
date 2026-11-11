"use client";

import { NONE } from "@/lib/coverage";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { EmptyState } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
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
        <div key={c.sector} className="card-lit flex flex-col rounded-xl border border-ink-700/60 bg-ink-900 p-4 text-sm" data-testid="sector-card">
          {/* The sector name is the way into the sector pop-up; the leaders below open their own projects. */}
          <h4 className="leading-tight">
            <button
              type="button"
              onClick={() => onSelect(c.sector)}
              aria-label={`Open sector ${c.sector}`}
              className="group inline-flex items-start gap-1.5 text-left font-display text-sm font-semibold text-ink-50 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60"
            >
              {c.sector}
              <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-ink-300 group-hover:text-ink-50" aria-hidden="true" />
            </button>
          </h4>
          <dl className="mt-3 grid grid-cols-3 gap-x-3">
            <div className="min-w-0">
              <dt className="text-label text-ink-300">Projects</dt>
              <dd className="tabular font-display text-stat tracking-tight text-ink-50">{c.count}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-label text-ink-300">NEAR-native</dt>
              <dd className="tabular font-display text-stat tracking-tight text-ink-50">{c.native}</dd>
              <dd className="tabular text-label text-ink-300">{fmtPct(c.nativeShare)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-label text-ink-300">With traction</dt>
              <dd className="tabular font-display text-stat tracking-tight text-ink-50">{c.live}</dd>
              <dd className="tabular text-label text-ink-300">{fmtPct(c.count ? c.live / c.count : null)}</dd>
            </div>
          </dl>
          {metric !== "count" && (
            <p className="mt-2 flex items-baseline justify-between gap-3 text-label text-ink-300">
              {METRIC_SHORT[metric]}
              <span className="tabular text-sm text-ink-50" title={fmtMetricFull(metric, c.total)}>
                {fmtMetric(metric, c.total)}
              </span>
            </p>
          )}
          <div className="mt-3 flex-1 border-t border-ink-700/40 pt-3 text-xs">
            <div className="mb-1 text-label text-ink-300">Ranked leaders</div>
            {c.leaders.length === 0 && <div className="text-ink-300">No leaders ranked for this sector.</div>}
            <ol className="space-y-0.5">
              {c.leaders.map((l) => (
                <li key={`${l.rank}-${l.name}`} className="flex items-center gap-1.5">
                  <span className="tabular w-4 shrink-0 text-ink-300">{l.rank}.</span>
                  {l.projectId ? (
                    <button type="button" onClick={() => onOpen(l.projectId as string)} className="truncate text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60" title={l.why}>
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
        </div>
      ))}
    </div>
  );
}
