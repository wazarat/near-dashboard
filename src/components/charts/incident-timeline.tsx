"use client";

import { NONE } from "@/lib/coverage";
import { useMemo } from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { EmptyState } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { EVENT_COLOR } from "@/lib/colors";
import { fmtEventDate, fmtMonth, fmtUsd, fmtUsdFull } from "@/lib/format";
import type { EcosystemEvent } from "@/lib/types";

const DAY = 86_400_000;
const INCIDENT = EVENT_COLOR.Incident;
/** Marker area in px²: the floor keeps unstated amounts visible at about 9px across. */
const AREA_MIN = 64;
const AREA_MAX = 900;
/** Two incidents closer than this share a row only when they would otherwise overlap. */
const LANE_GAP_DAYS = 75;

interface Point {
  t: number;
  lane: number;
  /** 0..1 share of the largest stated amount; 0 for unstated. */
  z: number;
  ev: EcosystemEvent;
}

export interface IncidentSummary {
  count: number;
  statedCount: number;
  statedTotal: number;
  largest: EcosystemEvent | null;
  first: EcosystemEvent | null;
  last: EcosystemEvent | null;
}

/** Figures the card's takeaway is built from; everything comes from the events passed in. */
export function summariseIncidents(events: EcosystemEvent[]): IncidentSummary {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const stated = sorted.filter((e) => e.amount !== null && e.amount > 0);
  let largest: EcosystemEvent | null = null;
  for (const e of stated) if (!largest || (e.amount ?? 0) > (largest.amount ?? 0)) largest = e;
  return {
    count: sorted.length,
    statedCount: stated.length,
    statedTotal: stated.reduce((s, e) => s + (e.amount ?? 0), 0),
    largest,
    first: sorted[0] ?? null,
    last: sorted[sorted.length - 1] ?? null,
  };
}

export function incidentTableSpec(events: EcosystemEvent[]): ChartTableSpec {
  const rows = [...events]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => ({
      date: fmtEventDate(e.date, e.monthOnly),
      title: e.title,
      projects: e.projects.join(", "),
      amount: e.amount,
      amountNote: e.amountNote,
      detail: e.detail,
      source: e.sourceUrl,
    }));
  return {
    caption: "Incidents by date with stated amount, note, detail and source",
    filename: "near-atlas-incidents.csv",
    maxRows: 200,
    columns: [
      { key: "date", label: "Date" },
      { key: "title", label: "Incident" },
      { key: "projects", label: "Projects" },
      { key: "amount", label: "Amount (USD)", align: "right", format: (v) => (v === null || v === undefined ? "amount not stated" : fmtUsdFull(v as number)) },
      { key: "amountNote", label: "Amount note", format: (v) => (v ? String(v) : NONE) },
      { key: "detail", label: "Detail", format: (v) => (v ? String(v) : NONE) },
      { key: "source", label: "Source", format: (v) => (v ? String(v) : NONE) },
    ],
    rows,
  };
}

/** Packs dated points into rows so markers close in time do not sit on top of each other. */
function packLanes(points: Array<Omit<Point, "lane">>): Point[] {
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const laneEnd: number[] = [];
  return sorted.map((p) => {
    const gap = LANE_GAP_DAYS * DAY * (0.6 + Math.sqrt(p.z));
    let lane = laneEnd.findIndex((end) => p.t - end >= gap);
    if (lane === -1) {
      lane = laneEnd.length;
      laneEnd.push(p.t);
    } else {
      laneEnd[lane] = p.t;
    }
    return { ...p, lane };
  });
}

