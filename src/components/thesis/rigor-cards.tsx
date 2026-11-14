"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, EmptyState, Legend } from "@/components/atlas/chart-card";
import type { ChartFrame } from "@/components/atlas/chart-frame";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { OneLineAxis } from "@/components/atlas/one-line-axis";
import { CHART } from "@/lib/colors";
import { fmtDate } from "@/lib/format";
import type { ThesisJson } from "@/lib/thesis-types";
import { countWord, fmtR, INTENTS_LABEL, pickQueries, PRICE_LABEL } from "./palette";
import { TestStatusLine } from "./test-status";

type Row = { label: string } & Record<string, number | string | null>;

function fmtP(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "n/a";
  return v < 0.001 ? "< 0.001" : v.toFixed(3);
}

/** Horizontal grouped bars per usage series, the shared chart of the three Part A cards. */
function HBars({ rows, bars, domain, refX, refLabel, fmt, frame }: { rows: Row[]; bars: Array<{ key: string; label: string; color: string }>; domain: [number, number]; refX?: number; refLabel?: string; fmt: (v: number) => string; frame: ChartFrame }) {
  return (
    <div className="space-y-3">
      <Legend items={[...bars.map((b) => ({ label: b.label, color: b.color, shape: "square" as const })), ...(refLabel ? [{ label: refLabel, color: CHART.axis, shape: "line" as const }] : [])]} />
      <OneLineAxis labels={rows.map((r) => r.label)} className="w-full" style={{ height: 48 + rows.length * (frame.expanded ? 72 : 48) }}>
        {(axis) => (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
              <CartesianGrid horizontal={false} stroke={CHART.grid} />
              <XAxis type="number" domain={domain} allowDataOverflow tickFormatter={fmt} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" width={axis.width} tick={axis.tick} tickLine={false} axisLine={false} />
              {refX !== undefined && <ReferenceLine x={refX} stroke={CHART.axis} strokeWidth={1.5} />}
              <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} formatter={(v) => fmt(Number(v))} />
              {bars.map((b) => (
                <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} isAnimationActive={false} maxBarSize={14} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </OneLineAxis>
    </div>
  );
}

const RIGOR_QUERIES = ["rigor", "weekly", "leadLag", "intentsLlama", "nearblocks", "dailyChain", "dailyReceipts"];

/** A1: block-bootstrap significance of the best positive lead, with Benjamini-Hochberg across every series and both predictors. */
export function SignificanceCard({ data }: { data: ThesisJson }) {
  const { usage, rigor } = data;
  const keys = usage.filter((u) => rigor.bootstrap[u.key]);
  const rows: Row[] = keys.map((u) => ({ label: u.label, intents: rigor.bootstrap[u.key]!.intents.r, price: rigor.bootstrap[u.key]!.price.r }));
  const sig = rigor.significantSeries.length;
  const priceSig = keys.filter((u) => rigor.bootstrap[u.key]!.price.significant).length;
  const best = keys.map((u) => ({ u, b: rigor.bootstrap[u.key]!.intents })).sort((a, b) => (a.b.p ?? 1) - (b.b.p ?? 1))[0];
  const takeaway = `After the block bootstrap and the false discovery rate correction, Intents volume's lead is significant on ${countWord(sig)} of ${countWord(keys.length)} usage series and price's on ${countWord(priceSig)}${best ? `, the closest being ${best.u.label.toLowerCase()} with p ${fmtP(best.b.p)} before and ${fmtP(best.b.pAdj)} after the correction` : ""}.`;
  const table: ChartTableSpec = {
    columns: [
      { key: "usage", label: "Usage series" },
      { key: "predictor", label: "Predictor" },
      { key: "lag", label: "Best lag (weeks)", align: "right" },
      { key: "r", label: "r", align: "right", format: (v) => fmtR(v as number | null) },
      { key: "ci", label: "90% interval" },
      { key: "p", label: "p", align: "right", format: (v) => fmtP(v as number | null) },
      { key: "pAdj", label: "Adjusted p", align: "right", format: (v) => fmtP(v as number | null) },
      { key: "significant", label: "Significant" },
      { key: "n", label: "Weeks", align: "right" },
    ],
    rows: keys.flatMap((u) =>
      (["intents", "price"] as const).map((p) => {
        const b = rigor.bootstrap[u.key]![p];
        return { usage: u.label, predictor: p === "intents" ? INTENTS_LABEL : PRICE_LABEL, lag: b.lag, r: b.r, ci: `${fmtR(b.ciLow)} to ${fmtR(b.ciHigh)}`, p: b.p, pAdj: b.pAdj, significant: b.significant ? "yes" : "no", n: b.n };
      }),
    ),
    caption: "Block bootstrap significance per usage series and predictor",
    filename: "thesis-significance.csv",
  };
  return (
    <div className="space-y-3" id="test-significance">
      <ChartCard
        takeawayPlacement="inline"
        scope="whole-chain"
        id="thesis-significance"
        title="Test A1 · Significance of the best lead"
        takeaway={takeaway}
        info={`A moving-block bootstrap (blocks of ${rigor.block} weeks, ${rigor.resamples.toLocaleString("en-US")} resamples, fixed seed ${rigor.seed}) gives each best positive-lag correlation a p-value. Each resample searches lags 1 to 8 again, so the p-value pays for picking the best lag. Benjamini-Hochberg then controls the false discovery rate at q = ${rigor.q} across every series and both predictors. Bars show r at the best lag; the old ±0.20 band is kept as a reference.`}
        table={table}
        queries={pickQueries(data.queries, RIGOR_QUERIES)}
      >
        {(frame: ChartFrame) => (rows.length ? <HBars rows={rows} frame={frame} bars={[{ key: "intents", label: INTENTS_LABEL, color: CHART.intents }, { key: "price", label: PRICE_LABEL, color: CHART.price }]} domain={[-0.2, 0.8]} refX={0.2} refLabel="old ±0.20 band" fmt={(v) => fmtR(v)} /> : <EmptyState message="No significance results in thesis.json. Run npm run rebuild." />)}
      </ChartCard>
      <TestStatusLine status={sig >= 3 ? "pass" : "fail"} rule={`Counts toward the verdict when Intents volume is significant after Benjamini-Hochberg on three or more usage series, one of them a chain-level count. It is significant on ${countWord(sig)}.`} />
    </div>
  );
}

/** A2: the nested out-of-sample comparison, price only against price plus Intents volume, with Clark-West. */
export function BeyondPriceCard({ data }: { data: ThesisJson }) {
  const { usage, rigor, cutoff } = data;
  const keys = usage.filter((u) => rigor.clarkWest[u.key]);
  const rows: Row[] = keys.map((u) => {
    const c = rigor.clarkWest[u.key]!;
    return { label: u.label, change: c.mse1 && c.mse2 !== null ? (c.mse2 - c.mse1) / c.mse1 : null };
  });
  const passed = keys.filter((u) => rigor.clarkWest[u.key]!.pass);
  const takeaway = `Adding lagged Intents volume to a price-only model lowers the error on the weeks from ${fmtDate(cutoff)} with Clark-West p under 0.10 for ${countWord(passed.length)} of ${countWord(keys.length)} usage series${passed.length ? ` (${passed.map((u) => u.label.toLowerCase()).join(", ")})` : ""}.`;
  const table: ChartTableSpec = {
    columns: [
      { key: "usage", label: "Usage series" },
      { key: "priceLag", label: "Price lag (weeks)", align: "right" },
      { key: "intentsLag", label: "Intents lag (weeks)", align: "right" },
      { key: "weeks", label: "Train and test weeks" },
      { key: "mse1", label: "MSE price only (×1000)", align: "right" },
      { key: "mse2", label: "MSE with Intents (×1000)", align: "right" },
      { key: "cw", label: "Clark-West", align: "right", format: (v) => fmtR(v as number | null) },
      { key: "p", label: "p", align: "right", format: (v) => fmtP(v as number | null) },
      { key: "pass", label: "Passes" },
    ],
    rows: keys.map((u) => {
      const c = rigor.clarkWest[u.key]!;
      return { usage: u.label, priceLag: c.priceLag, intentsLag: c.intentsLag, weeks: `${c.trainN} and ${c.testN}`, mse1: c.mse1, mse2: c.mse2, cw: c.cw, p: c.p, pass: c.pass ? "yes" : "no" };
    }),
    caption: "Nested out-of-sample comparison per usage series",
    filename: "thesis-clark-west.csv",
  };
  return (
    <div className="space-y-3" id="test-beyond-price">
      <ChartCard
        takeawayPlacement="inline"
        scope="whole-chain"
        id="thesis-beyond-price"
        title="Test A2 · Does Intents add information beyond price?"
        takeaway={takeaway}
        info={`Model 1 regresses each weekly usage change on the lagged price change. Model 2 adds the lagged Intents volume change. Both lags are chosen on weeks before ${fmtDate(cutoff)} and both models are scored on the weeks after. Bars show the change in test mean squared error when Intents is added, so a bar left of zero means Intents helps. The Clark-West statistic corrects for the noise a larger nested model adds; its p-value is one-sided.`}
        table={table}
        queries={pickQueries(data.queries, ["rigor", "oos", "weekly", "intentsLlama", "nearblocks", "dailyChain", "dailyReceipts"])}
      >
        {(frame: ChartFrame) => <HBars rows={rows} frame={frame} bars={[{ key: "change", label: "Change in test error with Intents added", color: CHART.intents }]} domain={[-0.5, 0.2]} refX={0} refLabel="no change" fmt={(v) => `${Math.round(v * 100)}%`} />}
      </ChartCard>
      <TestStatusLine status={rigor.a2Pass ? "pass" : "fail"} rule="Passes when Model 2 lowers test mean squared error with Clark-West p under 0.10 for at least two usage series." />
    </div>
  );
}

/** A3: Granger F-tests in both directions. */
export function GrangerCard({ data }: { data: ThesisJson }) {
  const { usage, rigor } = data;
  const keys = usage.filter((u) => rigor.granger[u.key]);
  const rows: Row[] = keys.map((u) => ({ label: u.label, forward: rigor.granger[u.key]!.forward.pMin, reverse: rigor.granger[u.key]!.reverse.pMin }));
  const fwd = keys.filter((u) => rigor.granger[u.key]!.forward.significant);
  const rev = keys.filter((u) => rigor.granger[u.key]!.reverse.significant);
  const usageLeads = keys.filter((u) => rigor.granger[u.key]!.usageLeads);
  const takeaway = usageLeads.length
    ? `Usage changes predict later Intents volume while Intents volume does not predict usage for ${usageLeads.map((u) => u.label.toLowerCase()).join(", ")}, so there usage may lead Intents rather than the reverse.`
    : `Intents volume Granger-predicts ${countWord(fwd.length)} of ${countWord(keys.length)} usage series${fwd.length ? ` (${fwd.map((u) => u.label.toLowerCase()).join(", ")})` : ""} and usage predicts Intents volume for ${countWord(rev.length)}, so no series shows usage leading Intents on its own.`;
  const table: ChartTableSpec = {
    columns: [
      { key: "usage", label: "Usage series" },
      { key: "fwdLags", label: "Intents to usage, p at lags 1 to 4" },
      { key: "fwd", label: "Summary p", align: "right", format: (v) => fmtP(v as number | null) },
      { key: "revLags", label: "Usage to Intents, p at lags 1 to 4" },
      { key: "rev", label: "Summary p", align: "right", format: (v) => fmtP(v as number | null) },
    ],
    rows: keys.map((u) => {
      const g = rigor.granger[u.key]!;
      return { usage: u.label, fwdLags: g.forward.pByLag.map((p) => fmtP(p)).join(" / "), fwd: g.forward.pMin, revLags: g.reverse.pByLag.map((p) => fmtP(p)).join(" / "), rev: g.reverse.pMin };
    }),
    caption: "Granger F-test p-values in both directions",
    filename: "thesis-granger.csv",
  };
  return (
    <div className="space-y-3" id="test-granger">
      <ChartCard
        takeawayPlacement="inline"
        scope="whole-chain"
        id="thesis-granger"
        title="Test A3 · Which way does it run?"
        takeaway={takeaway}
        info="A Granger F-test asks whether past values of one series improve a forecast of the other beyond its own past. It runs at lags of 1 to 4 weeks in both directions. The summary p is the smallest of the four multiplied by four (a Bonferroni correction), and counts as significant below 0.10. Bars show the summary p, so shorter is stronger."
        table={table}
        queries={pickQueries(data.queries, RIGOR_QUERIES)}
      >
        {(frame: ChartFrame) => <HBars rows={rows} frame={frame} bars={[{ key: "forward", label: "Intents predicts usage", color: CHART.intents }, { key: "reverse", label: "Usage predicts Intents", color: CHART.usage }]} domain={[0, 1]} refX={0.1} refLabel="p = 0.10" fmt={(v) => fmtP(v)} />}
      </ChartCard>
      <TestStatusLine status={usageLeads.length ? "fail" : "pass"} rule="Reported in both directions. Flagged when usage predicts Intents volume and Intents volume does not predict usage, which would mean usage may lead Intents." />
    </div>
  );
}

