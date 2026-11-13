"use client";

import { useMemo } from "react";
import { ChartCard, EmptyState, TvlNote } from "@/components/atlas/chart-card";
import { frameHeight, type ChartFrame } from "@/components/atlas/chart-frame";
import { RangeControl } from "@/components/atlas/range-control";
import { Skeleton } from "@/components/ui/skeleton";
import { brushSlice, fittedDomain, levelWindow, rangeStats } from "@/lib/chart-frame";
import { fmtDateShort, fmtPct, fmtPctSigned, fmtUsd } from "@/lib/format";
import { rangeDays, RANGE_LONG, sliceTail, type Range } from "@/lib/ranges";
import { lastShare, selectionSeries, windowSum } from "@/lib/selection-series";
import type { NumericMetricKey, Project } from "@/lib/types";
import { useSeries } from "@/lib/use-series";
import { MiniSeries } from "./mini-series";

const PANELS: Array<{ key: NumericMetricKey; label: string; kind: "line" | "bar" }> = [
  { key: "tvl", label: "Summed TVL", kind: "line" },
  { key: "volume", label: "Daily DEX volume", kind: "bar" },
  { key: "fees", label: "Daily fees", kind: "bar" },
  { key: "revenue", label: "Daily revenue", kind: "bar" },
];

/**
 * Chain over time for a filtered Overview (owner request, 2026-11-12): the selection's own daily
 * TVL, volume, fees and revenue, summed from each project's DefiLlama history. That history covers
 * the last 90 days, so 90d and All both show it whole. TVL keeps its fitted axis and 90-day floor.
 * Summed protocol TVL double counts liquid staking and bridges, so its share is taken against the
 * same sum over every project with history, never against DefiLlama's chain TVL.
 */
export function SelectionOverTime({ projects, range, onRangeChange }: { projects: Project[]; range: Range; onRangeChange: (r: Range) => void }) {
  const file = useSeries();
  const sel = useMemo(() => (file ? selectionSeries(file, projects.map((p) => p.id)) : null), [file, projects]);
  const total = sel?.dates.length ?? 0;
  const flowN = rangeDays(range, total);
  const levelN = levelWindow(range, total);
  const tvl = sel?.metrics.tvl;
  const tvlNow = tvl ? [...tvl.values].reverse().find((v) => v !== null) ?? null : null;
  const share = tvl ? lastShare(tvl) : null;
  const tvlStats = sel && tvl ? rangeStats(sliceTail(sel.dates, levelN), sliceTail(tvl.values, levelN)) : null;
  const flowLabel = `${flowN} day${flowN === 1 ? "" : "s"}`;
  const volume = sel ? windowSum(sel.metrics.volume.values, flowN) : null;
  const fees = sel ? windowSum(sel.metrics.fees.values, flowN) : null;

  const takeaway = !sel
    ? "Loading daily history."
    : sel.withAnyHistory === 0
      ? "No project in this selection has daily DefiLlama history."
      : `The selection's summed TVL is ${fmtUsd(tvlNow)}${share !== null ? `, ${fmtPct(share)} of the summed TVL of every tracked project` : ""}${tvlStats ? ` (${fmtPctSigned(tvlStats.change)} over ${levelN} days)` : ""}; ${fmtUsd(volume)} of DEX volume and ${fmtUsd(fees)} of fees over the last ${flowLabel}.`;
  const subtitle = sel
    ? `Summed from DefiLlama history for ${sel.withAnyHistory} of ${projects.length} selected project${projects.length === 1 ? "" : "s"}. Per-project history covers the last ${total} days${levelN !== flowN ? `, and TVL keeps at least ${levelN} in view` : ""}.`
    : undefined;

  const rows = sel
    ? sliceTail(sel.dates, levelN)
        .map((d, i) => {
          const at = total - levelN + i;
          const r: Record<string, unknown> = { date: d };
          for (const p of PANELS) r[p.key] = sel.metrics[p.key].values[at];
          return r;
        })
        .reverse()
    : [];

  const renderPanels = (frame: ChartFrame) => {
    if (!sel) return <Skeleton className="h-[160px] w-full" aria-label="Loading history" />;
    if (sel.withAnyHistory === 0) return <EmptyState message="No project in this selection has daily DefiLlama history." />;
    const height = frameHeight(frame, 140, 260);
    return (
      <>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PANELS.map((p) => {
            const level = p.kind === "line";
            const n = frame.brushRange !== null || level ? levelN : flowN;
            const dates = brushSlice(sliceTail(sel.dates, n), frame.brushRange);
            const values = brushSlice(sliceTail(sel.metrics[p.key].values, n), frame.brushRange);
            const stats = level ? rangeStats(dates, values) : null;
            const m = sel.metrics[p.key];
            return (
              <div key={p.key} className="rounded-lg border border-ink-700/40 p-2">
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium">{p.label}</span>
                  <span className="ml-auto text-ink-300">{m.withHistory} with data</span>
                </div>
                <MiniSeries dates={dates} values={values} kind={p.kind} primaryLabel={`Selection ${p.label.toLowerCase()}`} height={height} color="var(--chain-near)" format={fmtUsd} yDomain={level && !frame.startAtZero ? fittedDomain(values) : undefined} />
                {stats && (
                  <p className="mt-1 text-label text-ink-300" data-testid="range-stats">
                    Low {fmtUsd(stats.min)}, high {fmtUsd(stats.max)}, {fmtPctSigned(stats.change)} over {dates.length} days
                  </p>
                )}
                {level && share !== null && <p className="text-label text-ink-300">{fmtPct(share)} of the summed TVL of every tracked project</p>}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-300">
          {levelN} days to {fmtDateShort(sel.dates[total - 1])}. Flows follow the range control ({RANGE_LONG[range]}, at most the {total} days of per-project history).
        </p>
      </>
    );
  };

  return (
    <ChartCard
      id="chain-over-time"
      title="Selection over time"
      takeaway={takeaway}
      subtitle={subtitle}
      scope="filtered"
      level
      actions={<RangeControl value={range} onChange={onRangeChange} ariaLabel="Chain over time range" />}
      info="With a filter set, this card sums the selection's own daily DefiLlama history in place of the chain totals. That is protocol TVL, DEX volume, fees and revenue for every selected project that DefiLlama tracks daily. The history covers the last 90 days. Summed protocol TVL double counts liquid staking and bridges, so it is compared with the same sum over every tracked project, not with DefiLlama's chain TVL. Clear the filters to see the chain totals again."
      source="DefiLlama per-protocol daily history, summed over the selection"
      footer={<TvlNote />}
      table={{
        columns: [{ key: "date", label: "Date" }, ...PANELS.map((p) => ({ key: p.key, label: `Selection ${p.label.toLowerCase()}`, align: "right" as const, format: (v: unknown) => fmtUsd(v as number | null) }))],
        rows,
        filename: `selection-over-time-${range}.csv`,
        maxRows: 120,
      }}
    >
      {(frame: ChartFrame) => renderPanels(frame)}
    </ChartCard>
  );
}
