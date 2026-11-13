"use client";

import { NOT_TRACKED } from "@/lib/coverage";
import { useMemo } from "react";
import { ChartCard, EmptyState, Legend } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { MiniSeries } from "@/components/charts/mini-series";
import { CHART } from "@/lib/colors";
import { fmtDate, fmtDateShort, fmtPct, fmtUsd } from "@/lib/format";
import type { ThesisJson } from "@/lib/thesis-types";
import { pickQueries } from "./palette";

const EXPLORER_COLOR = "var(--cat-7)";
const SHOW_DAYS = 90;

/** Daily Intents volume: DefiLlama (all channels) as a line, the 1Click Explorer backfill as bars, with coverage facts. */
export function CoverageStrip({ data }: { data: ThesisJson }) {
  const { daily, coverage } = data;
  const total = daily.dates.length;
  const start = Math.max(0, total - SHOW_DAYS);
  const dates = useMemo(() => daily.dates.slice(start), [daily.dates, start]);
  const llama = useMemo(() => daily.intentsLlama.slice(start), [daily.intentsLlama, start]);
  const explorer = useMemo(() => daily.intentsExplorer.slice(start), [daily.intentsExplorer, start]);

  const takeaway =
    total === 0
      ? "No daily Intents series yet."
      : coverage.explorerDays === 0 || !coverage.explorerFirstDay
        ? "The 1Click Explorer backfill has not produced a complete day yet, so every Intents chart on this page uses DefiLlama's series."
        : `The Explorer covers 1Click swaps only, ${coverage.explorerDays} complete day${coverage.explorerDays === 1 ? "" : "s"} from ${fmtDate(coverage.explorerFirstDay)} to ${coverage.explorerLastDay ? fmtDate(coverage.explorerLastDay) : "today"}. Over those days it reports ${fmtPct(coverage.ratioSum)} of DefiLlama's all-channel volume in total and a median ${fmtPct(coverage.ratioMedian)} per day. The backfill is ${coverage.explorerBackfillDone ? "complete" : "not complete"}, so the headline tests use DefiLlama's series and the Explorer-only test above uses this one.`;

  const table: ChartTableSpec = {
    columns: [
      { key: "date", label: "Date" },
      { key: "llama", label: "DefiLlama volume (all channels)", align: "right", format: (v) => fmtUsd(v as number | null) },
      { key: "explorer", label: "Explorer volume (1Click swaps only)", align: "right", format: (v) => fmtUsd(v as number | null) },
      { key: "ratio", label: "Explorer / DefiLlama", align: "right", format: (v) => fmtPct(v as number | null) },
      { key: "price", label: "NEAR price (USD)", align: "right", format: (v) => (v === null || v === undefined ? NOT_TRACKED : `$${(v as number).toFixed(2)}`) },
    ],
    rows: daily.dates
      .map((d, i) => {
        const l = daily.intentsLlama[i] ?? null;
        const e = daily.intentsExplorer[i] ?? null;
        return { date: d, llama: l, explorer: e, ratio: l && e !== null ? e / l : null, price: daily.price[i] ?? null };
      })
      .reverse(),
    caption: "Daily Intents volume from both sources",
    filename: "thesis-intents-coverage.csv",
    maxRows: 120,
  };

  return (
    <ChartCard takeawayPlacement="inline"
      scope="whole-chain"
      id="thesis-coverage"
      title="Explorer coverage · 1Click swaps only"
      takeaway={takeaway}
      info="Daily NEAR Intents volume from DefiLlama's adapter (all channels) drawn as a line, with the NEAR Intents Explorer API backfill (1Click swaps only, status SUCCESS, summed amountInUsd) as bars where a complete day exists. The ratio between them says how much of total Intents volume the 1Click channel is; it is the check that decides whether the Explorer series can replace DefiLlama's."
      table={table}
      queries={pickQueries(data.queries, ["intentsLlama", "intentsExplorer"])}
      footer={
        total ? (
          <span>
            Chart shows the last {dates.length} days to {fmtDateShort(dates[dates.length - 1])}; the table holds all {total} days from {fmtDateShort(daily.dates[0])}. The latest ratio where both exist is {fmtPct(coverage.ratioLatest)}.
          </span>
        ) : undefined
      }
    >
      {total === 0 ? (
        <EmptyState message="No daily Intents volume in thesis.json. Run npm run rebuild." />
      ) : (
        <div>
          <Legend
            items={[
              { label: "DefiLlama, all channels", color: CHART.intents, shape: "line" },
              { label: "Explorer, 1Click swaps only", color: EXPLORER_COLOR, shape: "square" },
            ]}
            className="mb-2"
          />
          <MiniSeries dates={dates} values={explorer} kind="bar" primaryLabel="Explorer (1Click swaps only)" height={180} color={EXPLORER_COLOR} format={(v) => fmtUsd(v)} secondary={{ values: llama, label: "DefiLlama (all channels)", color: CHART.intents }} />
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-ink-300">Explorer days</dt>
              <dd className="tabular text-sm font-medium">{coverage.explorerDays}</dd>
            </div>
            <div>
              <dt className="text-ink-300">First complete day</dt>
              <dd className="text-sm font-medium">
                {coverage.explorerFirstDay ? fmtDate(coverage.explorerFirstDay) : "none yet"}
                {coverage.explorerLastDay ? `, last ${fmtDate(coverage.explorerLastDay)}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-ink-300">Explorer share of DefiLlama volume</dt>
              <dd className="tabular text-sm font-medium">
                {fmtPct(coverage.ratioSum)} in total, median {fmtPct(coverage.ratioMedian)} per day
              </dd>
            </div>
            <div>
              <dt className="text-ink-300">Backfill</dt>
              <dd className="text-sm font-medium">{coverage.explorerBackfillDone ? "complete" : "not complete"}</dd>
            </div>
          </dl>
        </div>
      )}
    </ChartCard>
  );
}
