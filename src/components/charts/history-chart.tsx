"use client";

import { NOT_TRACKED } from "@/lib/coverage";
import { useMemo, useState } from "react";
import { ChartTable, ChartTableToggle, type ChartView } from "@/components/atlas/chart-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtCompact, fmtUsd, METRIC_LABEL } from "@/lib/format";
import { rangeDays, sliceTail, type Range } from "@/lib/ranges";
import type { MetricKey, SeriesKey } from "@/lib/types";
import { useSeries } from "@/lib/use-series";
import { MiniSeries } from "./mini-series";

const ORDER: SeriesKey[] = ["tvl", "volume", "fees", "revenue", "calls"];
const LABEL: Record<SeriesKey, string> = { tvl: "TVL", volume: "Volume", fees: "Fees", revenue: "Revenue", calls: "Function calls" };

/** Per-project daily history for every metric the project has, driven by the global range. */
export function HistoryChart({ projectId, range, metric }: { projectId: string; range: Range; metric: MetricKey }) {
  const series = useSeries();
  const [view, setView] = useState<ChartView>("chart");
  const available = useMemo(() => {
    const s = series?.projects[projectId];
    if (!s) return [];
    return ORDER.filter((k) => s[k]?.some((v) => v !== null));
  }, [series, projectId]);
  const preferred: SeriesKey = metric === "count" ? "tvl" : metric;
  const [picked, setPicked] = useState<SeriesKey | null>(null);
  const active = picked && available.includes(picked) ? picked : available.includes(preferred) ? preferred : available[0];

  if (!series) return <Skeleton className="h-[200px] w-full" />;
  if (!available.length || !active) {
    return <p className="text-xs text-muted-foreground">No daily history for this project. The figures above are from the research snapshot.</p>;
  }
  const n = rangeDays(range, series.dates.length);
  const dates = sliceTail(series.dates, n);
  const values = sliceTail(series.projects[projectId][active], n);
  const kind = active === "tvl" ? "line" : "bar";
  const label = active === "tvl" ? "TVL" : active === "calls" ? "Daily function calls" : `Daily ${METRIC_LABEL[active].replace("30d ", "")}`;
  const money = active !== "calls";

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
        <ChartTableToggle view={view} onChange={setView} />
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
        <MiniSeries dates={dates} values={values} kind={kind} primaryLabel={label} height={180} format={money ? fmtUsd : fmtCompact} />
      )}
      <p className="text-xs text-muted-foreground">
        {dates.length} days shown · {active === "calls" ? "BigQuery function calls to tracked contracts" : `DefiLlama daily history${active === "tvl" ? "" : ", current partial day excluded"}`}.
      </p>
    </div>
  );
}
