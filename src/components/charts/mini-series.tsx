"use client";

import { Bar, BarChart, Brush, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { fmtDateShort } from "@/lib/format";

interface Props {
  dates: string[];
  values: Array<number | null>;
  kind: "line" | "bar";
  primaryLabel: string;
  height?: number;
  color?: string;
  format: (v: number | null | undefined) => string;
  /** Optional second series drawn as a line (e.g. a DefiLlama cross-check). */
  secondary?: { values: Array<number | null>; label: string; color: string };
  /** Fitted y domain for a level series; flow series leave it unset and start at zero. */
  yDomain?: [number, number];
  /** Render a Brush under the plot, for the expand dialog. */
  brush?: boolean;
}

type Row = { date: string; v: number | null; s?: number | null };

/** Small single-series daily chart used in pop-ups and small multiples. */
export function MiniSeries({ dates, values, kind, primaryLabel, height = 160, color = "var(--cat-1)", format, secondary, yDomain, brush = false }: Props) {
  const rows: Row[] = dates.map((d, i) => ({ date: d, v: values[i] ?? null, s: secondary?.values[i] ?? null }));
  const tickEvery = Math.max(1, Math.floor(rows.length / 5));
  const tip = (
    <Tooltip
      cursor={{ stroke: "var(--axis)", fill: "var(--accent)", opacity: 0.4 }}
      content={<MiniTip primaryLabel={primaryLabel} color={color} format={format} secondary={secondary} />}
    />
  );
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="var(--grid)" />
      <XAxis dataKey="date" tickFormatter={fmtDateShort} interval={tickEvery - 1} tickLine={false} axisLine={false} minTickGap={24} />
      <YAxis domain={yDomain ?? [0, "auto"]} tickFormatter={(v) => format(v)} width={56} tickLine={false} axisLine={false} />
    </>
  );
  const brushEl = brush && rows.length > 3 ? <Brush dataKey="date" height={22} travellerWidth={8} tickFormatter={fmtDateShort} stroke="var(--axis)" fill="var(--surface-chart)" /> : null;
  const margin = { top: 4, right: 8, bottom: brush ? 4 : 0, left: 0 };
  return (
    <div style={{ height: brush ? height + 30 : height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {kind === "bar" ? (
          <BarChart data={rows} margin={margin}>
            {axes}
            {tip}
            <Bar dataKey="v" fill={color} isAnimationActive={false} maxBarSize={18} />
            {secondary && <Line type="monotone" dataKey="s" stroke={secondary.color} dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls={false} />}
            {brushEl}
          </BarChart>
        ) : (
          <LineChart data={rows} margin={margin}>
            {axes}
            {tip}
            <Line type="monotone" dataKey="v" stroke={color} dot={false} strokeWidth={1.75} isAnimationActive={false} connectNulls={false} />
            {secondary && <Line type="monotone" dataKey="s" stroke={secondary.color} dot={false} strokeWidth={1.5} strokeDasharray="4 3" isAnimationActive={false} connectNulls={false} />}
            {brushEl}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function MiniTip({ active, payload, primaryLabel, color, format, secondary }: TipProps<Row> & Pick<Props, "primaryLabel" | "color" | "format" | "secondary">) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipFrame title={fmtDateShort(d.date)}>
      <TooltipRow label={primaryLabel} value={format(d.v)} color={color} />
      {secondary && <TooltipRow label={secondary.label} value={format(d.s)} color={secondary.color} />}
    </TooltipFrame>
  );
}
