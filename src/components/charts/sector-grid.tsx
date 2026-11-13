"use client";

import { NONE } from "@/lib/coverage";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { EmptyState } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { fmtPct } from "@/lib/format";
import { topLeaders, type RankedLeader } from "@/lib/sector-metrics";
import type { Project } from "@/lib/types";

export interface SectorCard {
  [key: string]: unknown;
  sector: string;
  count: number;
  native: number;
  nativeShare: number | null;
  /** The top three by the one ranking rule (src/lib/sector-metrics.ts rankLeaders), over the filtered projects. */
  leaders: RankedLeader[];
}

/** NEAR-native as a count with its share, e.g. "28 (50%)". */
export function fmtNative(c: Pick<SectorCard, "native" | "nativeShare">): string {
  return `${c.native} (${fmtPct(c.nativeShare)})`;
}

/** One card per sector with projects, ordered by project count and then name. Cards carry no money or traction figures. */
export function sectorCards(projects: Project[]): SectorCard[] {
  const sectors = Array.from(new Set(projects.map((p) => p.sector)));
  return sectors
    .map((s) => {
      const inS = projects.filter((p) => p.sector === s);
      const native = inS.filter((p) => p.chain === "NEAR native").length;
      return {
        sector: s,
        count: inS.length,
        native,
        nativeShare: inS.length ? native / inS.length : null,
        leaders: topLeaders(s, projects),
      };
    })
    .sort((a, b) => b.count - a.count || a.sector.localeCompare(b.sector));
}

export function sectorCardTable(cards: SectorCard[]): ChartTableSpec {
  return {
    caption: "Sector summary",
    filename: "sector-cards.csv",
    columns: [
      { key: "sector", label: "Sector" },
      { key: "count", label: "Projects", align: "right" },
      { key: "native", label: "NEAR-native", align: "right" },
      { key: "nativeShare", label: "NEAR-native share", align: "right", format: (v) => fmtPct(v as number | null) },
      { key: "top", label: "Sector leaders" },
    ],
    rows: cards.map((c) => ({ ...c, top: c.leaders.map((l) => l.project.name).join("; ") || NONE })),
  };
}

interface Props {
  projects: Project[];
  onSelect: (sector: string) => void;
  onOpen: (id: string) => void;
}

export function SectorGrid({ projects, onSelect, onOpen }: Props) {
  const cards = useMemo(() => sectorCards(projects), [projects]);

  if (cards.length === 0) return <EmptyState />;

  return (
    <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-chart-mark>
      {cards.map((c) => (
        <div key={c.sector} className="card-lit flex h-full flex-col rounded-xl border border-ink-700/60 bg-ink-900 p-4 text-sm" data-testid="sector-card">
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
          <dl className="mt-3 grid grid-cols-2 gap-x-3">
            <div className="min-w-0">
              <dt className="text-label text-ink-300">Projects</dt>
              <dd className="tabular font-display text-stat tracking-tight text-ink-50">{c.count}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-label text-ink-300">NEAR-native</dt>
              <dd className="tabular font-display text-stat tracking-tight text-ink-50">{fmtNative(c)}</dd>
            </div>
          </dl>
          <div className="mt-3 flex-1 border-t border-ink-700/40 pt-3 text-xs" data-testid="sector-leaders">
            <div className="mb-1 text-label text-ink-300">Sector leaders</div>
            {c.leaders.length === 0 && <div className="text-ink-300">No leaders ranked for this sector.</div>}
            <ul className="space-y-0.5">
              {c.leaders.map((l) => (
                <li key={l.project.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(l.project.id)}
                    className="block max-w-full truncate text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60"
                  >
                    {l.project.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
