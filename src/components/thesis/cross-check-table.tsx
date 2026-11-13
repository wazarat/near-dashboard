"use client";

import { ChartCard, EmptyState } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LeadLagSummary, OosResult } from "@/lib/stats";
import type { ThesisJson } from "@/lib/thesis-types";
import { fmtLag, fmtR, pickQueries } from "./palette";

interface CheckRow {
  usage: string;
  source: string;
  used: boolean;
  intentsLag: number | null;
  intentsR: number | null;
  priceLag: number | null;
  priceR: number | null;
  oosIntents: number | null;
  oosPrice: number | null;
  n: number;
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function fmtRatio(v: number | null): string {
  return v === null ? "n/a" : v.toFixed(4);
}

/** BigQuery chain counts against the same counts from NearBlocks: the daily ratio, the weeks that disagree and both tests on each source. */
export function CrossCheckTable({ data }: { data: ThesisJson }) {
  const { usage, crossCheck, leadLag, oos } = data;
  const checked = usage.filter((u) => crossCheck[u.key] && leadLag[u.key] && oos[u.key]);

  const row = (label: string, source: string, used: boolean, ll: { intents: LeadLagSummary; price: LeadLagSummary }, o: { intents: OosResult; price: OosResult }): CheckRow => ({
    usage: label,
    source,
    used,
    intentsLag: ll.intents.bestPositiveLead?.lag ?? null,
    intentsR: ll.intents.bestPositiveLead?.r ?? null,
    priceLag: ll.price.bestPositiveLead?.lag ?? null,
    priceR: ll.price.bestPositiveLead?.r ?? null,
    oosIntents: o.intents.r2Oos,
    oosPrice: o.price.r2Oos,
    n: ll.intents.n,
  });
  const rows: CheckRow[] = checked.flatMap((u) => {
    const c = crossCheck[u.key]!;
    return [row(u.label, u.source, true, leadLag[u.key]!, oos[u.key]!), row(u.label, "NearBlocks", false, c.leadLag, c.oos)];
  });

  const flagged = checked.reduce((a, u) => a + crossCheck[u.key]!.flaggedWeeks.length, 0);
  const takeaway =
    checked.length === 0
      ? "No NearBlocks series to compare with yet."
      : `Daily ${joinList(checked.map((u) => `${u.label.toLowerCase()} from BigQuery is a median ${fmtRatio(crossCheck[u.key]!.ratioMedian)} of NearBlocks' daily count over ${crossCheck[u.key]!.days} days`))}; ${flagged === 0 ? "no week differs by more than 10%" : `${flagged} week${flagged === 1 ? "" : "s"} differ by more than 10%`}.`;

  const table: ChartTableSpec = {
    columns: [
      { key: "usage", label: "Usage series" },
      { key: "source", label: "Source" },
      { key: "intentsLag", label: "Intents lead (weeks)", align: "right", format: (v) => fmtLag(v as number | null) },
      { key: "intentsR", label: "Intents r", align: "right", format: (v) => fmtR(v as number | null) },
      { key: "priceLag", label: "Price lead (weeks)", align: "right", format: (v) => fmtLag(v as number | null) },
      { key: "priceR", label: "Price r", align: "right", format: (v) => fmtR(v as number | null) },
      { key: "oosIntents", label: "Out-of-sample R², Intents", align: "right", format: (v) => fmtR(v as number | null) },
      { key: "oosPrice", label: "Out-of-sample R², price", align: "right", format: (v) => fmtR(v as number | null) },
      { key: "n", label: "Pairs", align: "right" },
    ],
    rows: rows.map((r) => ({ ...r })),
    caption: "Lead-lag and out-of-sample results on BigQuery and on NearBlocks",
    filename: "thesis-cross-check.csv",
  };

  return (
    <ChartCard takeawayPlacement="inline"
      scope="whole-chain"
      id="thesis-cross-check"
      title="NearBlocks cross-check"
      takeaway={takeaway}
      info="Daily transactions and active accounts (distinct signers) come from the transactions table of the NEAR BigQuery public dataset and are the rows every test on this page uses. NearBlocks' daily charts publish the same two counts; they are kept as a check. The ratio is BigQuery divided by NearBlocks per day, and a week is listed when the two weekly totals differ by more than 10%. The table repeats the lead-lag and out-of-sample tests on each source."
      table={table}
      queries={pickQueries(data.queries, ["dailyChain", "nearblocks", "weekly", "leadLag", "oos"])}
    >
      {checked.length === 0 ? (
        <EmptyState message="No cross-check in thesis.json. Run npm run rebuild." />
      ) : (
        <div className="space-y-3">
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            {checked.map((u) => {
              const c = crossCheck[u.key]!;
              return (
                <div key={u.key}>
                  <dt className="text-ink-300">{u.label}, BigQuery / NearBlocks</dt>
                  <dd className="tabular text-sm font-medium">
                    median {fmtRatio(c.ratioMedian)}, range {fmtRatio(c.ratioMin)} to {fmtRatio(c.ratioMax)}
                  </dd>
                  <dd className="text-ink-300">
                    {c.days} days, {c.flaggedWeeks.length} of {c.weeks} weeks differ by more than 10%
                  </dd>
                </div>
              );
            })}
          </dl>
          <div className="overflow-auto rounded-md border">
            <Table className="text-xs">
              <caption className="sr-only">Lead-lag and out-of-sample results on each source</caption>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Usage series</TableHead>
                  <TableHead className="whitespace-nowrap">Source</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Intents leads</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Price leads</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Out-of-sample R², Intents / price</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Pairs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.usage}-${r.source}`} className={r.used ? "bg-muted/30" : undefined}>
                    <TableCell className="whitespace-nowrap font-medium">{r.usage}</TableCell>
                    <TableCell className="whitespace-nowrap text-ink-300">
                      {r.source} {r.used ? "(used)" : "(check)"}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap text-right">{r.intentsR === null ? "no positive lead" : `${fmtR(r.intentsR)} @${fmtLag(r.intentsLag)}`}</TableCell>
                    <TableCell className="tabular whitespace-nowrap text-right">{r.priceR === null ? "no positive lead" : `${fmtR(r.priceR)} @${fmtLag(r.priceLag)}`}</TableCell>
                    <TableCell className="tabular whitespace-nowrap text-right">
                      {fmtR(r.oosIntents)} / {fmtR(r.oosPrice)}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap text-right">{r.n}</TableCell>
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
