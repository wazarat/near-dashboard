"use client";

import { NOT_TRACKED } from "@/lib/coverage";
import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, EmptyState, Legend } from "@/components/atlas/chart-card";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/ui/segmented";
import { CAT } from "@/lib/colors";
import { alignByFirstData, indexTo100, numericMetric, seriesFor } from "@/lib/compare";
import type { Align } from "@/lib/filters";
import { fmtDateShort, METRIC_LABEL } from "@/lib/format";
import { RANGE_LONG, rangeDays, sliceTail, type Range } from "@/lib/ranges";
import type { MetricKey, Project, SeriesFile } from "@/lib/types";
import { useSeries } from "@/lib/use-series";

type Row = Record<string, number | string | null>;

interface Built {
  rows: Row[];
  /** Positions in `projects` that have no history for the metric in this range. */
  skipped: number[];
  /** Date the index is anchored to (date mode), or null. */
  anchor: string | null;
  empty: boolean;
}

/** Builds the Recharts rows for either alignment. Pure, so it can be reasoned about outside React. */
export function buildOverlay(file: SeriesFile | null, ids: readonly string[], metric: MetricKey, range: Range, align: Align): Built {
  if (!file) return { rows: [], skipped: [], anchor: null, empty: false };
  const n = rangeDays(range, file.dates.length);
  const dates = sliceTail(file.dates, n);
  const raw = seriesFor(file, ids, numericMetric(metric)).map((s) => sliceTail(s, n));
  if (align === "days") {
    const aligned = alignByFirstData(raw);
    const len = aligned.reduce((a, s) => Math.max(a, s.length), 0);
    const rows = Array.from({ length: len }, (_, i) => {
      const r: Row = { x: i };
      ids.forEach((id, k) => (r[id] = aligned[k][i] ?? null));
      return r;
    });
    return { rows, skipped: aligned.map((s, k) => (s.length ? -1 : k)).filter((k) => k >= 0), anchor: null, empty: len === 0 };
  }
  const { start, indexed, skipped } = indexTo100(raw);
  if (start === -1) return { rows: [], skipped, anchor: null, empty: true };
  const rows = dates.slice(start).map((d, j) => {
    const i = j + start;
    const r: Row = { x: d };
    ids.forEach((id, k) => (r[id] = indexed[k][i]));
    return r;
  });
  return { rows, skipped, anchor: dates[start], empty: rows.length === 0 };
}

interface Props {
  projects: Project[];
  metric: MetricKey;
  range: Range;
  align: Align;
  onAlignChange: (a: Align) => void;
}

/** Up to four indexed lines (100 = shared start) so growth can be compared regardless of size. */
export function CompareOverlay({ projects, metric, range, align, onAlignChange }: Props) {
  const file = useSeries();
  const m = numericMetric(metric);
  const label = METRIC_LABEL[m];
  const built = useMemo(() => buildOverlay(file, projects.map((p) => p.id), metric, range, align), [file, projects, metric, range, align]);
  const { rows, skipped, anchor, empty } = built;

  const last = rows[rows.length - 1];
  const finish = last
    ? projects
        .map((p, i) => ({ p, v: typeof last[p.id] === "number" ? (last[p.id] as number) : null, i }))
        .filter((x): x is { p: Project; v: number; i: number } => x.v !== null)
        .sort((a, b) => b.v - a.v)
    : [];

  const takeaway = !file
    ? "Loading daily history."
    : empty
      ? `No overlapping daily ${label.toLowerCase()} history for these projects over the ${RANGE_LONG[range]}.`
      : finish.length >= 2
        ? `${finish[0].p.name} ends at ${finish[0].v.toFixed(0)} against ${finish[finish.length - 1].p.name} at ${finish[finish.length - 1].v.toFixed(0)} (start = 100${align === "days" ? ", each on its own first day with data" : anchor ? `, anchored on ${fmtDateShort(anchor)}` : ""}).`
        : finish.length === 1
          ? `Only ${finish[0].p.name} has ${label.toLowerCase()} history in this range; it ends at ${finish[0].v.toFixed(0)} (start = 100).`
          : `Lines show ${label.toLowerCase()} indexed to 100 at the shared start.`;

  return (
    <ChartCard
      scope="selection"
      id="compare-overlay"
      title={`${label} trend, indexed`}
      takeaway={takeaway}
      info="DefiLlama daily history (TVL as a level; volume, fees and revenue as daily flows). Every line is divided by its value on the start date and multiplied by 100, which removes size so growth rates line up. In the days view each project is re-based on its own first day with data so launches of different ages can be read together."
      actions={
        <Segmented<Align>
          value={align}
          onChange={onAlignChange}
          options={[
            { value: "date", label: "By date" },
            { value: "days", label: "Days since first data" },
          ]}
          ariaLabel="Align series"
        />
      }
      table={{
        caption: `${label} indexed to 100`,
        columns: [{ key: "x", label: align === "days" ? "Day" : "Date" }, ...projects.map((p) => ({ key: p.id, label: p.name, align: "right" as const, format: (v: unknown) => (typeof v === "number" ? v.toFixed(1) : NOT_TRACKED) }))],
        rows: rows as Record<string, unknown>[],
        filename: `compare-${m}-indexed.csv`,
        maxRows: 200,
      }}
    >
      {!file ? (
        <Skeleton className="h-[240px] w-full" aria-label="Loading history" />
      ) : projects.length === 0 ? (
        <EmptyState message="No projects selected." />
      ) : empty ? (
        <EmptyState message={`Pick projects with daily ${label.toLowerCase()} history on DefiLlama, or widen the range.`} />
      ) : (
        <div>
          <Legend className="mb-2" items={projects.map((p, i) => ({ label: p.name, color: CAT[i], shape: "line" as const }))} />
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="x" tickFormatter={(v) => (align === "days" ? `d${v}` : fmtDateShort(String(v)))} tickLine={false} axisLine={false} minTickGap={32} tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => String(Math.round(Number(v)))} width={40} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <ReferenceLine y={100} stroke="var(--axis)" strokeDasharray="3 3" label={{ value: "100", position: "insideTopLeft", fontSize: 10, fill: "var(--ink-muted)" }} />
                <Tooltip content={<OverlayTip projects={projects} align={align} />} cursor={{ stroke: "var(--axis)" }} />
                {projects.map((p, i) => (
                  <Line key={p.id} type="monotone" dataKey={p.id} name={p.name} stroke={CAT[i]} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-ink-300">
            {label} indexed to 100{align === "days" ? " on each project's first day with data" : anchor ? ` on ${fmtDateShort(anchor)}` : ""}; colours follow the order of the selection.
            {skipped.length > 0 && ` No daily ${label.toLowerCase()} history for ${skipped.map((k) => projects[k].name).join(", ")}.`}
          </p>
        </div>
      )}
    </ChartCard>
  );
}

function OverlayTip({ active, payload, projects, align }: TipProps<Row> & { projects: Project[]; align: Align }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <TooltipFrame title={align === "days" ? `Day ${r.x}` : fmtDateShort(String(r.x))}>
      {projects.map((p, i) => (
        <TooltipRow key={p.id} label={p.name} color={CAT[i]} value={typeof r[p.id] === "number" ? (r[p.id] as number).toFixed(1) : NOT_TRACKED} />
      ))}
    </TooltipFrame>
  );
}
