"use client";

import { ArrowLeft, Filter } from "lucide-react";
import { useTheme } from "next-themes";
import { useMemo, useSyncExternalStore } from "react";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { EmptyState } from "@/components/atlas/chart-card";
import { useChartFrame } from "@/components/atlas/chart-frame";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { Button } from "@/components/ui/button";
import { SEQ_HEX } from "@/lib/colors";
import { fmtMetric, fmtMetricFull, fmtPct, METRIC_SHORT } from "@/lib/format";
import { fitLabel, labelColor, treemapLevel, type TreemapLevel, type TreemapTile } from "@/lib/treemap";
import type { MetricKey, Project } from "@/lib/types";

const subscribeNoop = () => () => {};

/** The theme the page is showing, dark on the server and until hydration so the fill table matches what the CSS paints. */
function useResolvedTheme(): "light" | "dark" {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  return mounted && resolvedTheme === "light" ? "light" : "dark";
}

/** The level a view needs for its table and takeaway, built with the same palette rules as the chart. */
export function useTreemapLevel(projects: Project[], metric: MetricKey, sector: string | null): TreemapLevel {
  const theme = useResolvedTheme();
  return useMemo(() => treemapLevel(projects, metric, sector, SEQ_HEX[theme]), [projects, metric, sector, theme]);
}

export function sectorTreemapTable(level: TreemapLevel, metric: MetricKey): ChartTableSpec {
  const unit = level.mode === "sectors" ? "Sector" : level.mode === "subcategories" ? "Subcategory" : "Project";
  return {
    caption: `${level.breadcrumb.join(", ")} by ${METRIC_SHORT[metric]}`,
    filename: `treemap-${level.sector ? level.sector.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "sectors"}-${metric}.csv`,
    columns: [
      { key: "name", label: unit },
      { key: "size", label: METRIC_SHORT[metric], align: "right", format: (v) => fmtMetricFull(metric, v as number) },
      { key: "count", label: "Projects", align: "right" },
      { key: "withData", label: "With data", align: "right" },
      { key: "nativeShare", label: "NEAR-native share", align: "right", format: (v) => fmtPct(v as number | null) },
    ],
    rows: level.tiles.map((t) => (t.kind === "untracked" ? { ...t, size: null } : t)),
  };
}

interface Props {
  projects: Project[];
  metric: MetricKey;
  /** The sector drilled into, from the chart's own URL key. */
  sector: string | null;
  onSectorChange: (sector: string | null) => void;
  onOpenProject: (id: string) => void;
  onFilterSector: (sector: string) => void;
  /** Height on the card, in pixels. The expanded view scales from it. */
  height?: number;
}

/**
 * Sector treemap with drill-down (standard section 7). Clicking a sector
 * zooms into it; inside, projects group by subcategory when there are at
 * least three, otherwise they show as tiles with the untracked ones folded
 * into one "Not tracked" tile. Filtering is its own action, never the click.
 */
