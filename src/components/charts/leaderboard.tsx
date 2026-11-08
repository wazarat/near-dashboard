"use client";

import { useMemo } from "react";
import { ScopeNote, TvlNote } from "@/components/atlas/chart-card";
import { MetricSegmented } from "@/components/atlas/chart-metric";
import { DataTable, type ProjectColumnDef } from "@/components/explorer/data-table";
import {
  calls30Column,
  calls7Column,
  captureColumn,
  chainColumn,
  changeColumn,
  feesColumn,
  nameColumn,
  revenueColumn,
  signersColumn,
  sparkColumn,
  statusColumn,
  tierColumn,
  tvlColumn,
  volumeColumn,
} from "@/components/explorer/project-columns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { COL_SETS, type ColSet } from "@/lib/filters";
import { METRIC_LABEL } from "@/lib/format";
import type { Range } from "@/lib/ranges";
import type { MetricKey, NumericMetricKey, Project } from "@/lib/types";

const COL_SET_LABEL: Record<ColSet, string> = { traction: "Traction", momentum: "Momentum", activity: "Activity", financials: "Financials" };

const METRIC_COLUMN: Record<NumericMetricKey, ProjectColumnDef> = { tvl: tvlColumn, volume: volumeColumn, fees: feesColumn, revenue: revenueColumn };

const numeric = (metric: MetricKey): NumericMetricKey => (metric === "count" ? "tvl" : metric);

interface Props {
  projects: Project[];
  metric: MetricKey;
  onMetricChange: (m: MetricKey) => void;
  range: Range;
  cols: ColSet;
  onColsChange: (cols: ColSet) => void;
  onOpen: (id: string) => void;
}

/** Sortable table of every project with a value for the chart's own metric, with four swappable column sets. */
export function Leaderboard({ projects, metric, onMetricChange, range, cols, onColsChange, onOpen }: Props) {
  const rows = useMemo(() => (metric === "count" ? projects.filter((p) => p.hasTraction) : projects.filter((p) => p[metric] !== null)), [projects, metric]);
  const m = numeric(metric);

  const columns = useMemo<ProjectColumnDef[]>(() => {
    const name = nameColumn(onOpen);
    switch (cols) {
      case "momentum":
        return [name, chainColumn, tvlColumn, ...(m === "tvl" ? [] : [METRIC_COLUMN[m]]), changeColumn(metric, "d7"), changeColumn(metric, "d30"), changeColumn(metric, "d90", "sm"), sparkColumn(metric, range)];
      case "activity":
        return [name, chainColumn, tierColumn, calls7Column, calls30Column, signersColumn];
      case "financials":
        return [name, chainColumn, tierColumn, feesColumn, revenueColumn, captureColumn];
      default:
        return [name, chainColumn, tierColumn, statusColumn, tvlColumn, volumeColumn, feesColumn, revenueColumn, captureColumn, changeColumn(metric, "d7", "md"), changeColumn(metric, "d30", "sm"), sparkColumn(metric, range)];
    }
  }, [cols, m, metric, range, onOpen]);

  const sortId = cols === "activity" ? "calls7d" : cols === "financials" ? "fees" : m;
  const liveCount = rows.filter((p) => p.live).length;
  const withActivity = rows.filter((p) => p.live?.calls7d !== null && p.live?.calls7d !== undefined).length;

  const description =
    metric === "count"
      ? `${rows.length} of ${projects.length} projects report at least one onchain metric (TVL, volume, fees or revenue).`
      : `${rows.length} of ${projects.length} projects report ${METRIC_LABEL[metric]}.`;
  const history =
    liveCount > 0
      ? ` ${liveCount} refresh daily and show change and trend for ${METRIC_LABEL[m]}.`
      : " No daily history has been collected yet, so change and trend columns show a dash until the refresh job has run.";

  return (
    <Card className="gap-3 py-4" data-chart-card="Leaderboard">
      <CardHeader className="px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h3 className="text-sm font-semibold">Leaderboard</h3>
            <ScopeNote />
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <MetricSegmented value={metric} onChange={onMetricChange} ariaLabel="Leaderboard metric" />
            <Segmented value={cols} onChange={onColsChange} options={COL_SETS.map((c) => ({ value: c, label: COL_SET_LABEL[c] }))} ariaLabel="Column set" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {description}
          {history} Sort any column; revenue capture is revenue divided by fees. Click a project to open it.
        </p>
      </CardHeader>
      <CardContent className="px-0">
        <DataTable
          key={`${cols}-${sortId}-${range}`}
          data={rows}
          columns={columns}
          initialSorting={[{ id: sortId, desc: true }]}
          pageSize={25}
          onRowClick={(p) => onOpen(p.id)}
          emptyMessage={metric === "count" ? "No projects with traction data in this selection." : `No projects report ${METRIC_LABEL[metric]} in this selection.`}
          footer={
            <div className="space-y-1">
              {cols === "financials" && <p>Fees are what users pay; revenue is the share the protocol or its token keeps. Incentives not included (paid source).</p>}
              {cols === "activity" && (
                <p>
                  Function calls and signers come from BigQuery receipt actions to each project&apos;s tracked contracts (data/contracts.csv). {withActivity} of {rows.length} rows have activity figures; the rest have no tracked contract yet.
                </p>
              )}
              {cols === "momentum" && <p>Change columns compare the latest complete day with the value 7, 30 and 90 days earlier. Trend sparklines follow the global range.</p>}
              <p>
                <TvlNote />
              </p>
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}
