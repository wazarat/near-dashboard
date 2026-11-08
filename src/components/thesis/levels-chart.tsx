"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, EmptyState } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CHART } from "@/lib/colors";
import type { Scale } from "@/lib/filters";
import { fmtDate, fmtInt, fmtMonth, fmtNum, fmtUsd } from "@/lib/format";
import type { ThesisJson, UsageKey } from "@/lib/thesis-types";
import { fmtTimes, INTENTS_LABEL, pickQueries, PRICE_LABEL, USAGE_COLOR } from "./palette";

type SeriesKey = "intentsVolume" | "price" | UsageKey;
interface SeriesDef {
  key: SeriesKey;
  label: string;
  color: string;
  indexed: Array<number | null>;
  raw: Array<number | null>;
  source: string;
}
type Row = { date: string } & Partial<Record<SeriesKey, number | null>>;

function lastValue(xs: Array<number | null>): number | null {
  for (let i = xs.length - 1; i >= 0; i--) if (xs[i] !== null && xs[i] !== undefined) return xs[i];
  return null;
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

interface Props {
  data: ThesisJson;
  scale: Scale;
  onScaleChange: (s: Scale) => void;
}

/** Test 1: every weekly series indexed to 100 at its first week on one axis. */
export function LevelsChart({ data, scale, onScaleChange }: Props) {
  const { weekly, usage, bigqueryWindow, window } = data;
  const series = useMemo<SeriesDef[]>(() => {
    const out: SeriesDef[] = [
      { key: "intentsVolume", label: INTENTS_LABEL, color: CHART.intents, indexed: weekly.indexed.intentsVolume, raw: weekly.intentsVolume, source: "DefiLlama" },
      { key: "price", label: PRICE_LABEL, color: CHART.price, indexed: weekly.indexed.price, raw: weekly.price, source: "NearBlocks" },
    ];
    for (const u of usage) {
      const idx = weekly.indexed.series[u.key];
      const raw = weekly.series[u.key];
      if (idx && raw) out.push({ key: u.key, label: u.label, color: USAGE_COLOR[u.key], indexed: idx, raw, source: u.source });
    }
    return out;
  }, [weekly, usage]);

  const [visible, setVisible] = useState<string[]>(() => series.map((s) => s.key));
  const shown = series.filter((s) => visible.includes(s.key));

  const rows = useMemo<Row[]>(
    () =>
      weekly.dates.map((d, i) => {
        const r: Row = { date: d };
        for (const s of series) {
          const v = s.indexed[i] ?? null;
          r[s.key] = v !== null && (scale === "linear" || v > 0) ? v : null;
        }
        return r;
      }),
    [weekly.dates, series, scale],
  );

  const takeaway = useMemo(() => {
    if (!weekly.dates.length) return "No weekly rows yet.";
    const ends = series.map((s) => ({ ...s, end: lastValue(s.indexed) }));
    const bySource = (src: string) => ends.filter((s) => s.source === src && s.end !== null && s.key !== "intentsVolume" && s.key !== "price");
    const intents = ends.find((s) => s.key === "intentsVolume")?.end ?? null;
    const price = ends.find((s) => s.key === "price")?.end ?? null;
    const nb = bySource("NearBlocks").map((s) => `${s.label.toLowerCase()} ${fmtTimes((s.end as number) / 100)}`);
    const bq = bySource("BigQuery").map((s) => `${s.label.toLowerCase()} ${fmtTimes((s.end as number) / 100)}`);
    const head = `Since the week of ${fmtDate(weekly.dates[0])} Intents volume is ${fmtTimes(intents === null ? null : intents / 100)} its first week while ${joinList([...nb, `price ${fmtTimes(price === null ? null : price / 100)}`])}`;
    const tail = bq.length && bigqueryWindow.start ? `; ${joinList(bq)} are indexed to their own first BigQuery week (${fmtDate(bigqueryWindow.start)})` : "";
    return `${head}${tail}.`;
  }, [series, weekly.dates, bigqueryWindow.start]);

  const table: ChartTableSpec = {
    columns: [
      { key: "date", label: "Week (Monday)" },
      ...series.map((s) => ({
        key: `raw_${s.key}`,
        label: s.key === "intentsVolume" ? "Intents volume (USD)" : s.key === "price" ? "NEAR price (USD)" : s.label,
        align: "right" as const,
        format: (v: unknown) => (s.key === "intentsVolume" ? fmtUsd(v as number | null) : s.key === "price" ? (v === null ? "—" : `$${fmtNum(v as number, 2)}`) : fmtInt(v as number | null)),
      })),
      ...series.map((s) => ({ key: `idx_${s.key}`, label: `${s.label} (index)`, align: "right" as const, format: (v: unknown) => fmtNum(v as number | null, 1) })),
    ],
    rows: weekly.dates
      .map((d, i) => {
        const r: Record<string, unknown> = { date: d };
        for (const s of series) {
          r[`raw_${s.key}`] = s.raw[i] ?? null;
          r[`idx_${s.key}`] = s.indexed[i] ?? null;
        }
        return r;
      })
      .reverse(),
    caption: "Weekly series, raw and indexed to 100 at the first week",
    filename: "thesis-levels-weekly.csv",
    maxRows: 120,
  };

  return (
    <ChartCard
      title="Test 1 · Levels, indexed to 100"
      takeaway={takeaway}
      info={`Weekly sums (flows) or last values (price) over ${window.weeks} ISO weeks, each divided by its first positive week and multiplied by 100 so series of very different size share one axis. Intents volume is DefiLlama's NEAR Intents adapter; price and the chain-level counts are NearBlocks daily charts; function calls and contracts called are the NEAR BigQuery public dataset and only exist for its ${bigqueryWindow.weeks}-week window. A log axis keeps the small movers readable next to Intents volume.`}
      scale={scale}
      onScaleChange={onScaleChange}
      table={table}
      queries={pickQueries(data.queries, ["intentsLlama", "nearblocks", "dailyChain", "dailyReceipts", "weekly"])}
      footer={<span>Toggle a series to hide or show it; colours stay fixed per series. 100 = the series&apos; first week with data.</span>}
    >
      {series.length === 0 || weekly.dates.length === 0 ? (
        <EmptyState message="No weekly series in thesis.json. Run npm run rebuild." />
      ) : (
        <div>
          <ToggleGroup type="multiple" variant="outline" size="sm" value={visible} onValueChange={(v) => setVisible(v)} aria-label="Series shown" className="mb-2 flex flex-wrap justify-start gap-1">
            {series.map((s) => (
              <ToggleGroupItem key={s.key} value={s.key} className="h-7 gap-1.5 px-2 text-xs data-[state=off]:text-muted-foreground data-[state=off]:line-through" aria-label={`${s.label}, ${visible.includes(s.key) ? "shown" : "hidden"}`}>
                <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ backgroundColor: s.color, opacity: visible.includes(s.key) ? 1 : 0.35 }} />
                {s.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {shown.length === 0 ? (
            <EmptyState message="Every series is hidden. Turn one on above." />
          ) : (
            <div className="h-72 w-full sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="date" tickFormatter={fmtMonth} tickLine={false} axisLine={false} minTickGap={40} />
                  <YAxis scale={scale === "log" ? "log" : "linear"} domain={["auto", "auto"]} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : fmtNum(v, v < 1 ? 1 : 0))} width={44} tickLine={false} axisLine={false} allowDataOverflow />
                  <ReferenceLine y={100} stroke={CHART.axis} strokeDasharray="3 3" label={{ value: "100 = first week", position: "insideTopRight", fontSize: 10, fill: CHART.muted }} />
                  <Tooltip cursor={{ stroke: CHART.axis }} content={<LevelsTip shown={shown} />} />
                  {shown.map((s) => (
                    <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={s.key === "intentsVolume" ? 2.25 : 1.75} dot={false} isAnimationActive={false} connectNulls={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </ChartCard>
  );
}

function LevelsTip({ active, payload, shown }: TipProps<Row> & { shown: SeriesDef[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <TooltipFrame title={`Week of ${fmtDate(row.date)}`}>
      {shown.map((s) => {
        const v = row[s.key];
        return <TooltipRow key={s.key} label={s.label} value={v === null || v === undefined ? "—" : `${fmtNum(v, 1)} (${fmtTimes(v / 100)})`} color={s.color} />;
      })}
    </TooltipFrame>
  );
}
