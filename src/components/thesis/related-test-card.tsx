"use client";

import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, EmptyState, Legend } from "@/components/atlas/chart-card";
import type { ChartFrame } from "@/components/atlas/chart-frame";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { CHART } from "@/lib/colors";
import { fmtNum, fmtPct } from "@/lib/format";
import type { RelatedTest } from "@/lib/thesis-types";
import { TestStatusLine } from "./test-status";

/** A test whose data is not committed: no chart to draw, so the card says why and shows the query that would fill it. */
function UncomputedCard({ test }: { test: RelatedTest }) {
  return (
    <div className="space-y-3" id={`test-${test.id}`}>
      <section className="space-y-2 rounded-lg border bg-card p-4" aria-labelledby={`test-${test.id}-title`}>
        <h3 id={`test-${test.id}-title`} className="text-sm font-semibold text-ink-50">
          Test {test.code} · {test.title}
        </h3>
        <p className="text-sm text-ink-50">{test.result}</p>
        {test.queries.length > 0 && (
          <details className="text-xs text-ink-300">
            <summary className="cursor-pointer">The query this test needs</summary>
            {test.queries.map((q) => (
              <div key={q.title} className="mt-2">
                <div className="font-medium">{q.title}</div>
                <pre className="mt-1 overflow-x-auto rounded-md border p-2 text-[11px]">
                  <code>{q.code}</code>
                </pre>
              </div>
            ))}
          </details>
        )}
      </section>
      <TestStatusLine status={test.status} rule={test.rule} />
    </div>
  );
}

const COLORS = [CHART.intents, CHART.usage, CHART.price, "var(--cat-3)"];

/** One related test (B1 to B6) as a card. its chart, the Query tab, one plain sentence and the pass or fail line. */
export function RelatedTestCard({ test }: { test: RelatedTest }) {
  const { chart } = test;
  const fmt = (v: number | null | undefined) => (chart?.unit === "pct" ? fmtPct(v ?? null, 0) : chart?.unit === "usd" ? `$${fmtNum(v ?? null, 0)}` : fmtNum(v ?? null, 0));
  const points = chart ? chart.x.map((x, i) => ({ x, ...Object.fromEntries(chart.series.map((s) => [s.key, s.values[i]])) })) : [];
  const table: ChartTableSpec | undefined = chart
    ? {
        columns: [{ key: "x", label: chart.x[0]?.length === 7 ? "Month" : "Week" }, ...chart.series.map((s) => ({ key: s.key, label: s.label, align: "right" as const, format: (v: unknown) => fmt(v as number | null) }))],
        rows: points,
        caption: test.title,
        filename: `thesis-${test.id}.csv`,
      }
    : undefined;
  if (!chart || !points.length) return <UncomputedCard test={test} />;
  return (
    <div className="space-y-3" id={`test-${test.id}`}>
      <ChartCard takeawayPlacement="inline" scope="whole-chain" id={`thesis-${test.id}`} title={`Test ${test.code} · ${test.title}`} takeaway={test.result} info={test.rule} table={table} queries={test.queries}>
        {(frame: ChartFrame) =>
          !chart || !points.length ? (
            <EmptyState message={test.result} />
          ) : (
            <div className="space-y-3">
              <Legend items={chart.series.map((s, i) => ({ label: s.label, color: COLORS[i % COLORS.length], shape: chart.kind === "stack" ? ("square" as const) : ("line" as const) }))} />
              <div className="w-full" style={{ height: frame.expanded ? 420 : 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {chart.kind === "stack" ? (
                    <AreaChart data={points} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} stroke={CHART.grid} />
                      <XAxis dataKey="x" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis domain={[0, 1]} tickFormatter={(v: number) => fmt(v)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={44} />
                      <Tooltip formatter={(v) => fmt(Number(v))} />
                      {chart.series.map((s, i) => (
                        <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stackId="1" stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.6} isAnimationActive={false} />
                      ))}
                    </AreaChart>
                  ) : (
                    <LineChart data={points} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} stroke={CHART.grid} />
                      <XAxis dataKey="x" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis domain={chart.unit === "pct" ? [0, "auto"] : ["auto", "auto"]} tickFormatter={(v: number) => fmt(v)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={52} />
                      <Tooltip formatter={(v) => fmt(Number(v))} />
                      {chart.series.map((s, i) => (
                        <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                      ))}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )
        }
      </ChartCard>
      <TestStatusLine status={test.status} rule={test.rule} />
      {test.notes.length > 0 && (
        <details className="rounded-md border px-3 py-2 text-xs text-ink-300">
          <summary className="cursor-pointer text-ink-50">Method notes and caveats</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {test.notes.map((n) => (
              <li key={n}>{n.replace(/`/g, "")}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
