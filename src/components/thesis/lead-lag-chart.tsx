"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, EmptyState, Legend } from "@/components/atlas/chart-card";
import { useChartFrame } from "@/components/atlas/chart-frame";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CHART } from "@/lib/colors";
import type { LeadLagSummary } from "@/lib/stats";
import type { ThesisJson, UsageMeta } from "@/lib/thesis-types";
import { countWord, fmtLag, fmtR, INTENTS_LABEL, pickQueries, PRICE_LABEL } from "./palette";

interface Panel {
  meta: UsageMeta;
  intents: LeadLagSummary;
  price: LeadLagSummary;
  band: number | null;
  rows: LagRow[];
}
type LagRow = { lag: number; intents: number | null; price: number | null; n: number };

function buildRows(intents: LeadLagSummary, price: LeadLagSummary, maxLag: number): LagRow[] {
  const byLagP = new Map(price.points.map((p) => [p.lag, p]));
  const byLagI = new Map(intents.points.map((p) => [p.lag, p]));
  const out: LagRow[] = [];
  for (let k = -maxLag; k <= maxLag; k++) {
    const i = byLagI.get(k);
    const p = byLagP.get(k);
    out.push({ lag: k, intents: i?.r ?? null, price: p?.r ?? null, n: i?.n ?? p?.n ?? 0 });
  }
  return out;
}

const BAND_FILL = "color-mix(in oklab, var(--ink-muted) 22%, transparent)";

