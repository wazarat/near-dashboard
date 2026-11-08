"use client";

import { useMemo } from "react";
import { ChangeCell } from "@/components/atlas/change-cell";
import { ChartCard, EmptyState } from "@/components/atlas/chart-card";
import { NumericMetricSegmented } from "@/components/atlas/chart-metric";
import { SparkLine } from "@/components/atlas/spark-line";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtUsd, METRIC_LABEL, METRIC_SHORT } from "@/lib/format";
import { MIN_SIZE_LABEL, MIN_SIZES, movers, type MinSize, type Mover } from "@/lib/movers";
import { changeLabel, rangeDays, sliceTail, type Range } from "@/lib/ranges";
import type { NumericMetricKey, Project } from "@/lib/types";
import { useSeries } from "@/lib/use-series";

interface Props {
  projects: Project[];
  metric: NumericMetricKey;
  onMetricChange: (m: NumericMetricKey) => void;
  range: Range;
  minSize: MinSize;
  onMinSizeChange: (s: MinSize) => void;
  onOpen: (id: string) => void;
}

/** Biggest risers and fallers on the chart's own metric over the current window, after a size filter. */
export function MoversPanel({ projects, metric, onMetricChange, range, minSize, onMinSizeChange, onOpen }: Props) {
  const m = useMemo(() => movers(projects, metric, range, minSize, 6), [projects, metric, range, minSize]);
  const series = useSeries();
  const label = changeLabel(range);
  const any = m.risers.length + m.fallers.length > 0;
  const takeaway = !any
    ? m.eligible === 0
      ? "No project in the selection has daily history and passes the size filter yet."
      : `No ${METRIC_SHORT[m.metric].toLowerCase()} moves over the last ${label} among ${m.eligible} eligible projects.`
    : `Over the last ${label}, ${m.risers[0] ? `${m.risers[0].project.name} rose ${Math.round(m.risers[0].change * 100)}%` : "nothing rose"}${m.fallers[0] ? ` while ${m.fallers[0].project.name} fell ${Math.round(Math.abs(m.fallers[0].change) * 100)}%` : ""} in ${METRIC_LABEL[m.metric].toLowerCase()} (${m.eligible} projects pass the size filter).`;
  const maxAbs = Math.max(0.01, ...[...m.risers, ...m.fallers].map((r) => Math.abs(r.change)));
  const n = rangeDays(range, 90);

  const row = (r: Mover) => {
    const pts = series?.projects[r.project.id]?.[m.metric];
    return (
      <li key={r.project.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-1.5 text-sm">
        <button type="button" onClick={() => onOpen(r.project.id)} className="truncate text-left font-medium underline-offset-2 hover:underline">
          {r.project.name}
        </button>
        <SparkLine points={series ? (pts ? sliceTail(pts, n) : []) : null} label={`${METRIC_SHORT[m.metric]} trend`} />
        <span className="h-2 rounded" style={{ width: `${Math.max(4, (Math.abs(r.change) / maxAbs) * 72)}px`, backgroundColor: r.change > 0 ? "var(--status-good)" : "var(--status-critical)" }} aria-hidden="true" />
        <span className="flex items-center gap-2">
          <ChangeCell value={r.change} digits={0} />
          <span className="tabular w-16 text-right text-muted-foreground">{fmtUsd(r.value)}</span>
        </span>
      </li>
    );
  };

  return (
    <ChartCard
      title={`Risers and fallers (${label})`}
      takeaway={takeaway}
      info={`Projects with daily DefiLlama history ranked by percentage change of ${METRIC_LABEL[m.metric].toLowerCase()} over the last ${label} against the window before it (TVL compares end values). The size filter hides tiny bases that would otherwise dominate.`}
      actions={
        <>
          <NumericMetricSegmented value={metric} onChange={onMetricChange} ariaLabel="Movers metric" />
          <Select value={minSize} onValueChange={(v) => onMinSizeChange(v as MinSize)}>
            <SelectTrigger size="sm" className="h-7 text-xs" aria-label="Minimum size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MIN_SIZES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {MIN_SIZE_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
      table={{
        columns: [
          { key: "direction", label: "" },
          { key: "name", label: "Project" },
          { key: "change", label: `${label} change`, align: "right", format: (v) => `${((v as number) * 100).toFixed(1)}%` },
          { key: "value", label: METRIC_LABEL[m.metric], align: "right", format: (v) => fmtUsd(v as number) },
        ],
        rows: [...m.risers.map((r) => ({ direction: "riser", name: r.project.name, change: r.change, value: r.value })), ...m.fallers.map((r) => ({ direction: "faller", name: r.project.name, change: r.change, value: r.value }))],
        filename: `movers-${m.metric}-${label}.csv`,
      }}
    >
      {!any ? (
        <EmptyState message={takeaway} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risers</h4>
            {m.risers.length ? <ul className="divide-y">{m.risers.map(row)}</ul> : <p className="text-xs text-muted-foreground">None</p>}
          </div>
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fallers</h4>
            {m.fallers.length ? <ul className="divide-y">{m.fallers.map(row)}</ul> : <p className="text-xs text-muted-foreground">None</p>}
          </div>
        </div>
      )}
    </ChartCard>
  );
}
