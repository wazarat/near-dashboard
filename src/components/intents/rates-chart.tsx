"use client";

import { NOT_TRACKED } from "@/lib/coverage";
import { useMemo, useState } from "react";
import { Bar, BarChart, Brush, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, EmptyState, Legend } from "@/components/atlas/chart-card";
import { frameHeight, type ChartFrame } from "@/components/atlas/chart-frame";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { Segmented } from "@/components/ui/segmented";
import { fmtDate, fmtDateShort, fmtInt, fmtMonth, fmtPct } from "@/lib/format";
import type { IntentsSummary } from "@/lib/intents";
import { rangeDays, RANGE_LONG, sliceTail, type Range } from "@/lib/ranges";
import { EXPLORER_LABEL, EXPLORER_QUERY, TRANSFORM_QUERY } from "./labels";

export interface RateRow {
  [key: string]: unknown;
  date: string;
  rows: number;
  success: number | null;
  refunded: number | null;
  failed: number | null;
  /** Remainder: pending, processing and any other status. */
  other: number | null;
  partial: boolean;
}

const STATUS = [
  { key: "success", label: "SUCCESS", color: "var(--status-good)" },
  { key: "refunded", label: "REFUNDED", color: "var(--status-warning)" },
  { key: "failed", label: "FAILED + INCOMPLETE_DEPOSIT", color: "var(--status-critical)" },
  { key: "other", label: "pending / other statuses", color: "var(--tier-none)" },
] as const;

export function rateRows(data: IntentsSummary, range: Range): RateRow[] {
  const n = rangeDays(range, data.days.length);
  return sliceTail(data.days, n).map((d) => {
    const known = [d.successRate, d.refundRate, d.failRate];
    const other = known.every((v) => v !== null) ? Math.max(0, 1 - known.reduce((a, v) => a + (v ?? 0), 0)) : null;
    return { date: d.date, rows: d.rows, success: d.successRate, refunded: d.refundRate, failed: d.failRate, other, partial: d.partial };
  });
}

export function rateTable(rows: RateRow[], range: Range): ChartTableSpec {
  const pct = (v: unknown) => (v === null || v === undefined ? NOT_TRACKED : fmtPct(v as number, 2));
  return {
    caption: "Daily share of 1Click swap rows by final status, Explorer API",
    filename: `intents-status-rates-${range}.csv`,
    maxRows: 120,
    columns: [
      { key: "date", label: "Date" },
      { key: "rows", label: "Rows", align: "right", format: (v) => fmtInt(v as number) },
      { key: "success", label: "SUCCESS", align: "right", format: pct },
      { key: "refunded", label: "REFUNDED", align: "right", format: pct },
      { key: "failed", label: "FAILED + INCOMPLETE_DEPOSIT", align: "right", format: pct },
      { key: "other", label: "Pending / other", align: "right", format: pct },
      { key: "partial", label: "Explorer day", format: (v) => (v === true ? "partial" : "complete") },
    ],
    rows: [...rows].reverse(),
  };
}

type Mode = "all" | "nonsuccess";

export function RatesChart({ data, range }: { data: IntentsSummary; range: Range }) {
  const rows = useMemo(() => rateRows(data, range), [data, range]);
  const [mode, setMode] = useState<Mode>("all");
  const { last30 } = data;

  const takeaway = useMemo(() => {
    if (rows.length === 0) return "No Explorer days yet, so there are no status rates.";
    if (last30.days > 0) {
      return `Over the last ${last30.days} complete day${last30.days === 1 ? "" : "s"}, ${fmtPct(last30.successRate, 1)} of 1Click swap rows ended in SUCCESS, ${fmtPct(last30.refundRate, 1)} were refunded and ${fmtPct(last30.failRate, 2)} failed or never received a full deposit.`;
    }
    const last = rows[rows.length - 1];
    return `Only partial Explorer days so far. On ${fmtDateShort(last.date)} ${fmtPct(last.success, 1)} of ${fmtInt(last.rows)} rows were SUCCESS, ${fmtPct(last.refunded, 1)} refunded and ${fmtPct(last.failed, 2)} failed; the day is still filling in.`;
  }, [rows, last30]);

  const series = mode === "all" ? STATUS : STATUS.filter((s) => s.key !== "success");
  const tickFormat = rows.length > 120 ? fmtMonth : fmtDateShort;
  const partialDays = rows.filter((r) => r.partial).length;

  return (
    <ChartCard
      id="intents-rates"
      scope="whole-chain"
      title="Outcome rates"
      takeaway={takeaway}
      source={EXPLORER_LABEL}
      info={`Share of all rows the Explorer API returned per UTC day by final status, ${EXPLORER_LABEL}. SUCCESS / rows, REFUNDED / rows and (FAILED + INCOMPLETE_DEPOSIT) / rows come straight from the per-day files; the grey remainder is pending, processing and any other status. Window follows the date range control. The 30-day figures in the takeaway use complete days only.`}
      actions={
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "all", label: "All statuses" },
            { value: "nonsuccess", label: "Non-success only" },
          ]}
          ariaLabel="Statuses shown"
        />
      }
      table={rateTable(rows, range)}
      queries={[EXPLORER_QUERY, TRANSFORM_QUERY]}
      footer={
        <span>
          Rates are over every row the Explorer returned for the day, not just SUCCESS swaps. {partialDays > 0 ? `${partialDays} of ${rows.length} days shown are partial and can still change. ` : ""}
          The all-statuses view is a 100% stack; the non-success view rescales the axis so refunds and failures are readable.
        </span>
      }
    >
      {(frame: ChartFrame) => {
        const height = frameHeight(frame, 240);
        return rows.length === 0 ? (
        <EmptyState message="No Explorer days to compute status rates from yet." />
      ) : (
        <div>
          <Legend className="mb-2" items={series.map((s) => ({ label: s.label, color: s.color, shape: "square" as const }))} />
          <div style={{ height: frame.brush ? height + 32 : height }} className="w-full" role="img" aria-label={`Daily share of 1Click swap rows by status over the ${RANGE_LONG[range]}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 8, bottom: frame.brush ? 4 : 0, left: 0 }} barCategoryGap={rows.length > 60 ? 0 : 2}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="date" tickFormatter={tickFormat} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={36} tick={{ fontSize: 11 }} />
                <YAxis
                  domain={mode === "all" ? [0, 1] : [0, "auto"]}
                  ticks={mode === "all" ? [0, 0.25, 0.5, 0.75, 1] : undefined}
                  tickFormatter={(v) => fmtPct(v, mode === "all" ? 0 : 1)}
                  width={48}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} content={<RateTip />} />
                {series.map((s) => (
                  <Bar key={s.key} dataKey={s.key} name={s.label} stackId="status" fill={s.color} isAnimationActive={false} maxBarSize={24} />
                ))}
                {frame.brush && <Brush dataKey="date" height={24} travellerWidth={8} tickFormatter={tickFormat} stroke="var(--axis)" fill="var(--surface-chart)" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
      }}
    </ChartCard>
  );
}

function RateTip({ active, payload }: TipProps<RateRow>) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <TooltipFrame title={`${fmtDate(r.date)} · ${fmtInt(r.rows)} rows${r.partial ? " · partial day" : ""}`}>
      {STATUS.map((s) => (
        <TooltipRow key={s.key} label={s.label} value={fmtPct(r[s.key], 2)} color={s.color} />
      ))}
    </TooltipFrame>
  );
}
