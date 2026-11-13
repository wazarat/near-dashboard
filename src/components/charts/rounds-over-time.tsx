"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, EmptyState, HatchDefs, Legend } from "@/components/atlas/chart-card";
import { frameHeight, useSvgId, type ChartFrame } from "@/components/atlas/chart-frame";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { Segmented } from "@/components/ui/segmented";
import { CAT } from "@/lib/colors";
import { fmtInt, fmtUsd, fmtUsdFull } from "@/lib/format";
import { ROUND_BUCKETS } from "@/lib/parse";
import type { Round } from "@/lib/types";

type Mode = "count" | "usd";

interface Row {
  quarter: string;
  /** Rounds in the quarter, disclosed or not. */
  rounds: number;
  /** Disclosed USD in the quarter. */
  usd: number;
  [bucket: string]: number | string;
}

export function quarterOf(iso: string): string {
  const y = iso.slice(0, 4);
  const m = Number(iso.slice(5, 7));
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}

function nextQuarter(q: string): string {
  const y = Number(q.slice(0, 4));
  const n = Number(q.slice(6));
  return n === 4 ? `${y + 1}-Q1` : `${y}-Q${n + 1}`;
}

function emptyRow(quarter: string): Row {
  return { quarter, rounds: 0, usd: 0, ...Object.fromEntries(ROUND_BUCKETS.map((b) => [b, 0])) };
}

/** One row per quarter from the first dated round to the last, with gaps kept so the x axis stays regular. */
export function roundsByQuarter(rounds: Round[], mode: Mode): Row[] {
  const dated = rounds.filter((r): r is Round & { date: string } => r.date !== null);
  if (dated.length === 0) return [];
  const m = new Map<string, Row>();
  for (const r of dated) {
    const q = quarterOf(r.date);
    const row = m.get(q) ?? emptyRow(q);
    row.rounds += 1;
    row.usd += r.amount ?? 0;
    row[r.roundBucket] = (row[r.roundBucket] as number) + (mode === "count" ? 1 : (r.amount ?? 0));
    m.set(q, row);
  }
  const quarters = Array.from(m.keys()).sort();
  const out: Row[] = [];
  for (let q = quarters[0]; q <= quarters[quarters.length - 1]; q = nextQuarter(q)) out.push(m.get(q) ?? emptyRow(q));
  return out;
}

const fill = (bucket: string, i: number, hatchId: string) => (bucket === "Other" ? `url(#${hatchId})` : CAT[i % CAT.length]);

export function RoundsOverTime({ rounds, className }: { rounds: Round[]; className?: string }) {
  const [mode, setMode] = useState<Mode>("count");
  const hatchBase = useSvgId("hatch-other");
  const rows = useMemo(() => roundsByQuarter(rounds, mode), [rounds, mode]);
  const undated = rounds.filter((r) => r.date === null).length;
  const undisclosed = rounds.filter((r) => r.amount === null).length;
  const disclosedTotal = rounds.reduce((a, r) => a + (r.amount ?? 0), 0);
  const usedBuckets = ROUND_BUCKETS.filter((b) => rows.some((r) => (r[b] as number) > 0));
  const withData = rows.filter((r) => r.rounds > 0);

  const takeaway = (() => {
    if (withData.length === 0) return "No dated rounds to chart.";
    const first = withData[0].quarter;
    if (mode === "count") {
      const busiest = withData.reduce((best, r) => (r.rounds > best.rounds ? r : best));
      return `${rounds.length - undated} dated rounds since ${first}; ${busiest.quarter} was the busiest quarter with ${busiest.rounds}.`;
    }
    const biggest = withData.reduce((best, r) => (r.usd > best.usd ? r : best));
    return `${fmtUsd(disclosedTotal)} disclosed across ${rounds.length - undisclosed} of ${rounds.length} rounds; ${biggest.quarter} was the largest quarter at ${fmtUsd(biggest.usd)}.`;
  })();

  const fmt = (v: number) => (mode === "count" ? fmtInt(v) : fmtUsd(v));

  return (
    <ChartCard
      className={className}
      id="funding-rounds"
      title="Funding rounds over time"
      takeaway={takeaway}
      info="Rounds from the rounds file by the quarter of their date, stacked by round type bucket (seed and pre-seed; Series A and later; strategic and private; token sales; grants; public-market deals such as PIPEs; acquisitions; other). Switch between the number of rounds and disclosed USD. Hatched segments are rounds whose type fits no bucket."
      actions={
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "count", label: "Rounds" },
            { value: "usd", label: "Disclosed USD" },
          ]}
          ariaLabel="Measure"
        />
      }
      footer={`${undisclosed} of ${rounds.length} rounds have no disclosed amount and ${undated} ${undated === 1 ? "is" : "are"} undated. Undated rounds are left out of the bars; undisclosed rounds count as rounds but add nothing to USD.`}
      table={{
        columns: [
          { key: "quarter", label: "Quarter" },
          ...usedBuckets.map((b) => ({ key: b, label: b, align: "right" as const, format: (v: unknown) => fmt((v as number) ?? 0) })),
          { key: "rounds", label: "Rounds", align: "right" },
          { key: "usd", label: "Disclosed USD", align: "right", format: (v) => fmtUsdFull((v as number) ?? 0) },
        ],
        rows: rows as unknown as Record<string, unknown>[],
        filename: "rounds-by-quarter.csv",
        caption: "Funding rounds per quarter by round type",
      }}
    >
      {(frame: ChartFrame) => {
        const height = frameHeight(frame, 260);
        const hatchId = frame.expanded ? `${hatchBase}-expanded` : hatchBase;
        return rows.length === 0 ? (
        <EmptyState message="No dated rounds." />
      ) : (
        <div>
          <Legend className="mb-2" items={usedBuckets.map((b) => ({ label: b, color: CAT[ROUND_BUCKETS.indexOf(b) % CAT.length], shape: b === "Other" ? "hatch" : "square" }))} />
          <div style={{ height }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={rows.length > 16 ? 2 : 6}>
                <HatchDefs id={hatchId} />
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="quarter" tickLine={false} axisLine={false} fontSize={10} interval="preserveStartEnd" minTickGap={18} />
                <YAxis tickFormatter={(v) => (mode === "count" ? fmtInt(v) : fmtUsd(v, { digits: 0 }))} allowDecimals={false} width={mode === "count" ? 32 : 52} tickLine={false} axisLine={false} fontSize={10} />
                <Tooltip content={<QuarterTip mode={mode} />} cursor={{ fill: "var(--accent)", opacity: 0.4 }} />
                {ROUND_BUCKETS.map((b, i) => (
                  <Bar key={b} dataKey={b} name={b} stackId="a" fill={fill(b, i, hatchId)} stroke="var(--background)" strokeWidth={1} isAnimationActive={false} maxBarSize={40} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
      }}
    </ChartCard>
  );
}

function QuarterTip({ active, payload, mode }: TipProps<Row> & { mode: Mode }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <TooltipFrame title={r.quarter}>
      {ROUND_BUCKETS.map((b, i) => ((r[b] as number) > 0 ? <TooltipRow key={b} label={b} color={b === "Other" ? "var(--chart-muted)" : CAT[i % CAT.length]} value={mode === "count" ? fmtInt(r[b] as number) : fmtUsd(r[b] as number)} /> : null))}
      <TooltipRow label="Rounds (incl. undisclosed)" value={fmtInt(r.rounds)} />
      <TooltipRow label="Disclosed USD" value={r.usd > 0 ? fmtUsd(r.usd) : "none"} />
    </TooltipFrame>
  );
}
