"use client";

import { useMemo } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, EmptyState, Legend } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { fmtCompact, fmtDate, fmtDateShort, fmtInt, fmtPct, fmtUsd, fmtUsdFull } from "@/lib/format";
import type { IntentsSummary } from "@/lib/intents";
import { EXPLORER_COLOR, EXPLORER_LABEL, EXPLORER_QUERY, LLAMA_COLOR, LLAMA_LABEL, LLAMA_QUERY, SWAPS_COLOR, TRANSFORM_QUERY } from "./labels";

export interface WeekRow {
  [key: string]: unknown;
  week: string;
  volumeUsd: number;
  successCount: number;
  uniqueRecipients: number;
  llamaVolume: number | null;
  days: number;
  full: boolean;
  ratio: number | null;
}

export function weekRows(data: IntentsSummary): WeekRow[] {
  return data.weekly.map((w) => ({
    ...w,
    full: w.days === 7,
    ratio: w.llamaVolume !== null && w.llamaVolume > 0 ? w.volumeUsd / w.llamaVolume : null,
  }));
}

export function weekTable(rows: WeekRow[]): ChartTableSpec {
  return {
    caption: "Weekly 1Click swap volume from the Explorer API against DefiLlama over the same days",
    filename: "intents-weekly.csv",
    columns: [
      { key: "week", label: "Week of (Mon)" },
      { key: "days", label: "Complete days", align: "right" },
      { key: "volumeUsd", label: "1Click volume (Explorer)", align: "right", format: (v) => fmtUsdFull(v as number) },
      { key: "successCount", label: "Swaps (SUCCESS)", align: "right", format: (v) => fmtInt(v as number) },
      { key: "uniqueRecipients", label: "Recipients (hash, est.)", align: "right", format: (v) => fmtInt(v as number) },
      { key: "llamaVolume", label: "All channels, same days (DefiLlama)", align: "right", format: (v) => (v === null ? "—" : fmtUsdFull(v as number)) },
      { key: "ratio", label: "1Click / DefiLlama", align: "right", format: (v) => (v === null ? "—" : fmtPct(v as number, 1)) },
    ],
    rows: [...rows].reverse(),
  };
}

const PARTIAL_PATTERN = "intents-partial-week";

