"use client";

import { NOT_TRACKED } from "@/lib/coverage";
import { useMemo } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, EmptyState, Legend } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { dateRange } from "@/lib/dates";
import type { Scale } from "@/lib/filters";
import { fmtDate, fmtDateShort, fmtInt, fmtMonth, fmtPct, fmtUsd, fmtUsdFull } from "@/lib/format";
import type { Series } from "@/lib/history-types";
import type { IntentsSummary } from "@/lib/intents";
import { rangeDays, RANGE_LONG, sliceTail, type Range } from "@/lib/ranges";
import { EXPLORER_COLOR, EXPLORER_LABEL, EXPLORER_QUERY, LLAMA_COLOR, LLAMA_LABEL, LLAMA_QUERY, TRANSFORM_QUERY } from "./labels";

export interface VolumeRow {
  [key: string]: unknown;
  date: string;
  /** Explorer 1Click SUCCESS volume, null when the Explorer has no file for the day. */
  explorer: number | null;
  /** DefiLlama all-channel volume, null when DefiLlama has no point for the day. */
  llama: number | null;
  swaps: number | null;
  recipients: number | null;
  partial: boolean;
  ratio: number | null;
}

type Data = IntentsSummary & { llamaDaily: Series };

/** One row per UTC day across the union of both sources, cut to the global range. */
export function volumeRows(data: Data, range: Range): VolumeRow[] {
  const byDay = new Map(data.days.map((d) => [d.date, d]));
  const llama = new Map(data.llamaDaily);
  const starts = [data.llamaDaily[0]?.[0], data.days[0]?.date].filter((v): v is string => typeof v === "string");
  const ends = [data.llamaDaily.at(-1)?.[0], data.days.at(-1)?.date].filter((v): v is string => typeof v === "string");
  if (starts.length === 0 || ends.length === 0) return [];
  const all = dateRange(starts.reduce((a, b) => (a < b ? a : b)), ends.reduce((a, b) => (a > b ? a : b)));
  const n = rangeDays(range, all.length);
  return sliceTail(all, n).map((date) => {
    const d = byDay.get(date);
    return {
      date,
      explorer: d ? d.volumeUsd : null,
      llama: llama.get(date) ?? null,
      swaps: d ? d.successCount : null,
      recipients: d ? d.uniqueRecipients : null,
      partial: d?.partial ?? false,
      ratio: d?.ratio ?? null,
    };
  });
}

export function volumeTable(rows: VolumeRow[], range: Range): ChartTableSpec {
  const usd = (v: unknown) => (v === null || v === undefined ? NOT_TRACKED : fmtUsdFull(v as number));
  return {
    caption: "Daily NEAR Intents volume, 1Click swaps from the Explorer API against DefiLlama's all-channel series",
    filename: `intents-daily-volume-${range}.csv`,
    maxRows: 120,
    columns: [
      { key: "date", label: "Date" },
      { key: "explorer", label: "1Click volume (Explorer)", align: "right", format: usd },
      { key: "swaps", label: "Swaps (SUCCESS)", align: "right", format: (v) => (v === null ? NOT_TRACKED : fmtInt(v as number)) },
      { key: "recipients", label: "Recipients (hash, est.)", align: "right", format: (v) => (v === null ? NOT_TRACKED : fmtInt(v as number)) },
      { key: "llama", label: "All channels (DefiLlama)", align: "right", format: usd },
      { key: "ratio", label: "1Click / DefiLlama", align: "right", format: (v) => (v === null ? NOT_TRACKED : fmtPct(v as number, 1)) },
      { key: "partial", label: "Explorer day", format: (v) => (v === true ? "partial" : "complete") },
    ],
    rows: [...rows].reverse().map((r) => ({ ...r, partial: r.explorer === null ? null : r.partial })),
  };
}

const PARTIAL_PATTERN = "intents-partial-day";

