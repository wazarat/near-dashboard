"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { ChartCard, EmptyState } from "@/components/atlas/chart-card";
import { frameHeight, type ChartFrame } from "@/components/atlas/chart-frame";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { EVENT_COLOR, EVENT_ORDER } from "@/lib/colors";
import { NONE } from "@/lib/coverage";
import { meta } from "@/lib/data";
import { useFilters } from "@/lib/filters";
import { displayUrl, fmtEventDate, fmtInt, fmtMonth, fmtMonthYear, fmtUsd, fmtUsdFull } from "@/lib/format";
import { countByType, splitTimeline } from "@/lib/timeline";
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

/** The four columns the standard asks for, plus the USD amount this atlas keeps on the page. */
const EVENT_COLUMNS: ChartTableSpec["columns"] = [
  { key: "date", label: "Date" },
  { key: "type", label: "Type" },
  { key: "title", label: "Event", primary: true },
  { key: "projects", label: "Projects", format: (v) => (v ? String(v) : NONE) },
  { key: "amount", label: "Amount (USD)", align: "right", format: (v) => (v === null ? NONE : fmtUsdFull(v as number)) },
];

/**
 * The timeline as a table, newest first (standard section 8). What the amount measures, the detail
 * and the source are one click away in the event pop-up and travel in the CSV with every other field.
 */
export function eventTable(events: EcosystemEvent[]): ChartTableSpec {
  const rows = [...events]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => ({
      id: e.id,
      date: fmtEventDate(e.date, e.monthOnly),
      type: e.type,
      title: e.title,
      projects: e.projects.join(", "),
      amount: e.amount,
      amountNote: e.amountNote,
      detail: e.detail,
      source: e.sourceUrl,
    }));
  return {
    caption: "Ecosystem events",
    filename: "events.csv",
    maxRows: 200,
    columns: EVENT_COLUMNS,
    exportColumns: [
      ...EVENT_COLUMNS,
      { key: "amountNote", label: "Amount note", format: (v) => (v ? String(v) : NONE) },
      { key: "detail", label: "Detail", format: (v) => (v ? String(v) : NONE) },
      { key: "source", label: "Source", format: (v) => (v ? displayUrl(String(v)) : NONE) },
    ],
    rows,
  };
}

/** The summary line: counts over every event, whatever the default start hides. */
export function timelineTakeaway(events: EcosystemEvent[]): string {
  if (events.length === 0) return "No events recorded.";
  const dates = events.map((e) => e.date).sort();
  const counts = countByType(events, EVENT_ORDER).sort((a, b) => b.count - a.count);
  const withAmount = events.filter((e) => e.amount !== null).length;
  const incidents = counts.find((c) => c.type === "Incident")?.count ?? 0;
  return `${fmtInt(events.length)} events from ${fmtMonthYear(dates[0])} to ${fmtMonthYear(dates[dates.length - 1])}. ${counts[0].type} leads with ${counts[0].count}, ${incidents} are incidents, and ${withAmount} carry a USD amount.`;
}

interface Props {
  events: EcosystemEvent[];
  /** ISO date the chart opens on; earlier events collapse behind one toggle. */
  defaultStart: string;
  title?: string;
  id?: string;
  initialTypes?: EventType[];
  height?: number;
  /** Extra explanation after the standard one, e.g. what the events file is. */
  info?: string;
  /** The events are those tagged with a project in the current selection, so the card shows its filter note. */
  filtered?: boolean;
}

/**
 * The shared CanHav Atlas timeline (standard section 8). The card opens on its
 * table; the chart (one lane per type, legend buttons that toggle types and show
 * counts, log-scaled marker area, a note about month-only dates) is its second
 * view. A table row or a chart marker opens the event pop-up (?event=<id>) with
 * the amount, the detail and the source. In the chart, events before
 * `defaultStart` stay one click away.
 */
