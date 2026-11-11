"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import type { Scale } from "@/lib/filters";
import { fmtMetricFull, fmtPct, METRIC_LABEL } from "@/lib/format";
import { concentration, topNShare, type ConcentrationPoint } from "@/lib/metrics";
import type { MetricKey, NumericMetricKey, Project } from "@/lib/types";

/** Projects is not a money metric, so the curve falls back to TVL while it is selected. */
export function concentrationFocus(metric: MetricKey): NumericMetricKey {
  return metric === "count" ? "tvl" : metric;
}

export function concentrationTable(points: ConcentrationPoint[], focus: NumericMetricKey): ChartTableSpec {
  return {
    caption: `Cumulative share of ${METRIC_LABEL[focus]} by rank`,
    filename: `concentration-${focus}.csv`,
    columns: [
      { key: "rank", label: "Rank", align: "right" },
      { key: "name", label: "Project" },
      { key: "value", label: METRIC_LABEL[focus], align: "right", format: (v) => fmtMetricFull(focus, v as number) },
      { key: "cumulative", label: "Cumulative", align: "right", format: (v) => fmtMetricFull(focus, v as number) },
      { key: "share", label: "Cumulative share", align: "right", format: (v) => fmtPct(v as number, 1) },
    ],
    rows: points.map((p) => ({ ...p })),
    maxRows: 100,
  };
}

const LOG_TICKS = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000];

interface Props {
  projects: Project[];
  metric: MetricKey;
  scale: Scale;
  onOpen: (id: string) => void;
}

export function ConcentrationCurve({ projects, metric, scale, onOpen }: Props) {
  const focus = concentrationFocus(metric);
  const points = useMemo(() => concentration(projects, focus), [projects, focus]);
  const top3 = points.length >= 3 ? topNShare(points, 3) : null;
  const top10 = points.length >= 10 ? topNShare(points, 10) : null;
  const n = points.length;
  const useLog = scale === "log" && n > 1;
  const ticks = useLog ? LOG_TICKS.filter((t) => t <= n).concat(LOG_TICKS.includes(n) ? [] : [n]) : undefined;

  if (projects.length === 0) return <EmptyState />;
  if (n === 0) return <EmptyState message={`No ${METRIC_LABEL[focus]} data in this selection.`} />;

  const open = (i: number | string | undefined | null) => {
    if (i === null || i === undefined) return;
    const p = points[Number(i)];
    if (p) onOpen(p.id);
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {top3 !== null && (
          <span>
            <span className="font-semibold">Top 3</span> hold <span className="tabular font-semibold">{fmtPct(top3)}</span>
          </span>
        )}
        {top10 !== null && (
          <span>
            <span className="font-semibold">Top 10</span> hold <span className="tabular font-semibold">{fmtPct(top10)}</span>
          </span>
        )}
        <span className="text-ink-300">
          {n} project{n === 1 ? "" : "s"} with {METRIC_LABEL[focus]}
          {metric === "count" && " (TVL is shown while Projects is the metric)"}
        </span>
      </div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 20, bottom: 4, left: 0 }} onClick={(s) => open(s?.activeIndex)} style={{ cursor: "pointer" }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="rank"
              type="number"
              scale={useLog ? "log" : "linear"}
              domain={[1, Math.max(n, 2)]}
              ticks={ticks}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              label={{ value: useLog ? "Project rank (log)" : "Project rank", position: "insideBottomRight", offset: -2, fontSize: 10, fill: "var(--ink-muted)" }}
            />
            <YAxis dataKey="share" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} width={40} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <Tooltip content={<CurveTip metric={focus} />} cursor={{ stroke: "var(--axis)" }} />
            <Line type="monotone" dataKey="share" stroke="var(--chain-near)" strokeWidth={2} dot={n <= 12 ? { r: 3, strokeWidth: 0, fill: "var(--chain-near)" } : false} activeDot={{ r: 5, stroke: "var(--background)", strokeWidth: 2 }} isAnimationActive={false} />
            {top3 !== null && (
              <>
                <ReferenceLine x={3} stroke="var(--axis)" strokeDasharray="3 3" />
                <ReferenceDot x={3} y={top3} r={5} fill="var(--chain-near)" stroke="var(--background)" strokeWidth={2} label={{ value: `top 3 at ${fmtPct(top3)}`, position: "bottom", fontSize: 11, fill: "var(--foreground)" }} />
              </>
            )}
            {top10 !== null && (
              <>
                <ReferenceLine x={10} stroke="var(--axis)" strokeDasharray="3 3" />
                <ReferenceDot x={10} y={top10} r={5} fill="var(--chain-near)" stroke="var(--background)" strokeWidth={2} label={{ value: `top 10 at ${fmtPct(top10)}`, position: "bottom", fontSize: 11, fill: "var(--foreground)" }} />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-ink-300">Click a point to open the project. The log toggle stretches the first ranks so the top of the curve is readable.</p>
    </div>
  );
}

function CurveTip({ active, payload, metric }: TipProps<ConcentrationPoint> & { metric: NumericMetricKey }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipFrame title={`#${d.rank} ${d.name}`}>
      <TooltipRow label={METRIC_LABEL[metric]} value={fmtMetricFull(metric, d.value)} />
      <TooltipRow label="Cumulative share" value={fmtPct(d.share, 1)} />
      <div className="pt-1 text-ink-300">Click to open</div>
    </TooltipFrame>
  );
}