export function VolumeChart({ data, range, scale, onScaleChange }: { data: Data; range: Range; scale: Scale; onScaleChange: (s: Scale) => void }) {
  const rows = useMemo(() => volumeRows(data, range), [data, range]);
  const useLog = scale === "log";

  const takeaway = useMemo(() => {
    if (rows.length === 0) return "No NEAR Intents volume history yet. Run npm run refresh to fetch DefiLlama's series and the Explorer backfill.";
    const both = rows.filter((r) => r.explorer !== null && r.llama !== null && r.llama > 0 && !r.partial);
    const llamaWindow = rows.reduce((a, r) => a + (r.llama ?? 0), 0);
    const llama30 = data.llamaDaily.slice(-30);
    const llama30Sum = llama30.length ? llama30.reduce((a, [, v]) => a + v, 0) : null;
    const llama30Text = llama30Sum === null ? "DefiLlama has no 30-day total yet" : `DefiLlama's ${llama30.length < 30 ? `${llama30.length}-day` : "30-day"} total is ${fmtUsd(llama30Sum)}`;
    if (both.length === 0) {
      return `DefiLlama shows ${fmtUsd(llamaWindow)} of NEAR Intents volume over the ${RANGE_LONG[range]}; no complete 1Click Explorer day overlaps it yet, so no share can be computed. ${llama30Text}.`;
    }
    const ex = both.reduce((a, r) => a + (r.explorer ?? 0), 0);
    const ll = both.reduce((a, r) => a + (r.llama ?? 0), 0);
    return `Over the last ${both.length} complete day${both.length === 1 ? "" : "s"} with both sources, 1Click swaps were ${fmtPct(ex / ll)} of DefiLlama's NEAR Intents volume (${fmtUsd(ex)} of ${fmtUsd(ll)}); ${llama30Text}.`;
  }, [rows, data.llamaDaily, range]);

  const plotted = useMemo(
    () => (useLog ? rows.map((r) => ({ ...r, explorer: r.explorer !== null && r.explorer > 0 ? r.explorer : null, llama: r.llama !== null && r.llama > 0 ? r.llama : null })) : rows),
    [rows, useLog],
  );
  const explorerDays = rows.filter((r) => r.explorer !== null).length;
  const partialDays = rows.filter((r) => r.explorer !== null && r.partial).length;
  const tickFormat = rows.length > 120 ? fmtMonth : fmtDateShort;

  return (
    <ChartCard
      scope="whole-chain"
      title="Daily volume"
      takeaway={takeaway}
      info={`Bars show ${EXPLORER_LABEL}, the sum of amountInUsd for SUCCESS swaps per UTC day of createdAt. The line shows ${LLAMA_LABEL}, DefiLlama's "NEAR Intents" entry in the NEAR DEX overview. The Explorer covers 1Click swaps only and its backfill is still filling in older days; DefiLlama covers every channel from ${data.llamaDaily[0]?.[0] ? fmtDate(data.llamaDaily[0][0]) : "its first day"}. Window follows the date range control.`}
      scale={scale}
      onScaleChange={onScaleChange}
      table={volumeTable(rows, range)}
      queries={[EXPLORER_QUERY, LLAMA_QUERY, TRANSFORM_QUERY]}
      footer={
        <span>
          Bars are {EXPLORER_LABEL}; hatched bars are partial Explorer days (the backfill cursor stopped inside the day, or the day is still open). The line is {LLAMA_LABEL}. The current UTC day is partial in both sources until it closes.
          {rows.length > 0 && ` ${rows.length} days shown, ${explorerDays} with Explorer data${partialDays ? ` (${partialDays} partial)` : ""}.`}
        </span>
      }
    >
      {rows.length === 0 ? (
        <EmptyState message="No volume history yet." />
      ) : (
        <div>
          <Legend
            className="mb-2"
            items={[
              { label: EXPLORER_LABEL, color: EXPLORER_COLOR, shape: "square" },
              { label: "partial Explorer day", color: EXPLORER_COLOR, shape: "hatch" },
              { label: LLAMA_LABEL, color: LLAMA_COLOR, shape: "line" },
            ]}
          />
          <div className="h-[280px] w-full" role="img" aria-label="Daily NEAR Intents volume, 1Click swaps as bars and DefiLlama all-channel volume as a line">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={plotted} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={rows.length > 60 ? 0 : 2}>
                <defs>
                  <pattern id={PARTIAL_PATTERN} patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
                    <rect width={6} height={6} fill="var(--surface-chart)" />
                    <line x1={0} y1={0} x2={0} y2={6} stroke={EXPLORER_COLOR} strokeWidth={2} />
                  </pattern>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="date" tickFormatter={tickFormat} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={36} tick={{ fontSize: 11 }} />
                <YAxis
                  scale={useLog ? "log" : "linear"}
                  domain={useLog ? [1, "auto"] : [0, "auto"]}
                  allowDataOverflow={useLog}
                  tickFormatter={(v) => fmtUsd(v, { digits: 0 })}
                  width={56}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} content={<VolumeTip />} />
                <Bar dataKey="explorer" name={EXPLORER_LABEL} fill={EXPLORER_COLOR} isAnimationActive={false} maxBarSize={18}>
                  {plotted.map((r) => (
                    <Cell key={r.date} fill={r.partial ? `url(#${PARTIAL_PATTERN})` : EXPLORER_COLOR} stroke={r.partial ? EXPLORER_COLOR : undefined} strokeWidth={r.partial ? 1 : 0} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="llama" name={LLAMA_LABEL} stroke={LLAMA_COLOR} strokeWidth={1.75} dot={false} isAnimationActive={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {useLog && <p className="mt-1 text-xs text-muted-foreground">Log axis, days with zero volume are not drawn.</p>}
        </div>
      )}
    </ChartCard>
  );
}

function VolumeTip({ active, payload }: TipProps<VolumeRow>) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <TooltipFrame title={fmtDate(r.date)}>
      <TooltipRow label={EXPLORER_LABEL} value={r.explorer === null ? "no Explorer data" : fmtUsdFull(r.explorer)} color={EXPLORER_COLOR} />
      {r.swaps !== null && <TooltipRow label="Swaps (SUCCESS)" value={fmtInt(r.swaps)} />}
      {r.recipients !== null && <TooltipRow label="Recipients (hash, est.)" value={fmtInt(r.recipients)} />}
      <TooltipRow label={LLAMA_LABEL} value={r.llama === null ? "no DefiLlama point" : fmtUsdFull(r.llama)} color={LLAMA_COLOR} />
      {r.ratio !== null && <TooltipRow label="1Click share" value={fmtPct(r.ratio, 1)} />}
      {r.explorer !== null && r.partial && <div className="pt-1 text-muted-foreground">Partial Explorer day, more rows may still arrive.</div>}
    </TooltipFrame>
  );
}