export function Timeline({ events, defaultStart, title = "Timeline", id = "timeline", initialTypes, height = 320, info, filtered = false }: Props) {
  const [on, setOn] = useState<Set<EventType>>(() => new Set(initialTypes ?? EVENT_ORDER));
  const [showEarlier, setShowEarlier] = useState(false);
  const { openEvent } = useFilters();
  const table = useMemo<ChartTableSpec>(() => ({ ...eventTable(events), onRowClick: (row) => openEvent(String(row.id)) }), [events, openEvent]);
  const lanes = EVENT_ORDER;
  const split = useMemo(() => splitTimeline(events, defaultStart), [events, defaultStart]);
  const inView = showEarlier ? events : split.shown;

  const { data, min, max, ticks } = useMemo(() => {
    const amounts = events.map((e) => e.amount ?? 0).filter((a) => a > 0);
    // Amounts span seed rounds to cumulative-volume milestones, several orders of
    // magnitude apart, so marker area follows log10(amount) between the smallest
    // and largest recorded figure. Events without an amount get the fixed minimum.
    const lo = amounts.length ? Math.log10(Math.min(...amounts)) : 0;
    const hi = amounts.length ? Math.log10(Math.max(...amounts)) : 0;
    const span = hi - lo;
    const pts: Point[] = inView.map((e) => {
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
    const floor = showEarlier ? (ts.length ? Math.min(...ts) : anchor) : Math.min(Date.parse(`${defaultStart}T00:00:00Z`), ts.length ? Math.min(...ts) : anchor);
    const min = floor - 30 * DAY;
    const max = (ts.length ? Math.max(...ts) : anchor) + 30 * DAY;
    const ticks: number[] = [];
    const d = new Date(min);
    d.setUTCDate(1);
    const step = max - min > 4 * 365 * DAY ? 6 : 3;
    d.setUTCMonth(Math.ceil(d.getUTCMonth() / step) * step);
    while (d.getTime() <= max) {
      ticks.push(d.getTime());
      d.setUTCMonth(d.getUTCMonth() + step);
    }
    return { data: pts, min, max, ticks };
  }, [events, inView, lanes, showEarlier, defaultStart]);

  const visible = data.filter((p) => on.has(p.ev.type));
  const counts = countByType(inView, lanes);

  return (
    <ChartCard
      id={id}
      title={title}
      takeaway={filtered && events.length === 0 ? "No recorded event is tagged with a project in this selection." : timelineTakeaway(events)}
      scope={filtered ? "filtered" : "whole-chain"}
      info={`Every dated event from the research events CSV. The card opens on its table, newest first; click a row for the amount, the detail and the source. The chart has one lane per type. Marker area follows the recorded Amount (USD); events without an amount use a fixed minimum size. Dates known only to the month sit on the first of that month and are labelled as month only. The chart opens on ${fmtMonthYear(defaultStart)}; earlier events are one click away and always listed in the table.${info ? ` ${info}` : ""}`}
      source="Research events CSV (data/near-events-*.csv), every row with its source link"
      table={table}
      defaultView="table"
    >
      {(frame: ChartFrame) => (
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Event types">
            {counts.map(({ type, count }) => {
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
                  className={cn("h-7 gap-1.5 rounded-md px-2 text-xs", active ? "text-ink-50" : "text-ink-300")}
                  aria-label={`${active ? "Hide" : "Show"} ${type} events`}
                >
                  <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ backgroundColor: EVENT_COLOR[type] }} />
                  {type} <span className="tabular text-ink-300">{count}</span>
                </Toggle>
              );
            })}
            {split.earlier.length > 0 && (
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setShowEarlier((v) => !v)} aria-pressed={showEarlier}>
                {showEarlier ? `Hide events before ${fmtMonthYear(defaultStart)}` : `Show earlier events (${split.earlier.length})`}
              </Button>
            )}
          </div>
          {events.length === 0 ? (
            <EmptyState message={filtered ? "No recorded event is tagged with a project in this selection." : "No events to show."} />
          ) : visible.length === 0 ? (
            <EmptyState message={inView.length === 0 ? `No events since ${fmtMonthYear(defaultStart)}. Show earlier events to see the rest.` : "Every event type is hidden. Turn one back on above."} />
          ) : (
            <div style={{ height: frameHeight(frame, height) }} className="w-full">
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
                        if (ev) openEvent(ev.id);
                      }}
                      style={{ cursor: "pointer" }}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-1 text-xs text-ink-300">
            Marker area grows with the recorded Amount (USD) on a log scale; events without an amount use the smallest marker. Month-only dates sit on the first of the month. Click a marker for its amount, detail and source.
          </p>
        </div>
      )}
    </ChartCard>
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
      {ev.projects.length > 0 && <div className="text-ink-300">{ev.projects.join(", ")}</div>}
      {ev.detail && <p className="pt-1 leading-snug">{ev.detail}</p>}
      <div className="pt-1 text-ink-300">Click for the detail and source</div>
    </TooltipFrame>
  );
}
