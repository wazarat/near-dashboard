"use client";

import { useMemo } from "react";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { EmptyState } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { SEQ, seqColor } from "@/lib/colors";
import { fmtMetric, fmtMetricFull, fmtPct, METRIC_SHORT } from "@/lib/format";
import { bySector } from "@/lib/metrics";
import type { MetricKey, Project } from "@/lib/types";

export interface SectorNode {
  [key: string]: unknown;
  name: string;
  size: number;
  count: number;
  withData: number;
  nativeCount: number;
  nativeShare: number | null;
  fill: string;
}

/** One node per sector with a positive total for the metric, largest first. */
export function sectorTreemapRows(projects: Project[], metric: MetricKey): SectorNode[] {
  return bySector(projects, metric)
    .filter((g) => g.value > 0)
    .map((g) => {
      const inSector = projects.filter((p) => p.sector === g.key);
      const nativeCount = inSector.filter((p) => p.chain === "NEAR native").length;
      const share = inSector.length ? nativeCount / inSector.length : null;
      return { name: g.key, size: g.value, count: g.count, withData: g.withData, nativeCount, nativeShare: share, fill: seqColor(share) };
    });
}

export function sectorTreemapTable(rows: SectorNode[], metric: MetricKey): ChartTableSpec {
  return {
    caption: `Sectors by ${METRIC_SHORT[metric]}`,
    filename: `sectors-by-${metric}.csv`,
    columns: [
      { key: "name", label: "Sector" },
      { key: "size", label: METRIC_SHORT[metric], align: "right", format: (v) => fmtMetricFull(metric, v as number) },
      { key: "count", label: "Projects", align: "right" },
      { key: "withData", label: "With data", align: "right" },
      { key: "nativeShare", label: "NEAR-native share", align: "right", format: (v) => fmtPct(v as number | null) },
    ],
    rows,
  };
}

interface Props {
  projects: Project[];
  metric: MetricKey;
  onSelect: (sector: string) => void;
}

export function SectorTreemap({ projects, metric, onSelect }: Props) {
  const data = useMemo(() => sectorTreemapRows(projects, metric), [projects, metric]);

  if (projects.length === 0) return <EmptyState />;
  if (data.length === 0) return <EmptyState message={`No ${METRIC_SHORT[metric].toLowerCase()} data in this selection.`} />;

  return (
    <div>
      <div className="h-[300px] w-full sm:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={data} dataKey="size" nameKey="name" isAnimationActive={false} content={<TreemapCell onSelect={onSelect} />}>
            <Tooltip content={<TreemapTip metric={metric} />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>Box size = {METRIC_SHORT[metric].toLowerCase()}. Colour = share of the sector&apos;s projects that are NEAR-native:</span>
        <span className="inline-flex items-center gap-1">
          0%
          {SEQ.map((c) => (
            <span key={c} aria-hidden="true" className="inline-block h-2.5 w-4" style={{ backgroundColor: c }} />
          ))}
          100%
        </span>
      </div>
    </div>
  );
}

interface CellProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  fill?: string;
  depth?: number;
  onSelect: (sector: string) => void;
}

function TreemapCell({ x = 0, y = 0, width = 0, height = 0, name = "", fill, depth, onSelect }: CellProps) {
  if (depth === 0) return <g />;
  const showLabel = width > 56 && height > 28;
  const lines = showLabel ? wrapWords(name, Math.max(6, Math.floor(width / 7))) : [];
  const maxLines = Math.max(1, Math.floor((height - 10) / 13));
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Filter to ${name}`}
      onClick={() => onSelect(name)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(name);
        }
      }}
      style={{ cursor: "pointer", outline: "none" }}
    >
      <rect x={x + 1} y={y + 1} width={Math.max(0, width - 2)} height={Math.max(0, height - 2)} rx={3} fill={fill ?? "var(--tier-none)"} stroke="var(--background)" strokeWidth={2} />
      {lines.slice(0, maxLines).map((line, i) => (
        <text key={i} x={x + 8} y={y + 16 + i * 13} fontSize={11} fontWeight={600} fill="#fff" style={{ pointerEvents: "none", paintOrder: "stroke", stroke: "rgba(0,0,0,0.35)", strokeWidth: 2 }}>
          {line}
        </text>
      ))}
    </g>
  );
}

function wrapWords(s: string, maxChars: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of s.split(" ")) {
    const next = `${cur} ${w}`.trim();
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function TreemapTip({ active, payload, metric }: TipProps<SectorNode> & { metric: MetricKey }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d || typeof d.name !== "string") return null;
  return (
    <TooltipFrame title={d.name}>
      <TooltipRow label={METRIC_SHORT[metric]} value={metric === "count" ? fmtMetric(metric, d.size) : fmtMetricFull(metric, d.size)} />
      <TooltipRow label="Projects" value={d.count} />
      {metric !== "count" && <TooltipRow label="With data" value={`${d.withData} of ${d.count}`} />}
      <TooltipRow label="NEAR-native" value={`${d.nativeCount} (${fmtPct(d.nativeShare)})`} />
      <div className="pt-1 text-muted-foreground">Click to filter to this sector</div>
    </TooltipFrame>
  );
}