export function IncidentTimeline({ events }: { events: EcosystemEvent[] }) {
  const { stated, unstated, lanes, min, max, ticks, yearly } = useMemo(() => {
    const amounts = events.map((e) => e.amount ?? 0).filter((a) => a > 0);
    const maxAmt = Math.max(1, ...amounts);
    const raw = events.map((e) => ({
      t: Date.parse(`${e.date}T00:00:00Z`),
      z: e.amount && e.amount > 0 ? e.amount / maxAmt : 0,
      ev: e,
    }));
    const packed = packLanes(raw);
    const lanes = packed.reduce((m, p) => Math.max(m, p.lane + 1), 1);
    const ts = packed.map((p) => p.t);
    const span = ts.length ? Math.max(...ts) - Math.min(...ts) : 0;
    const pad = Math.max(30 * DAY, span * 0.04);
    const min = ts.length ? Math.min(...ts) - pad : 0;
    const max = ts.length ? Math.max(...ts) + pad : 1;
    const yearly = span > 2.5 * 365 * DAY;
    const ticks: number[] = [];
    if (ts.length) {
      const d = new Date(min);
      d.setUTCDate(1);
      if (yearly) {
        d.setUTCMonth(0);
        d.setUTCFullYear(d.getUTCFullYear() + 1);
      } else {
        d.setUTCMonth(d.getUTCMonth() + 1);
      }
      while (d.getTime() <= max) {
        ticks.push(d.getTime());
        if (yearly) d.setUTCFullYear(d.getUTCFullYear() + 1);
        else d.setUTCMonth(d.getUTCMonth() + 3);
      }
    }
    return {
      stated: packed.filter((p) => p.ev.amount !== null),
      unstated: packed.filter((p) => p.ev.amount === null),
      lanes,
      min,
      max,
      ticks,
      yearly,
    };
  }, [events]);

  if (events.length === 0) return <EmptyState message="No incidents recorded." />;

  const height = Math.max(180, 40 + lanes * 44);
  const open = (d: unknown) => {
    const ev = (d as { payload?: Point })?.payload?.ev ?? (d as Point).ev;
    if (ev?.sourceUrl) window.open(ev.sourceUrl, "_blank", "noopener,noreferrer");
  };
  const tickFormat = (t: number) => {
    const iso = new Date(t).toISOString().slice(0, 10);
    return yearly ? iso.slice(0, 4) : fmtMonth(iso);
  };

  return (
    <div>
      <div style={{ height }} className="w-full" role="img" aria-label={`${events.length} incidents plotted by date; switch to the table view for the full list.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 20, bottom: 4, left: 4 }}>
            <CartesianGrid horizontal={false} stroke="var(--grid)" />
            <XAxis type="number" dataKey="t" domain={[min, max]} ticks={ticks} tickFormatter={tickFormat} tickLine={false} axisLine={false} tick={{ fill: "var(--ink-muted)", fontSize: 11 }} />
            <YAxis type="number" dataKey="lane" domain={[-0.6, lanes - 0.4]} hide reversed />
            <ZAxis type="number" dataKey="z" domain={[0, 1]} range={[AREA_MIN, AREA_MAX]} />
            <Tooltip cursor={false} content={<IncidentTip />} wrapperStyle={{ outline: "none", zIndex: 10 }} />
            <Scatter name="Amount stated" data={stated} fill={INCIDENT} fillOpacity={0.85} stroke="var(--surface-chart)" strokeWidth={2} isAnimationActive={false} onClick={open} style={{ cursor: "pointer" }} />
            <Scatter name="Amount not stated" data={unstated} fill="var(--surface-chart)" stroke={INCIDENT} strokeWidth={2} isAnimationActive={false} onClick={open} style={{ cursor: "pointer" }} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ backgroundColor: INCIDENT }} />
          Amount stated, marker area tracks USD
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-2.5 rounded-full border-2" style={{ borderColor: INCIDENT }} />
          Amount not stated, smallest marker
        </li>
      </ul>
    </div>
  );
}

function IncidentTip({ active, payload }: TipProps<Point>) {
  if (!active || !payload?.length) return null;
  const { ev } = payload[0].payload;
  return (
    <TooltipFrame title={ev.title}>
      <TooltipRow label="Date" color={INCIDENT} value={fmtEventDate(ev.date, ev.monthOnly)} />
      <TooltipRow label="Amount" value={ev.amount === null ? "amount not stated" : fmtUsd(ev.amount)} />
      {ev.amountNote && <p className="leading-snug text-muted-foreground">{ev.amountNote}</p>}
      {ev.projects.length > 0 && <p className="text-muted-foreground">{ev.projects.join(", ")}</p>}
      {ev.detail && <p className="pt-1 leading-snug">{ev.detail}</p>}
      {ev.sourceUrl && <p className="pt-1 text-muted-foreground">Click to open the source</p>}
    </TooltipFrame>
  );
}
