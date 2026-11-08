"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState, Legend } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { CHAIN_COLOR, CHAIN_SHORT } from "@/lib/colors";
import { fmtMetric, fmtMetricFull, fmtPct, METRIC_LABEL, METRIC_SHORT } from "@/lib/format";
import { byChain } from "@/lib/metrics";
import { METRICS, NATIVE_CHAINS, type MetricKey, type NativeChain, type Project } from "@/lib/types";

export type NativeStackRow = {
  metric: MetricKey;
  label: string;
  total: number | null;
  /** Raw metric value per chain, used by the table and tooltip. */
  raw: Record<NativeChain, number>;
} & Record<NativeChain, number>;

/** One row per metric; each chain key holds that chain's share of the row total. */
export function nativeStackRows(projects: Project[]): NativeStackRow[] {
  return METRICS.map((m) => {
    const groups = byChain(projects, m);
    const total = groups.reduce((a, g) => a + g.value, 0);
    const raw = {} as Record<NativeChain, number>;
    const row = { metric: m, label: METRIC_LABEL[m], total: total > 0 ? total : null, raw } as NativeStackRow;
    for (const c of NATIVE_CHAINS) {
      const g = groups.find((x) => x.key === c);
      raw[c] = g?.value ?? 0;
      row[c] = total > 0 && g ? g.value / total : 0;
    }
    return row;
  });
}

export function nativeStackTable(rows: NativeStackRow[]): ChartTableSpec {
  return {
    caption: "Share of each metric by native chain",
    filename: "native-vs-imported.csv",
    columns: [
      { key: "label", label: "Metric" },
      ...NATIVE_CHAINS.map((c) => ({ key: c, label: c, align: "right" as const, format: (v: unknown) => fmtPct(v as number) })),
      { key: "total", label: "Total", align: "right", format: (v) => (v === null ? "no data" : String(v)) },
    ],
    rows: rows.map((r) => ({ ...r, total: r.total === null ? null : fmtMetricFull(r.metric, r.total) })),
  };
}

export function NativeStackedBar({ projects }: { projects: Project[] }) {
  const rows = useMemo(() => nativeStackRows(projects), [projects]);

  if (projects.length === 0) return <EmptyState />;

  return (
    <div>
      <Legend items={NATIVE_CHAINS.map((c) => ({ label: CHAIN_SHORT[c], color: CHAIN_COLOR[c], shape: "square" as const }))} className="mb-2" />
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }} barCategoryGap={6}>
            <CartesianGrid horizontal={false} stroke="var(--grid)" />
            <XAxis type="number" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="label" width={96} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={0} />
            <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} content={<StackTip />} />
            {NATIVE_CHAINS.map((c) => (
              <Bar key={c} dataKey={c} stackId="share" fill={CHAIN_COLOR[c]} stroke="var(--background)" strokeWidth={2} isAnimationActive={false} maxBarSize={28}>
                <LabelList dataKey={c} position="center" fill="#fff" fontSize={10} fontWeight={600} formatter={(v) => (typeof v === "number" && v >= 0.09 ? `${Math.round(v * 100)}%` : "")} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Rows with no reported figure in the selection are drawn empty.</p>
    </div>
  );
}

function StackTip({ active, payload }: TipProps<NativeStackRow>) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipFrame title={d.label}>
      {NATIVE_CHAINS.map((c) => (
        <TooltipRow key={c} label={CHAIN_SHORT[c]} color={CHAIN_COLOR[c]} value={d.total === null ? "no data" : `${fmtPct(d[c])} · ${fmtMetric(d.metric, d.raw[c])}`} />
      ))}
      <div className="pt-1 text-muted-foreground">
        {METRIC_SHORT[d.metric]} total {d.total === null ? "no data" : fmtMetric(d.metric, d.total)}
      </div>
    </TooltipFrame>
  );
}