/** Test 2: cross-correlation of weekly log changes by lag, one small multiple per usage series. */
export function LeadLagChart({ data }: { data: ThesisJson }) {
  const { usage, leadLag, verdict, maxLag } = data;
  const panels = useMemo<Panel[]>(
    () =>
      usage.flatMap((u) => {
        const pair = leadLag[u.key];
        if (!pair) return [];
        return [{ meta: u, intents: pair.intents, price: pair.price, band: pair.intents.noiseBand ?? pair.price.noiseBand, rows: buildRows(pair.intents, pair.price, maxLag) }];
      }),
    [usage, leadLag, maxLag],
  );

  const yMax = useMemo(() => {
    let m = 0.3;
    for (const p of panels) for (const r of p.rows) m = Math.max(m, Math.abs(r.intents ?? 0), Math.abs(r.price ?? 0));
    return Math.ceil(m * 10) / 10;
  }, [panels]);

  const n = panels.length;
  const takeaway =
    n === 0
      ? "No lead-lag results yet."
      : `Intents volume is the stronger positive lead for ${countWord(verdict.baseIntentsWins)} of ${countWord(n)} usage series, price for ${countWord(verdict.basePriceWins)}, and ${countWord(verdict.baseTies)} ${verdict.baseTies === 1 ? "is" : "are"} inconclusive because neither predictor clears the noise band at a positive lag.`;

  const table: ChartTableSpec = {
    columns: [
      { key: "usage", label: "Usage series" },
      { key: "source", label: "Source" },
      { key: "lag", label: "Lag (weeks)", align: "right", format: (v) => fmtLag(v as number) },
      { key: "intents", label: "r, Intents volume → usage", align: "right", format: (v) => fmtR(v as number | null) },
      { key: "price", label: "r, NEAR price → usage", align: "right", format: (v) => fmtR(v as number | null) },
      { key: "band", label: "Noise band (±)", align: "right", format: (v) => fmtR(v as number | null) },
      { key: "n", label: "Pairs", align: "right" },
    ],
    rows: panels.flatMap((p) => p.rows.map((r) => ({ usage: p.meta.label, source: p.meta.source, lag: r.lag, intents: r.intents, price: r.price, band: p.band, n: r.n }))),
    caption: "Cross-correlation by lag for every usage series",
    filename: "thesis-lead-lag.csv",
    maxRows: 200,
  };

  return (
    <ChartCard
      scope="whole-chain"
      id="thesis-lead-lag"
      title="Test 2 · Lead and lag"
      takeaway={takeaway}
      info={`Pearson correlation between week-over-week log changes of the predictor (Intents volume from DefiLlama, or NEAR price from NearBlocks) and of each usage series (NearBlocks counts; BigQuery function calls and contracts called), at lags of −${maxLag} to +${maxLag} weeks. A positive lag means the predictor moves first, so its change this week is compared with the usage change that many weeks later. The shaded band is about 2/√n; correlations inside it cannot be told from noise at this sample size. Dots mark each predictor's strongest positive correlation at a positive lag.`}
      table={table}
      queries={pickQueries(data.queries, ["weekly", "leadLag", "intentsLlama", "nearblocks", "dailyChain", "dailyReceipts"])}
    >
      {n === 0 ? (
        <EmptyState message="No lead-lag results in thesis.json. Run npm run rebuild." />
      ) : (
        <div className="space-y-3">
          <Legend
            items={[
              { label: INTENTS_LABEL, color: CHART.intents, shape: "square" },
              { label: PRICE_LABEL, color: CHART.price, shape: "square" },
              { label: "noise band (±2/√n)", color: BAND_FILL, shape: "square" },
              { label: "best positive lead", color: CHART.foreground, shape: "circle" },
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {panels.map((p) => (
              <LagPanel key={p.meta.key} panel={p} yMax={yMax} />
            ))}
          </div>
          <SummaryTable panels={panels} />
        </div>
      )}
    </ChartCard>
  );
}

function LagPanel({ panel, yMax }: { panel: Panel; yMax: number }) {
  const frame = useChartFrame(160, 300);
  const { meta, intents, price, band, rows } = panel;
  const bestI = intents.bestPositiveLead;
  const bestP = price.bestPositiveLead;
  return (
    <figure className="rounded-md border p-2" aria-label={`${meta.label}, correlation by lag`}>
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
        <span className="font-medium">{meta.label}</span>
        <span className="text-muted-foreground">
          {meta.source} · {intents.n} weeks
        </span>
      </figcaption>
      <p className="mb-1 text-[11px] text-muted-foreground">
        Intents {bestI ? `${fmtLag(bestI.lag)}, r ${fmtR(bestI.r)}` : "no positive lead"} · price {bestP ? `${fmtLag(bestP.lag)}, r ${fmtR(bestP.r)}` : "no positive lead"} · same week {fmtR(intents.r0)} / {fmtR(price.r0)}
      </p>
      <div style={{ height: frame.height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={1} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="lag" tickLine={false} axisLine={false} interval={1} tick={{ fontSize: 10 }} tickFormatter={(v: number) => (v > 0 ? `+${v}` : String(v))} />
            <YAxis domain={[-yMax, yMax]} tickFormatter={(v: number) => fmtR(v)} tick={{ fontSize: 10 }} width={40} tickLine={false} axisLine={false} />
            {band !== null && <ReferenceArea y1={-band} y2={band} fill={BAND_FILL} fillOpacity={1} stroke="none" ifOverflow="extendDomain" />}
            <ReferenceLine y={0} stroke={CHART.axis} />
            <ReferenceLine x={0} stroke={CHART.axis} strokeDasharray="3 3" />
            <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} content={<LagTip band={band} />} />
            <Bar dataKey="intents" name={INTENTS_LABEL} fill={CHART.intents} isAnimationActive={false} maxBarSize={8} />
            <Bar dataKey="price" name={PRICE_LABEL} fill={CHART.price} isAnimationActive={false} maxBarSize={8} />
            {bestI && bestI.r !== null && <ReferenceDot x={bestI.lag} y={bestI.r} r={4} fill={CHART.intents} stroke={CHART.background} strokeWidth={2} ifOverflow="visible" />}
            {bestP && bestP.r !== null && <ReferenceDot x={bestP.lag} y={bestP.r} r={4} fill={CHART.price} stroke={CHART.background} strokeWidth={2} ifOverflow="visible" />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function LagTip({ active, payload, band }: TipProps<LagRow> & { band: number | null }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const inside = (r: number | null) => (r !== null && band !== null && Math.abs(r) < band ? " (inside band)" : "");
  return (
    <TooltipFrame title={row.lag === 0 ? "Same week" : row.lag > 0 ? `Predictor leads by ${row.lag} w` : `Usage leads by ${-row.lag} w`}>
      <TooltipRow label={INTENTS_LABEL} value={`${fmtR(row.intents)}${inside(row.intents)}`} color={CHART.intents} />
      <TooltipRow label={PRICE_LABEL} value={`${fmtR(row.price)}${inside(row.price)}`} color={CHART.price} />
      <TooltipRow label="Pairs" value={row.n} />
    </TooltipFrame>
  );
}

function SummaryTable({ panels }: { panels: Panel[] }) {
  const cell = (s: LeadLagSummary) => {
    const b = s.bestPositiveLead;
    if (!b) return <span className="text-muted-foreground">none</span>;
    return (
      <span className="tabular">
        {fmtLag(b.lag)} · r {fmtR(b.r)}
      </span>
    );
  };
  return (
    <div className="max-h-[420px] overflow-auto rounded-md border">
      <Table className="text-xs">
        <caption className="sr-only">Strongest positive correlation at a positive lag, per usage series and predictor</caption>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Usage series</TableHead>
            <TableHead className="whitespace-nowrap">Source</TableHead>
            <TableHead className="whitespace-nowrap">Intents volume leads by</TableHead>
            <TableHead className="whitespace-nowrap">Price leads by</TableHead>
            <TableHead className="whitespace-nowrap text-right">Same-week r (Intents / price)</TableHead>
            <TableHead className="whitespace-nowrap text-right">Noise band</TableHead>
            <TableHead className="whitespace-nowrap text-right">Weeks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {panels.map((p) => (
            <TableRow key={p.meta.key}>
              <TableCell className="whitespace-nowrap font-medium">{p.meta.label}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{p.meta.source}</TableCell>
              <TableCell className="whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ backgroundColor: CHART.intents }} />
                  {cell(p.intents)}
                </span>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ backgroundColor: CHART.price }} />
                  {cell(p.price)}
                </span>
              </TableCell>
              <TableCell className="tabular whitespace-nowrap text-right">
                {fmtR(p.intents.r0)} / {fmtR(p.price.r0)}
              </TableCell>
              <TableCell className="tabular whitespace-nowrap text-right">±{fmtR(p.band)}</TableCell>
              <TableCell className="tabular whitespace-nowrap text-right">{p.intents.n}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
