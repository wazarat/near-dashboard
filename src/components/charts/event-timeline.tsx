"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { EmptyState } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { Toggle } from "@/components/ui/toggle";
import { EVENT_COLOR, EVENT_ORDER } from "@/lib/colors";
import { meta } from "@/lib/data";
import { displayUrl, fmtEventDate, fmtMonth, fmtUsd, fmtUsdFull } from "@/lib/format";
import type { EcosystemEvent, EventType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Point {
  t: number;
  lane: number;
  size: number;
  ev: EcosystemEvent;
}

const DAY = 86_400_000;
const MIN_SIZE = 30;
const MAX_SIZE = 420;
/** Area for events that carry no USD amount. */
const NO_AMOUNT_SIZE = MIN_SIZE;

export function eventTable(events: EcosystemEvent[]): ChartTableSpec {
  const rows = [...events]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => ({
      date: fmtEventDate(e.date, e.monthOnly),
      type: e.type,
      title: e.title,
      projects: e.projects.join(", "),
      amount: e.amount,
      amountNote: e.amountNote,
      source: e.sourceUrl,
    }));
  return {
    caption: "Ecosystem events",
    filename: "events.csv",
    maxRows: 200,
    columns: [
      { key: "date", label: "Date" },
      { key: "type", label: "Type" },
      { key: "title", label: "Title" },
      { key: "projects", label: "Projects", format: (v) => (v ? String(v) : "—") },
      { key: "amount", label: "Amount (USD)", align: "right", format: (v) => (v === null ? "—" : fmtUsdFull(v as number)) },
      { key: "amountNote", label: "Amount note", format: (v) => (v ? String(v) : "—") },
      { key: "source", label: "Source", format: (v) => (v ? displayUrl(String(v)) : "—") },
    ],
    rows,
  };
}

interface Props {
  events: EcosystemEvent[];
  initialTypes?: EventType[];
  height?: number;
}

export function EventTimeline({ events, initialTypes, height = 320 }: Props) {
  const [on, setOn] = useState<Set<EventType>>(() => new Set(initialTypes ?? EVENT_ORDER));
  const lanes = EVENT_ORDER;

  const { data, min, max, ticks } = useMemo(() => {
    const amounts = events.map((e) => e.amount ?? 0).filter((a) => a > 0);
    // Amounts span seed rounds to cumulative-volume milestones, several orders of
    // magnitude apart, so marker area follows log10(amount) between the smallest
    // and largest recorded figure. Events without an amount get the fixed minimum.
    const lo = amounts.length ? Math.log10(Math.min(...amounts)) : 0;
    const hi = amounts.length ? Math.log10(Math.max(...amounts)) : 0;
    const span = hi - lo;
    const pts: Point[] = events.map((e) => {
      let size = NO_AMOUNT_SIZE;
      if (e.amount && e.amount > 0) {
        const t = span > 0 ? (Math.log10(e.amount) - lo) / span : 0.5;
        size = MIN_SIZE + 30 + (MAX_SIZE - MIN_SIZE - 30) * t;
      }
      return { t: Date.parse(`${e.date}T00:00:00Z`), lane: lanes.indexOf(e.type), size, ev: e };
    });
    const ts = pts.map((p) => p.t);
    // With no events the axis is anchored on the dataset's as-of date.
    const anchor = Date.parse(`${meta.asOf.slice(0, 10)}T00:00:00Z`);
    const min = (ts.length ? Math.min(...ts) : anchor) - 30 * DAY;
    const max = (ts.length ? Math.max(...ts) : anchor) + 30 * DAY;
    const ticks: number[] = [];
    const d = new Date(min);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() < 6 ? 6 : 12);
    while (d.getTime() <= max) {
      ticks.push(d.getTime());
      d.setUTCMonth(d.getUTCMonth() + 6);
    }
    return { data: pts, min, max, ticks };
  }, [events, lanes]);

  const visible = data.filter((p) => on.has(p.ev.type));

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Event types">
        {lanes.map((type) => {
          const count = data.filter((p) => p.ev.type === type).length;
          const active = on.has(type);
          return (
            <Toggle
              key={type}
              size="sm"
              variant="outline"
              pressed={active}
              onPressedChange={(v) =>
                setOn((prev) => {
                  const next = new Set(prev);
                  if (v) next.add(type);
                  else next.delete(type);
                  return next;
                })
              }
              className={cn("h-7 gap-1.5 px-2 text-xs", !active && "opacity-60")}
              aria-label={`${active ? "Hide" : "Show"} ${type} events`}
            >
              <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ backgroundColor: EVENT_COLOR[type] }} />
              {type} <span className="tabular text-muted-foreground">{count}</span>
            </Toggle>
          );
        })}
      </div>
      {events.length === 0 ? (
        <EmptyState message="No events to show." />
      ) : visible.length === 0 ? (
        <EmptyState message="Every event type is hidden. Turn one back on above." />
      ) : (
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" />
              <XAxis
                type="number"
                dataKey="t"
                domain={[min, max]}
                ticks={ticks}
                tickFormatter={(t) => fmtMonth(new Date(t).toISOString().slice(0, 10))}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                type="number"
                dataKey="lane"
                domain={[-0.6, lanes.length - 0.4]}
                ticks={lanes.map((_, i) => i)}
                tickFormatter={(i) => lanes[i] ?? ""}
                width={82}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                reversed
              />
              <ZAxis type="number" dataKey="size" range={[MIN_SIZE, MAX_SIZE]} />
              <Tooltip cursor={false} content={<EventTip />} />
              {lanes.map((type) => (
                <Scatter
                  key={type}
                  name={type}
                  data={visible.filter((p) => p.ev.type === type)}
                  fill={EVENT_COLOR[type]}
                  fillOpacity={0.85}
                  stroke="var(--background)"
                  strokeWidth={2}
                  isAnimationActive={false}
                  onClick={(item) => {
                    const ev = (item as { payload?: Point }).payload?.ev;
                    if (ev?.sourceUrl) window.open(ev.sourceUrl, "_blank", "noopener,noreferrer");
                  }}
                  style={{ cursor: "pointer" }}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        Marker area grows with the recorded Amount (USD) on a log scale; events without an amount use the smallest marker. Month-only dates sit on the first of the month. Click a marker to open its source; the
        table view lists every source link.
      </p>
    </div>
  );
}

function EventTip({ active, payload }: TipProps<Point>) {
  if (!active || !payload?.length) return null;
  const { ev } = payload[0].payload;
  return (
    <TooltipFrame title={ev.title}>
      <TooltipRow label={ev.type} color={EVENT_COLOR[ev.type]} value={fmtEventDate(ev.date, ev.monthOnly)} />
      {ev.amount !== null && <TooltipRow label={ev.amountNote ?? "Amount"} value={fmtUsd(ev.amount)} />}
      {ev.amount === null && ev.amountNote && <TooltipRow label="Amount" value={ev.amountNote} />}
      {ev.projects.length > 0 && <div className="text-muted-foreground">{ev.projects.join(", ")}</div>}
      {ev.detail && <p className="pt-1 leading-snug">{ev.detail}</p>}
      {ev.sourceUrl && <div className="pt-1 text-muted-foreground">Click to open {displayUrl(ev.sourceUrl).split("/")[0]}</div>}
    </TooltipFrame>
  );
}
