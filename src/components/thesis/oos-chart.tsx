"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, EmptyState, Legend } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CHART } from "@/lib/colors";
import { fmtDate, fmtNum, fmtPct } from "@/lib/format";
import type { OosResult } from "@/lib/stats";
import type { ThesisJson, UsageMeta } from "@/lib/thesis-types";
import { countWord, fmtLag, fmtR, INTENTS_LABEL, pickQueries, PRICE_LABEL } from "./palette";

interface OosRow {
  key: string;
  label: string;
  source: string;
  intents: number | null;
  price: number | null;
  intentsRes: OosResult;
  priceRes: OosResult;
}

const FLOOR = -1;

/** Test 3: out-of-sample R² per usage series, Intents volume against NEAR price, both measured against the training-mean forecast. */
export function OosChart({ data }: { data: ThesisJson }) {
  const { usage, oos, verdict, cutoff } = data;
  const rows = useMemo<OosRow[]>(
    () =>
      usage.flatMap((u: UsageMeta) => {
        const pair = oos[u.key];
        if (!pair) return [];
        return [{ key: u.key, label: u.label, source: u.source, intents: pair.intents.r2Oos, price: pair.price.r2Oos, intentsRes: pair.intents, priceRes: pair.price }];
      }),
    [usage, oos],
  );

  const n = rows.length;
  const neither = Math.max(0, n - verdict.oosIntentsWins - verdict.oosPriceWins);
  const testWeeks = rows[0]?.intentsRes.testN ?? null;
  const takeaway =
    n === 0
      ? "No out-of-sample results yet."
      : `Fitted on weeks before ${fmtDate(cutoff)} and scored on the ${testWeeks ?? "later"} weeks from then on, Intents volume beats both price and the training-mean forecast on ${countWord(verdict.oosIntentsWins)} of ${countWord(n)} usage series, price does on ${countWord(verdict.oosPriceWins)}, and on the remaining ${countWord(neither)} neither predictor beats the training mean.`;

  const clipped = rows.flatMap((r) => [
    ...(r.intents !== null && r.intents < FLOOR ? [`${r.label}, Intents volume R² ${fmtR(r.intents)}`] : []),
    ...(r.price !== null && r.price < FLOOR ? [`${r.label}, price R² ${fmtR(r.price)}`] : []),
  ]);
  const domainMax = Math.max(0.1, Math.ceil(Math.max(...rows.map((r) => Math.max(r.intents ?? 0, r.price ?? 0))) * 10) / 10);
  const domainMin = Math.max(FLOOR, Math.floor(Math.min(...rows.map((r) => Math.min(r.intents ?? 0, r.price ?? 0))) * 10) / 10);

  const longRows = rows.flatMap((r) =>
    (
      [
        ["Intents volume", r.intentsRes],
        ["NEAR price", r.priceRes],
      ] as const
    ).map(([predictor, res]) => ({
      usage: r.label,
      predictor,
      lag: res.lag,
      testN: res.testN,
      r2Oos: res.r2Oos,
      hitRate: res.hitRate,
      mae: res.mae,
      naiveMae: res.naiveMae,
      trainN: res.train?.n ?? null,
      trainR2: res.train?.r2 ?? null,
    })),
  );

  const table: ChartTableSpec = {
    columns: [
      { key: "usage", label: "Usage series" },
      { key: "predictor", label: "Predictor" },
      { key: "lag", label: "Lag chosen", align: "right", format: (v) => fmtLag(v as number) },
      { key: "trainN", label: "Training weeks", align: "right" },
      { key: "trainR2", label: "In-sample R²", align: "right", format: (v) => fmtR(v as number | null) },
      { key: "testN", label: "Test weeks", align: "right" },
      { key: "r2Oos", label: "Out-of-sample R²", align: "right", format: (v) => fmtR(v as number | null) },
      { key: "hitRate", label: "Sign hit rate", align: "right", format: (v) => fmtPct(v as number | null) },
      { key: "mae", label: "MAE (log change)", align: "right", format: (v) => fmtNum(v as number | null, 3) },
      { key: "naiveMae", label: "Naive MAE", align: "right", format: (v) => fmtNum(v as number | null, 3) },
    ],
    rows: longRows,
    caption: "Out-of-sample forecast scores per usage series and predictor",
    filename: "thesis-out-of-sample.csv",
  };

  return (
    <ChartCard
      title="Test 3 · Out of sample"
      takeaway={takeaway}
      info={`For each usage series a one-variable regression of its weekly log change on the lagged log change of the predictor (Intents volume from DefiLlama, or NEAR price from NearBlocks) is fitted on weeks before ${fmtDate(cutoff)}; the lag is chosen on the training window only. It is then scored on weeks from ${fmtDate(cutoff)} onward. Out-of-sample R² is 1 − SSE(model) / SSE(training-mean forecast), where zero means no better than always predicting the training mean, negative means worse. The sign hit rate is the share of test weeks where the forecast had the right direction.`}
      table={table}
      queries={pickQueries(data.queries, ["oos", "weekly"])}
      footer={clipped.length ? <span>Bars are cut off at R² = {fmtR(FLOOR)} for {clipped.join("; ")}. Exact values are in the table and tooltip.</span> : undefined}
    >
      {n === 0 ? (
        <EmptyState message="No out-of-sample results in thesis.json. Run npm run rebuild." />
      ) : (
        <div className="space-y-3">
          <Legend
            items={[
              { label: INTENTS_LABEL, color: CHART.intents, shape: "square" },
              { label: PRICE_LABEL, color: CHART.price, shape: "square" },
              { label: "0 = training-mean forecast", color: CHART.axis, shape: "line" },
            ]}
          />
          <div className="w-full" style={{ height: 48 + rows.length * 48 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
                <CartesianGrid horizontal={false} stroke={CHART.grid} />
                <XAxis type="number" domain={[domainMin, domainMax]} allowDataOverflow tickFormatter={(v: number) => fmtR(v)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" width={104} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <ReferenceLine x={0} stroke={CHART.axis} strokeWidth={1.5} label={{ value: "training-mean forecast", position: "top", fontSize: 10, fill: CHART.muted }} />
                <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} content={<OosTip />} />
                <Bar dataKey="intents" name={INTENTS_LABEL} fill={CHART.intents} isAnimationActive={false} maxBarSize={14} />
                <Bar dataKey="price" name={PRICE_LABEL} fill={CHART.price} isAnimationActive={false} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <OosTable rows={rows} />
        </div>
      )}
    </ChartCard>
  );
}

function OosTip({ active, payload }: TipProps<OosRow>) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const line = (res: OosResult) => `R² ${fmtR(res.r2Oos)} · lag ${fmtLag(res.lag)} · hits ${fmtPct(res.hitRate)}`;
  return (
    <TooltipFrame title={`${r.label} (${r.source})`}>
      <TooltipRow label={INTENTS_LABEL} value={line(r.intentsRes)} color={CHART.intents} />
      <TooltipRow label={PRICE_LABEL} value={line(r.priceRes)} color={CHART.price} />
      <TooltipRow label="Test weeks" value={r.intentsRes.testN} />
    </TooltipFrame>
  );
}

function OosTable({ rows }: { rows: OosRow[] }) {
  return (
    <div className="max-h-[420px] overflow-auto rounded-md border">
      <Table className="text-xs">
        <caption className="sr-only">Out-of-sample scores per usage series and predictor</caption>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Usage series</TableHead>
            <TableHead className="whitespace-nowrap">Predictor</TableHead>
            <TableHead className="whitespace-nowrap text-right">Lag</TableHead>
            <TableHead className="whitespace-nowrap text-right">Test weeks</TableHead>
            <TableHead className="whitespace-nowrap text-right">R² oos</TableHead>
            <TableHead className="whitespace-nowrap text-right">Hit rate</TableHead>
            <TableHead className="whitespace-nowrap text-right">MAE vs naive</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.flatMap((r) =>
            (
              [
                [INTENTS_LABEL, r.intentsRes, CHART.intents],
                [PRICE_LABEL, r.priceRes, CHART.price],
              ] as const
            ).map(([label, res, color], i) => (
              <TableRow key={`${r.key}-${label}`}>
                <TableCell className="whitespace-nowrap font-medium">{i === 0 ? r.label : <span className="sr-only">{r.label}</span>}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                </TableCell>
                <TableCell className="tabular whitespace-nowrap text-right">{fmtLag(res.lag)}</TableCell>
                <TableCell className="tabular whitespace-nowrap text-right">{res.testN}</TableCell>
                <TableCell className="tabular whitespace-nowrap text-right">{fmtR(res.r2Oos)}</TableCell>
                <TableCell className="tabular whitespace-nowrap text-right">{fmtPct(res.hitRate)}</TableCell>
                <TableCell className="tabular whitespace-nowrap text-right">
                  {fmtNum(res.mae, 3)} vs {fmtNum(res.naiveMae, 3)}
                </TableCell>
              </TableRow>
            )),
          )}
        </TableBody>
      </Table>
    </div>
  );
}