export function WeeklyChart({ data }: { data: IntentsSummary }) {
  const rows = useMemo(() => weekRows(data), [data]);

  const takeaway = useMemo(() => {
    if (rows.length === 0) return "No complete Explorer day yet, so there is nothing to group by week.";
    const latestFull = [...rows].reverse().find((r) => r.full);
    const latest = latestFull ?? rows[rows.length - 1];
    const partial = rows.filter((r) => !r.full).length;
    const span = `${rows.length} week${rows.length === 1 ? "" : "s"} of 1Click data${partial ? ` (${partial} with fewer than 7 complete days)` : ""}`;
    const share = latest.ratio !== null ? `, ${fmtPct(latest.ratio)} of DefiLlama's all-channel ${fmtUsd(latest.llamaVolume)} over the same days` : latest.llamaVolume === null ? "; DefiLlama has no point for every day of that week" : "";
    return `${span}. ${latest.full ? "The latest full week" : `The latest week (${latest.days} complete day${latest.days === 1 ? "" : "s"})`} of ${fmtDateShort(latest.week)} saw ${fmtUsd(latest.volumeUsd)} across ${fmtInt(latest.successCount)} swaps${share}.`;
  }, [rows]);

  return (
    <ChartCard
      title="Weekly volume and swaps"
      takeaway={takeaway}
      info={`Bars: ${EXPLORER_LABEL} summed per ISO week (Monday start) over complete Explorer days only. Green line: SUCCESS swap count per week on the right axis. Dashed line: ${LLAMA_LABEL} summed over the same days, drawn only where DefiLlama has a point for every day in the bucket. Weeks with fewer than 7 complete days are hatched.`}
      table={weekTable(rows)}
      queries={[EXPLORER_QUERY, LLAMA_QUERY, TRANSFORM_QUERY]}
      footer={<span>Partial Explorer days are excluded before grouping, so a hatched week covers only the complete days it names. DefiLlama&apos;s value is summed over those same days, not the full calendar week.</span>}
    >
      {rows.length === 0 ? (
        <EmptyState message="No complete Explorer days to group into weeks yet." />
      ) : (
        <div>
          <Legend
            className="mb-2"
            items={[
              { label: EXPLORER_LABEL, color: EXPLORER_COLOR, shape: "square" },
              { label: "week with fewer than 7 complete days", color: EXPLORER_COLOR, shape: "hatch" },
              { label: "swaps (SUCCESS), right axis", color: SWAPS_COLOR, shape: "line" },
              { label: `${LLAMA_LABEL}, same days`, color: LLAMA_COLOR, shape: "line" },
            ]}
          />
          <div className="h-[260px] w-full" role="img" aria-label="Weekly 1Click swap volume bars with swap count and DefiLlama lines">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={rows.length > 30 ? 1 : 4}>
                <defs>
                  <pattern id={PARTIAL_PATTERN} patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
                    <rect width={6} height={6} fill="var(--surface-chart)" />
                    <line x1={0} y1={0} x2={0} y2={6} stroke={EXPLORER_COLOR} strokeWidth={2} />
                  </pattern>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="week" tickFormatter={fmtDateShort} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={36} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="usd" tickFormatter={(v) => fmtUsd(v, { digits: 0 })} width={56} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} domain={[0, "auto"]} />
                <YAxis yAxisId="count" orientation="right" tickFormatter={(v) => fmtCompact(v)} width={44} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} domain={[0, "auto"]} />
                <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} content={<WeekTip />} />
                <Bar yAxisId="usd" dataKey="volumeUsd" name={EXPLORER_LABEL} fill={EXPLORER_COLOR} isAnimationActive={false} maxBarSize={28}>
                  {rows.map((r) => (
                    <Cell key={r.week} fill={r.full ? EXPLORER_COLOR : `url(#${PARTIAL_PATTERN})`} stroke={r.full ? undefined : EXPLORER_COLOR} strokeWidth={r.full ? 0 : 1} />
                  ))}
                </Bar>
                <Line yAxisId="usd" type="monotone" dataKey="llamaVolume" name={LLAMA_LABEL} stroke={LLAMA_COLOR} strokeWidth={1.5} strokeDasharray="5 3" dot={rows.length < 8} isAnimationActive={false} connectNulls={false} />
                <Line yAxisId="count" type="monotone" dataKey="successCount" name="Swaps" stroke={SWAPS_COLOR} strokeWidth={1.75} dot={rows.length < 8} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function WeekTip({ active, payload }: TipProps<WeekRow>) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <TooltipFrame title={`Week of ${fmtDate(r.week)} · ${r.days} complete day${r.days === 1 ? "" : "s"}`}>
      <TooltipRow label={EXPLORER_LABEL} value={fmtUsdFull(r.volumeUsd)} color={EXPLORER_COLOR} />
      <TooltipRow label="Swaps (SUCCESS)" value={fmtInt(r.successCount)} color={SWAPS_COLOR} />
      <TooltipRow label="Recipients (hash, est.)" value={fmtInt(r.uniqueRecipients)} />
      <TooltipRow label={`${LLAMA_LABEL}, same days`} value={r.llamaVolume === null ? "DefiLlama incomplete" : fmtUsdFull(r.llamaVolume)} color={LLAMA_COLOR} />
      {r.ratio !== null && <TooltipRow label="1Click share" value={fmtPct(r.ratio, 1)} />}
      {!r.full && <div className="pt-1 text-muted-foreground">Fewer than 7 complete Explorer days in this week.</div>}
    </TooltipFrame>
  );
}
