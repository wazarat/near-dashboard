"use client";

import { ChartCard, EmptyState } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CHART } from "@/lib/colors";
import type { RobustnessVariant, ThesisJson } from "@/lib/thesis-types";
import { countWord, fmtLag, fmtR, pickQueries } from "./palette";

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** Test 4: the same lead-lag comparison under each robustness variant, base variant first. */
export function RobustnessTable({ data }: { data: ThesisJson }) {
  const { usage, robustness, verdict } = data;
  const variants: RobustnessVariant[] = [...robustness].sort((a, b) => (a.id === "base" ? -1 : b.id === "base" ? 1 : 0));
  const unit = (v: RobustnessVariant) => (v.id === "daily" ? "d" : "w");

  const priceAhead = variants.filter((v) => v.priceWins > v.intentsWins).map((v) => v.label.toLowerCase());
  const takeaway =
    variants.length === 0
      ? "No robustness variants yet."
      : `Across ${countWord(variants.length)} variants Intents volume wins ${verdict.robustnessIntentsWins} series comparisons to price's ${verdict.robustnessPriceWins}${
          priceAhead.length ? `; ${joinList(priceAhead)} ${priceAhead.length === 1 ? "is" : "are"} the only variant${priceAhead.length === 1 ? "" : "s"} where price comes out ahead` : "; price never comes out ahead in a variant"
        }.`;

  const table: ChartTableSpec = {
    columns: [
      { key: "variant", label: "Variant" },
      { key: "usage", label: "Usage series" },
      { key: "intentsR", label: "Intents r", align: "right", format: (v) => fmtR(v as number | null) },
      { key: "intentsLag", label: "Intents lag", align: "right", format: (v) => (v === null ? "n/a" : String(v)) },
      { key: "priceR", label: "Price r", align: "right", format: (v) => fmtR(v as number | null) },
      { key: "priceLag", label: "Price lag", align: "right", format: (v) => (v === null ? "n/a" : String(v)) },
      { key: "n", label: "Pairs", align: "right" },
      { key: "intentsWins", label: "Intents wins", align: "right" },
      { key: "priceWins", label: "Price wins", align: "right" },
    ],
    rows: variants.flatMap((v) =>
      usage.flatMap((u) => {
        const cell = v.results[u.key];
        if (!cell) return [];
        return [
          {
            variant: v.label,
            usage: u.label,
            intentsR: cell.intents?.r ?? null,
            intentsLag: cell.intents ? `${fmtLag(cell.intents.lag, unit(v))}` : null,
            priceR: cell.price?.r ?? null,
            priceLag: cell.price ? `${fmtLag(cell.price.lag, unit(v))}` : null,
            n: cell.n,
            intentsWins: v.intentsWins,
            priceWins: v.priceWins,
          },
        ];
      }),
    ),
    caption: "Strongest positive-lag correlation per predictor under each robustness variant",
    filename: "thesis-robustness.csv",
  };

  return (
    <ChartCard
      scope="whole-chain"
      id="thesis-robustness"
      title="Test 4 · Robustness"
      takeaway={takeaway}
      info="The lead-lag test from Test 2 repeated under variants of the inputs. Intents volume with its largest days capped, function calls with receipts to aurora and intents.near removed, daily instead of weekly changes. Each cell shows each predictor's strongest positive correlation at a positive lag and the lag it occurs at; a predictor wins a series when its correlation is the larger one and clears the noise band. Sources are the same as above, DefiLlama, NearBlocks and the NEAR BigQuery public dataset."
      table={table}
      queries={pickQueries(data.queries, ["weekly", "leadLag"])}
      footer={<span>Lags are in weeks, or days for the daily variant. Base row first.</span>}
    >
      {variants.length === 0 ? (
        <EmptyState message="No robustness variants in thesis.json. Run npm run rebuild." />
      ) : (
        <div className="max-h-[520px] overflow-auto rounded-md border">
          <Table className="text-xs">
            <caption className="sr-only">Robustness variants with per-usage correlations</caption>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px] whitespace-nowrap">Variant</TableHead>
                {usage.map((u) => (
                  <TableHead key={u.key} className="whitespace-nowrap">
                    {u.label}
                  </TableHead>
                ))}
                <TableHead className="whitespace-nowrap text-right">Wins</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((v) => (
                <TableRow key={v.id} className={v.id === "base" ? "bg-muted/30" : undefined}>
                  <TableCell className="min-w-[180px] max-w-[260px] whitespace-normal align-top">
                    <div className="font-medium">{v.label}</div>
                    <div className="mt-0.5 text-[11px] leading-snug text-ink-300">{v.description}</div>
                  </TableCell>
                  {usage.map((u) => {
                    const cell = v.results[u.key];
                    if (!cell) {
                      return (
                        <TableCell key={u.key} className="align-top text-ink-300">
                          n/a
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell key={u.key} className="whitespace-nowrap align-top">
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1.5 tabular">
                            <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ backgroundColor: CHART.intents }} />
                            <span className="sr-only">Intents volume </span>
                            {cell.intents ? `${fmtR(cell.intents.r)} @${fmtLag(cell.intents.lag, unit(v))}` : "no positive lead"}
                          </span>
                          <span className="inline-flex items-center gap-1.5 tabular text-ink-300">
                            <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ backgroundColor: CHART.price }} />
                            <span className="sr-only">Price </span>
                            vs {cell.price ? `${fmtR(cell.price.r)} @${fmtLag(cell.price.lag, unit(v))}` : "no positive lead"}
                          </span>
                          <span className="text-[10px] text-ink-300">n = {cell.n}</span>
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="tabular whitespace-nowrap text-right align-top">
                    {v.intentsWins} Intents / {v.priceWins} price
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ChartCard>
  );
}
