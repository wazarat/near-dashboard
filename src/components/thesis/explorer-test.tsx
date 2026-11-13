"use client";

import { ChartCard, EmptyState } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CHART } from "@/lib/colors";
import { fmtDate, fmtPct, fmtUsd } from "@/lib/format";
import type { LeadLagSummary, OosResult } from "@/lib/stats";
import type { ThesisJson } from "@/lib/thesis-types";
import { fmtLag, fmtR, pickQueries } from "./palette";

const EXPLORER_COLOR = "var(--cat-7)";

interface TestRow {
  usage: string;
  predictor: string;
  color: string;
  lag: number | null;
  r: number | null;
  r0: number | null;
  n: number;
  oosLag: number;
  train: number;
  test: number;
  r2: number | null;
  hit: number | null;
}

/** The lead-lag and out-of-sample tests with 1Click Explorer volume as the predictor, beside DefiLlama volume and price over the same weeks. */
export function ExplorerTest({ data }: { data: ThesisJson }) {
  const { usage, explorerTest: t, coverage, leadLag, oos } = data;

  const row = (label: string, predictor: string, color: string, ll: LeadLagSummary, o: OosResult): TestRow => ({
    usage: label,
    predictor,
    color,
    lag: ll.bestPositiveLead?.lag ?? null,
    r: ll.bestPositiveLead?.r ?? null,
    r0: ll.r0,
    n: ll.n,
    oosLag: o.lag,
    train: o.train?.n ?? 0,
    test: o.testN,
    r2: o.r2Oos,
    hit: o.hitRate,
  });
  const rows: TestRow[] = usage.flatMap((u) => {
    const r = t.results[u.key];
    if (!r) return [];
    const full = leadLag[u.key] && oos[u.key] ? [row(u.label, "DefiLlama, full window", CHART.muted, leadLag[u.key]!.intents, oos[u.key]!.intents)] : [];
    return [
      row(u.label, "Explorer 1Click", EXPLORER_COLOR, r.explorer.leadLag, r.explorer.oos),
      row(u.label, "DefiLlama, same weeks", CHART.intents, r.llama.leadLag, r.llama.oos),
      row(u.label, "NEAR price, same weeks", CHART.price, r.price.leadLag, r.price.oos),
      ...full,
    ];
  });

  const share =
    coverage.explorerFirstDay && coverage.explorerLastDay
      ? `The Explorer covers 1Click swaps only, ${fmtPct(coverage.ratioSum)} of DefiLlama's all-channel volume (${fmtUsd(coverage.explorerVolumeUsd)} of ${fmtUsd(coverage.llamaVolumeUsd)}) over ${coverage.ratioDays} days from ${fmtDate(coverage.explorerFirstDay)} to ${fmtDate(coverage.explorerLastDay)}.`
      : "The Explorer covers 1Click swaps only and no complete day has been fetched yet.";

  const table: ChartTableSpec = {
    columns: [
      { key: "usage", label: "Usage series" },
      { key: "predictor", label: "Predictor" },
      { key: "lag", label: "Leads by (weeks)", align: "right", format: (v) => fmtLag(v as number | null) },
      { key: "r", label: "r at that lead", align: "right", format: (v) => fmtR(v as number | null) },
      { key: "r0", label: "Same-week r", align: "right", format: (v) => fmtR(v as number | null) },
      { key: "n", label: "Weeks", align: "right" },
      { key: "oosLag", label: "Out-of-sample lag", align: "right", format: (v) => fmtLag(v as number | null) },
      { key: "train", label: "Train weeks", align: "right" },
      { key: "test", label: "Test weeks", align: "right" },
      { key: "r2", label: "Out-of-sample R²", align: "right", format: (v) => fmtR(v as number | null) },
      { key: "hit", label: "Sign hit rate", align: "right", format: (v) => fmtPct(v as number | null) },
    ],
    rows: rows.map((r) => ({ ...r })),
    caption: "Lead-lag and out-of-sample results per predictor over the weeks the Explorer covers",
    filename: "thesis-explorer-test.csv",
  };

  return (
    <ChartCard takeawayPlacement="inline"
      scope="whole-chain"
      id="thesis-explorer-test"
      title="Explorer-only test"
      takeaway={`${t.conclusion} ${share}`}
      info="The lead-lag test and the out-of-sample test from above, run again with the NEAR Intents Explorer API's 1Click volume as the predictor, over the weeks its backfill covers. The DefiLlama and price rows marked same weeks are cut to exactly those weeks so the three predictors are compared on equal terms, and the full window row repeats the headline result. A predictor wins a series when its strongest positive correlation at a positive lag is outside the noise band and at least 0.02 above the other one."
      table={table}
      queries={pickQueries(data.queries, ["intentsExplorer", "intentsLlama", "weekly", "leadLag", "oos"])}
      footer={
        <span>
          Weeks are weekly changes. The noise band is about 2/√n, so it is wider here than over the full window. Backfill {coverage.explorerBackfillDone ? "complete" : "not complete"}.
        </span>
      }
    >
      {!t.available || rows.length === 0 ? (
        <EmptyState message={t.conclusion} />
      ) : (
        <div className="space-y-3">
          <dl className="grid gap-3 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-ink-300">Explorer 1Click against price</dt>
              <dd className="tabular text-sm font-medium">
                {t.explorer.leadWins} leads, {t.explorer.priceLeadWins} for price, {t.explorer.ties} inconclusive
              </dd>
              <dd className="text-ink-300">
                out of sample {t.explorer.oosWins} to {t.explorer.priceOosWins}
              </dd>
            </div>
            <div>
              <dt className="text-ink-300">DefiLlama, same weeks, against price</dt>
              <dd className="tabular text-sm font-medium">
                {t.llama.leadWins} leads, {t.llama.priceLeadWins} for price, {t.llama.ties} inconclusive
              </dd>
              <dd className="text-ink-300">
                out of sample {t.llama.oosWins} to {t.llama.priceOosWins}
              </dd>
            </div>
            <div>
              <dt className="text-ink-300">Weeks covered</dt>
              <dd className="tabular text-sm font-medium">{t.weeks} weekly changes</dd>
              <dd className="text-ink-300">
                {t.start ? fmtDate(t.start) : "n/a"} to {t.end ? fmtDate(t.end) : "n/a"}
              </dd>
            </div>
          </dl>
          <div className="max-h-[520px] overflow-auto rounded-md border">
            <Table className="text-xs">
              <caption className="sr-only">Explorer-only test, lead-lag and out-of-sample results per predictor</caption>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Usage series</TableHead>
                  <TableHead className="whitespace-nowrap">Predictor</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Best positive lead</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Same-week r</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Weeks</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Out-of-sample R²</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Sign hit rate</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Train / test weeks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.usage}-${r.predictor}`} className={r.predictor === "Explorer 1Click" ? "bg-muted/30" : undefined}>
                    <TableCell className="whitespace-nowrap font-medium">{r.usage}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ backgroundColor: r.color }} />
                        {r.predictor}
                      </span>
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap text-right">{r.r === null ? "no positive lead" : `${fmtR(r.r)} @${fmtLag(r.lag)}`}</TableCell>
                    <TableCell className="tabular whitespace-nowrap text-right">{fmtR(r.r0)}</TableCell>
                    <TableCell className="tabular whitespace-nowrap text-right">{r.n}</TableCell>
                    <TableCell className="tabular whitespace-nowrap text-right">
                      {fmtR(r.r2)} @{fmtLag(r.oosLag)}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap text-right">{fmtPct(r.hit)}</TableCell>
                    <TableCell className="tabular whitespace-nowrap text-right">
                      {r.train} / {r.test}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