export function SectorTreemap({ projects, metric, sector, onSectorChange, onOpenProject, onFilterSector, height = 320 }: Props) {
  const theme = useResolvedTheme();
  const palette = SEQ_HEX[theme];
  const level = useMemo(() => treemapLevel(projects, metric, sector, palette), [projects, metric, sector, palette]);
  const frame = useChartFrame(height, Math.max(560, height));

  if (projects.length === 0) return <EmptyState />;

  const onTile = (tile: TreemapTile) => {
    if (tile.kind === "sector") onSectorChange(tile.name);
    else if (tile.kind === "project" && tile.projectId) onOpenProject(tile.projectId);
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <nav aria-label="Treemap level" className="flex items-center gap-1 text-ink-300">
          {level.sector ? (
            <>
              <button type="button" onClick={() => onSectorChange(null)} className="rounded underline-offset-2 hover:text-ink-50 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60">
                All sectors
              </button>
              <span aria-hidden="true">,</span>
              <span className="font-medium text-ink-50" aria-current="location">
                {level.sector}
              </span>
            </>
          ) : (
            <span className="font-medium text-ink-50">All sectors</span>
          )}
        </nav>
        {level.sector && (
          <>
            <Button variant="ghost" size="xs" onClick={() => onSectorChange(null)} aria-label="Back to all sectors">
              <ArrowLeft /> Back
            </Button>
            <Button variant="outline" size="xs" onClick={() => onFilterSector(level.sector as string)}>
              <Filter /> Filter to this sector
            </Button>
          </>
        )}
      </div>
      {level.tiles.length === 0 ? (
        <EmptyState message={level.sector ? `No ${METRIC_SHORT[metric].toLowerCase()} data in ${level.sector}.` : `No ${METRIC_SHORT[metric].toLowerCase()} data in this selection.`} />
      ) : (
        <div style={{ height: frame.height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap data={level.tiles} dataKey="size" nameKey="name" isAnimationActive={false} content={<TreemapCell palette={palette} onTile={onTile} />}>
              <Tooltip content={<TreemapTip metric={metric} />} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-300">
        <span>
          Box size is {METRIC_SHORT[metric].toLowerCase()}. Colour is the share of a box&apos;s projects that are NEAR-native.
          {level.mode === "sectors" ? " Click a sector to open it." : level.mode === "projects" ? " Click a project to open its pop-up." : ""}
        </span>
        <span className="inline-flex items-center gap-1">
          0%
          {palette.seq.map((c) => (
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
  kind?: TreemapTile["kind"];
  projectId?: string;
  palette: { textDark: string; textLight: string; none: string };
  onTile: (tile: TreemapTile) => void;
}

function TreemapCell({ x = 0, y = 0, width = 0, height = 0, name = "", fill, depth, kind = "sector", projectId, palette, onTile }: CellProps) {
  if (depth === 0) return <g />;
  const color = fill ?? palette.none;
  const lines = fitLabel(name, width, height);
  const text = labelColor(color) === "dark" ? palette.textDark : palette.textLight;
  const clickable = kind === "sector" || kind === "project";
  const action = kind === "sector" ? `Open ${name}` : kind === "project" ? `Open ${name}` : name;
  const tile = { id: name, name, size: 0, count: 0, withData: 0, nativeShare: null, fill: color, kind, projectId } as TreemapTile;
  return (
    <g
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={action}
      data-tile-kind={kind}
      onClick={clickable ? () => onTile(tile) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onTile(tile);
              }
            }
          : undefined
      }
      style={{ cursor: clickable ? "pointer" : "default", outline: "none" }}
    >
      <rect x={x + 1} y={y + 1} width={Math.max(0, width - 2)} height={Math.max(0, height - 2)} rx={3} fill={color} stroke="var(--background)" strokeWidth={2} strokeDasharray={kind === "untracked" ? "3 2" : undefined} />
      {lines?.map((line, i) => (
        <text key={i} x={x + 8} y={y + 16 + i * 13} fontSize={11} fontWeight={600} fill={text} style={{ pointerEvents: "none" }}>
          {line}
        </text>
      ))}
    </g>
  );
}

function TreemapTip({ active, payload, metric }: TipProps<TreemapTile> & { metric: MetricKey }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d || typeof d.name !== "string") return null;
  if (d.kind === "untracked") {
    return (
      <TooltipFrame title="Not tracked">
        <TooltipRow label="Projects" value={d.count} />
        <div className="pt-1 text-ink-300">DefiLlama does not report {METRIC_SHORT[metric].toLowerCase()} for these projects. A coverage gap, not a zero.</div>
      </TooltipFrame>
    );
  }
  return (
    <TooltipFrame title={d.name}>
      <TooltipRow label={METRIC_SHORT[metric]} value={metric === "count" ? fmtMetric(metric, d.size) : fmtMetricFull(metric, d.size)} />
      {d.kind !== "project" && <TooltipRow label="Projects" value={d.count} />}
      {d.kind !== "project" && metric !== "count" && <TooltipRow label="With data" value={`${d.withData} of ${d.count}`} />}
      <TooltipRow label="NEAR-native" value={d.kind === "project" ? (d.nativeShare === 1 ? "yes" : "no") : fmtPct(d.nativeShare)} />
      <div className="pt-1 text-ink-300">{d.kind === "sector" ? "Click to open this sector" : d.kind === "project" ? "Click to open the project" : `${d.count} projects in this subcategory`}</div>
    </TooltipFrame>
  );
}
