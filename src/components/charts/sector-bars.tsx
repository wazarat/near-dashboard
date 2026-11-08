"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import type { Scale } from "@/lib/filters";
import { fmtMetric, fmtMetricFull, fmtPct, METRIC_SHORT } from "@/lib/format";
import { bySector } from "@/lib/metrics";
import type { MetricKey, Project } from "@/lib/types";

export interface SectorBarRow {
  [key: string]: unknown;
  sector: string;
  total: number;
  count: number;
  withData: number;
  nativeCount: number;
  nativeShare: number | null;
}

/** Sector totals for the metric, largest first. Sectors with no data keep a zero total. */
export function sectorBarRows(projects: Project[], metric: MetricKey): SectorBarRow[] {
  return bySector(projects, metric).map((g) => {
    const inSector = projects.filter((p) => p.sector === g.key);
    const nativeCount = inSector.filter((p) => p.chain === "NEAR native").length;
    return { sector: g.key, total: g.value, count: g.count, withData: g.withData, nativeCount, nativeShare: inSector.length ? nativeCount / inSector.length : null };
  });
}

export function sectorBarTable(rows: SectorBarRow[], metric: MetricKey): ChartTableSpec {
  return {
    caption: `Sectors ranked by ${METRIC_SHORT[metric]}`,
    filename: `sector-bars-${metric}.csv`,
    columns: [
      { key: "sector", label: "Sector" },
      { key: "total", label: METRIC_SHORT[metric], align: "right", format: (v) => fmtMetricFull(metric, v as number) },
      { key: "count", label: "Projects", align: "right" },
      { key: "withData", label: "With data", align: "right" },
      { key: "nativeShare", label: "NEAR-native share", align: "right", format: (v) => fmtPct(v as number | null) },
    ],
    rows,
  };
}

/** Width reserved for sector labels; names longer than this are shortened with an ellipsis. */
export const SECTOR_AXIS_WIDTH = 150;
const SECTOR_LABEL_CHARS = 24;

export function shortSector(name: string): string {
  return name.length > SECTOR_LABEL_CHARS ? `${name.slice(0, SECTOR_LABEL_CHARS - 1).trimEnd()}…` : name;
}

interface TickProps {
  x?: number;
  y?: number;
  payload?: { value?: unknown };
  onSelect: (sector: string) => void;
}

/** Category tick rendered as a keyboard-reachable button that opens the sector drawer. */
export function SectorTick({ x = 0, y = 0, payload, onSelect }: TickProps) {
  const name = typeof payload?.value === "string" ? payload.value : "";
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Open ${name}`}
      onClick={() => onSelect(name)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(name);
        }
      }}
      style={{ cursor: "pointer", outline: "none" }}
    >
      <title>{name}</title>
      <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill="var(--ink-secondary)">
        {shortSector(name)}
      </text>
    </g>
  );
}

interface Props {
  projects: Project[];
  metric: MetricKey;
  scale: Scale;
  onSelect: (sector: string) => void;
}

export function SectorBars({ projects, metric, scale, onSelect }: Props) {
  const rows = useMemo(() => sectorBarRows(projects, metric), [projects, metric]);
  const useLog = scale === "log" && metric !== "count";
  const data = useLog ? rows.filter((r) => r.total > 0) : rows;
  const hidden = rows.length - data.length;

  if (projects.length === 0) return <EmptyState />;
  if (data.length === 0) return <EmptyState message={`No ${METRIC_SHORT[metric].toLowerCase()} data in this selection.`} />;

  const height = Math.max(240, data.length * 26 + 30);
  const open = (i: number | string | undefined | null) => {
    if (i === null || i === undefined) return;
    const r = data[Number(i)];
    if (r) onSelect(r.sector);
  };

  return (
    <div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 0 }} barCategoryGap={4} onClick={(s) => open(s?.activeIndex)} style={{ cursor: "pointer" }}>
            <CartesianGrid horizontal={false} stroke="var(--grid)" />
            <XAxis
              type="number"
              scale={useLog ? "log" : "linear"}
              domain={useLog ? [1, "auto"] : [0, "auto"]}
              allowDataOverflow={useLog}
              allowDecimals={false}
              tickFormatter={(v) => fmtMetric(metric, v)}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis type="category" dataKey="sector" width={SECTOR_AXIS_WIDTH} tickLine={false} axisLine={false} interval={0} tick={<SectorTick onSelect={onSelect} />} />
            <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} content={<SectorTip metric={metric} />} />
            <Bar dataKey="total" fill="var(--cat-1)" radius={[0, 4, 4, 0]} isAnimationActive={false} maxBarSize={20}>
              <LabelList dataKey="total" position="right" fontSize={10} fill="var(--ink-secondary)" formatter={(v) => fmtMetric(metric, typeof v === "number" ? v : null)} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Click a bar or a sector name to open the sector drawer.
        {hidden > 0 && ` ${hidden} sector${hidden === 1 ? "" : "s"} with no ${METRIC_SHORT[metric].toLowerCase()} data hidden on the log scale.`}
      </p>
    </div>
  );
}

function SectorTip({ active, payload, metric }: TipProps<SectorBarRow> & { metric: MetricKey }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipFrame title={d.sector}>
      <TooltipRow label={METRIC_SHORT[metric]} value={fmtMetricFull(metric, d.total)} />
      <TooltipRow label="Projects" value={d.count} />
      {metric !== "count" && <TooltipRow label="With data" value={`${d.withData} of ${d.count}`} />}
      <TooltipRow label="NEAR-native" value={`${d.nativeCount} (${fmtPct(d.nativeShare)})`} />
      <div className="pt-1 text-muted-foreground">Click to open sector</div>
    </TooltipFrame>
  );
}
