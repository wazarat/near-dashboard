"use client";

import { RangeControl } from "@/components/atlas/range-control";
import { useMemo, useState } from "react";
import { ChartTable, ChartTableToggle, type ChartView } from "@/components/atlas/chart-table";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fittedDomain, levelWindow, rangeStats } from "@/lib/chart-frame";
import { NOT_TRACKED } from "@/lib/coverage";
import { fmtCompact, fmtPctSigned, fmtUsd, METRIC_LABEL } from "@/lib/format";
import { rangeDays, sliceTail, type Range } from "@/lib/ranges";
import type { MetricKey, SeriesKey } from "@/lib/types";
import { useSeries } from "@/lib/use-series";
import { MiniSeries } from "./mini-series";

const ORDER: SeriesKey[] = ["tvl", "volume", "fees", "revenue", "calls"];
const LABEL: Record<SeriesKey, string> = { tvl: "TVL", volume: "Volume", fees: "Fees", revenue: "Revenue", calls: "Function calls" };
const AXIS_OPTIONS = [
  { value: "fitted" as const, label: "Fitted" },
  { value: "zero" as const, label: "From zero" },
];

/** Per-project daily history for every metric the project has. TVL is a level series with a fitted axis and a 90-day floor; the rest are flows on the chart's own range. */
export function HistoryChart({ projectId, range, onRangeChange, metric, height = 180 }: { projectId: string; range: Range; onRangeChange: (r: Range) => void; metric: MetricKey; height?: number }) {
  const series = useSeries();
  const [view, setView] = useState<ChartView>("chart");
  const [axis, setAxis] = useState<"fitted" | "zero">("fitted");
  const available = useMemo(() => {
    const s = series?.projects[projectId];
    if (!s) return [];
    return ORDER.filter((k) => s[k]?.some((v) => v !== null));
  }, [series, projectId]);
  const preferred: SeriesKey = metric === "count" ? "tvl" : metric;
  const [picked, setPicked] = useState<SeriesKey | null>(null);
  const active = picked && available.includes(picked) ? picked : available.includes(preferred) ? preferred : available[0];

  if (!series) return <Skeleton className="w-full" style={{ height: height + 20 }} />;
  if (!available.length || !active) {
    return <p className="text-xs text-ink-300">No daily history for this project. The figures above are from the research snapshot.</p>;
  }
  const level = active === "tvl";
  const n = level ? levelWindow(range, series.dates.length) : rangeDays(range, series.dates.length);
  const dates = sliceTail(series.dates, n);
  const values = sliceTail(series.projects[projectId][active], n);
  const kind = level ? "line" : "bar";
  const label = level ? "TVL" : active === "calls" ? "Daily function calls" : `Daily ${METRIC_LABEL[active].replace("30d ", "")}`;
  const money = active !== "calls";
  const stats = level ? rangeStats(dates, values) : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={active} onValueChange={(v) => setPicked(v as SeriesKey)}>
          <TabsList className="h-8">
            {available.map((k) => (
              <TabsTrigger key={k} value={k} className="h-6 px-2 text-xs">
                {LABEL[k]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <RangeControl value={range} onChange={onRangeChange} ariaLabel="History range" />
          {level && view === "chart" && <Segmented value={axis} onChange={setAxis} options={AXIS_OPTIONS} ariaLabel="Y axis" />}
          <ChartTableToggle view={view} onChange={setView} />
        </div>
      </div>
      {view === "table" ? (
        <ChartTable
          spec={{
            columns: [
              { key: "date", label: "Date" },
              { key: "v", label, align: "right", format: (v) => (v === null ? NOT_TRACKED : money ? fmtUsd(v as number) : fmtCompact(v as number)) },
            ],
            rows: dates.map((d, i) => ({ date: d, v: values[i] })).reverse(),
            filename: `${projectId}-${active}.csv`,
            maxRows: 100,
          }}
        />
      ) : (
        <MiniSeries dates={dates} values={values} kind={kind} primaryLabel={label} height={height} format={money ? fmtUsd : fmtCompact} yDomain={level && axis === "fitted" ? fittedDomain(values) : undefined} />
      )}
      {stats && view === "chart" && (
        <p className="text-label text-ink-300" data-testid="range-stats">
          Low {fmtUsd(stats.min)}, high {fmtUsd(stats.max)}, {fmtPctSigned(stats.change)} over {dates.length} days
        </p>
      )}
      <p className="text-xs text-ink-300">
        {dates.length} days shown{level && n !== rangeDays(range, series.dates.length) ? " (TVL keeps at least 90 days in view)" : ""}. {active === "calls" ? "BigQuery function calls to tracked contracts" : `DefiLlama daily history${level ? "" : ", current partial day excluded"}`}.
      </p>
    </div>
  );
}
