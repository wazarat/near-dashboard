"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState, HatchDefs } from "@/components/atlas/chart-card";
import { useSvgId } from "@/components/atlas/chart-frame";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { fmtInt, fmtPct, fmtUsd, fmtUsdFull } from "@/lib/format";
import type { Bucket } from "@/lib/intents";

/** Width reserved for category labels so the bars line up across cards and fit a 390 px screen. */
export const BUCKET_AXIS_WIDTH = 120;
const LABEL_CHARS = 18;

export interface BucketRow {
  [key: string]: unknown;
  key: string;
  label: string;
  count: number;
  usd: number;
  share: number;
  kind: "normal" | "other" | "none";
  caption: string;
}

export interface BucketRowOptions {
  /** Display label for a normal key. */
  label?: (key: string) => string;
  /** Label for the "(none)" bucket, e.g. "no referral tag". */
  noneLabel?: string;
  /** What the end-of-bar caption shows. */
  caption?: "count" | "share";
}

export function bucketRows(buckets: Bucket[], opts: BucketRowOptions = {}): BucketRow[] {
  const captionKind = opts.caption ?? "count";
  return buckets.map((b) => {
    const kind: BucketRow["kind"] = b.key === "(other)" ? "other" : b.key === "(none)" ? "none" : "normal";
    const label = kind === "other" ? "other (long tail)" : kind === "none" ? (opts.noneLabel ?? "none") : opts.label ? opts.label(b.key) : b.key;
    const caption = captionKind === "share" ? `${fmtPct(b.share, 1)} · ${fmtUsd(b.usd)}` : `${fmtUsd(b.usd)} · ${fmtInt(b.count)}`;
    return { key: b.key, label, count: b.count, usd: b.usd, share: b.share, kind, caption };
  });
}

export function bucketTable(rows: BucketRow[], keyLabel: string, caption: string, filename: string): ChartTableSpec {
  return {
    caption,
    filename,
    columns: [
      { key: "label", label: keyLabel },
      { key: "usd", label: "Volume (USD)", align: "right", format: (v) => fmtUsdFull(v as number) },
      { key: "count", label: "Swaps", align: "right", format: (v) => fmtInt(v as number) },
      { key: "share", label: "Share", align: "right", format: (v) => fmtPct(v as number, 1) },
    ],
    rows,
  };
}

/** Sum of shares for the named buckets, or null when none is present. */
export function topShare(rows: BucketRow[], n: number): number | null {
  const normal = rows.filter((r) => r.kind === "normal").slice(0, n);
  return normal.length ? normal.reduce((a, r) => a + r.share, 0) : null;
}

function shortLabel(name: string): string {
  return name.length > LABEL_CHARS ? `${name.slice(0, LABEL_CHARS - 1).trimEnd()}…` : name;
}

function BucketTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value?: unknown } }) {
  const name = typeof payload?.value === "string" ? payload.value : "";
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill="var(--ink-secondary)">
      <title>{name}</title>
      {shortLabel(name)}
    </text>
  );
}

interface Props {
  rows: BucketRow[];
  color: string;
  /** Base for the hatch pattern id; a per-render suffix keeps it unique even when the chart is shown twice. */
  hatchId: string;
  ariaLabel: string;
  emptyMessage: string;
  /** Explains the row key in the tooltip title, e.g. "Route". */
  keyLabel: string;
}

/** Horizontal bars by USD for one Bucket[] list. "(other)" is hatched, "(none)" is muted. */
export function BucketBars({ rows, color, hatchId: hatchBase, ariaLabel, emptyMessage, keyLabel }: Props) {
  const hatchId = useSvgId(hatchBase);
  if (rows.length === 0) return <EmptyState message={emptyMessage} />;
  const height = Math.max(120, rows.length * 24 + 28);
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 100, bottom: 4, left: 0 }} barCategoryGap={4}>
          <HatchDefs id={hatchId} />
          <CartesianGrid horizontal={false} stroke="var(--grid)" />
          <XAxis type="number" domain={[0, "auto"]} tickFormatter={(v) => fmtUsd(v, { digits: 0 })} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="label" width={BUCKET_AXIS_WIDTH} tickLine={false} axisLine={false} interval={0} tick={<BucketTick />} />
          <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} content={<BucketTip keyLabel={keyLabel} />} />
          <Bar dataKey="usd" radius={[0, 4, 4, 0]} isAnimationActive={false} maxBarSize={18}>
            {rows.map((r) => (
              <Cell key={r.key} fill={r.kind === "other" ? `url(#${hatchId})` : r.kind === "none" ? "var(--tier-none)" : color} stroke={r.kind === "other" ? "var(--ink-muted)" : undefined} strokeWidth={r.kind === "other" ? 1 : 0} />
            ))}
            <LabelList dataKey="caption" position="right" fontSize={10} fill="var(--ink-secondary)" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BucketTip({ active, payload, keyLabel }: TipProps<BucketRow> & { keyLabel: string }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <TooltipFrame title={`${keyLabel}, ${r.label}`}>
      <TooltipRow label="Volume (SUCCESS swaps)" value={fmtUsdFull(r.usd)} />
      <TooltipRow label="Swaps" value={fmtInt(r.count)} />
      <TooltipRow label="Share of window volume" value={fmtPct(r.share, 1)} />
      {r.kind === "other" && <div className="pt-1 text-muted-foreground">Long tail beyond the listed keys, plus keys the per-day files already folded into (other).</div>}
      {r.kind === "none" && <div className="pt-1 text-muted-foreground">Rows where the field was empty.</div>}
    </TooltipFrame>
  );
}
