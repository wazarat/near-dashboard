"use client";

import { NONE } from "@/lib/coverage";
import { useMemo } from "react";
import { InvestorsBars } from "@/components/charts/investors-bars";
import { DataTable, makeColumnHelper, type AnyColumnDef } from "@/components/explorer/data-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { investors, projectById, rounds } from "@/lib/data";
import { useFilters } from "@/lib/filters";
import { fmtInt, fmtPct, fmtUsd, fmtUsdFull } from "@/lib/format";
import type { Investor, Round } from "@/lib/types";

const h = makeColumnHelper<Investor>();

export interface InvestorTakeaway {
  investors: number;
  rounds: number;
  topLead: Investor | null;
  /** Share of all disclosed round USD that the ten most active investors took part in. */
  topTenShare: number | null;
  disclosedTotal: number;
}

/** Everything in the headline is computed from the investors and rounds files. */
export function investorTakeaway(list: Investor[], all: Round[]): InvestorTakeaway {
  const topLead = list.reduce<Investor | null>((best, i) => (i.leads > 0 && (!best || i.leads > best.leads) ? i : best), null);
  const amount = new Map(all.filter((r) => r.amount !== null).map((r) => [r.id, r.amount as number]));
  const disclosedTotal = Array.from(amount.values()).reduce((a, v) => a + v, 0);
  const topTen = [...list].sort((a, b) => b.deals - a.deals).slice(0, 10);
  const joined = new Set(topTen.flatMap((i) => i.roundIds));
  const topTenUsd = Array.from(joined).reduce((a, id) => a + (amount.get(id) ?? 0), 0);
  return { investors: list.length, rounds: all.length, topLead, topTenShare: disclosedTotal > 0 ? topTenUsd / disclosedTotal : null, disclosedTotal };
}

function PortfolioChips({ inv, onOpen }: { inv: Investor; onOpen: (id: string) => void }) {
  if (inv.projects.length === 0) return <span className="text-ink-300">{NONE}</span>;
  return (
    <span className="flex max-w-md flex-wrap gap-1">
      {inv.projects.map((name, i) => {
        const id = inv.projectIds[i];
        const known = id ? projectById(id) : undefined;
        return known ? (
          <button
            key={`${id}-${i}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(known.id);
            }}
            className="text-xs text-ink-50 underline-offset-2 hover:text-ink-50 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60"
          >
            {name}
          </button>
        ) : (
          <span key={`${name}-${i}`} className="text-xs text-ink-300" title="No project row in the Atlas">
            {name}
          </span>
        );
      })}
    </span>
  );
}

export function investorColumns(onOpenInvestor: (id: string) => void, onOpenProject: (id: string) => void): AnyColumnDef<Investor>[] {
  return [
    h.accessor("name", {
      header: "Investor",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenInvestor(row.original.id);
          }}
          className="text-left font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.original.name}
        </button>
      ),
      sortFn: "alphanumeric",
    }),
    h.accessor("deals", { header: "Deals", cell: ({ getValue }) => <span className="tabular">{fmtInt(getValue())}</span>, meta: { align: "right" } }),
    h.accessor("leads", { header: "Leads", cell: ({ getValue }) => <span className="tabular">{fmtInt(getValue())}</span>, meta: { align: "right", hideBelow: "sm" } }),
    h.accessor((i) => (i.disclosedDeals > 0 ? i.totalDisclosed : undefined), {
      id: "disclosed",
      header: "Disclosed total",
      cell: ({ row }) =>
        row.original.disclosedDeals > 0 ? (
          <span className="tabular" title={`${fmtUsdFull(row.original.totalDisclosed)} across ${row.original.disclosedDeals} round${row.original.disclosedDeals === 1 ? "" : "s"} with a disclosed amount`}>
            {fmtUsd(row.original.totalDisclosed)}
          </span>
        ) : (
          <span className="text-ink-300" title="None of this investor's rounds disclose an amount">
            n/a
          </span>
        ),
      sortUndefined: "last",
      meta: { align: "right" },
    }),
    h.accessor("nearRelatedDeals", {
      header: "NEAR-related",
      cell: ({ row }) => {
        const all = row.original.deals > 0 && row.original.nearRelatedDeals === row.original.deals;
        return (
          <span className="tabular whitespace-nowrap" title={all ? "Every deal is NEAR related" : `${row.original.nearRelatedDeals} of ${row.original.deals} deals are NEAR related`}>
            {all && <span aria-hidden="true">◆ </span>}
            {fmtInt(row.original.nearRelatedDeals)}
            <span className="text-ink-300"> / {fmtInt(row.original.deals)}</span>
            {all && <span className="sr-only"> (all deals NEAR related)</span>}
          </span>
        );
      },
      meta: { align: "right", hideBelow: "md" },
    }),
    h.accessor((i) => i.projects.join(", "), {
      id: "portfolio",
      header: "Portfolio",
      cell: ({ row }) => <PortfolioChips inv={row.original} onOpen={onOpenProject} />,
      enableSorting: false,
      meta: { hideBelow: "sm" },
    }),
  ];
}

/** Investors page: who backs the ecosystem, how often, and with what disclosed money. */
export function InvestorsView() {
  const { openInvestor, openProject } = useFilters();
  const columns = useMemo(() => investorColumns(openInvestor, openProject), [openInvestor, openProject]);
  const t = useMemo(() => investorTakeaway(investors, rounds), []);
  const undisclosed = investors.filter((i) => i.disclosedDeals === 0).length;

  return (
    <div className="space-y-4">
      <InvestorsBars investors={investors} totalRounds={rounds.length} onOpen={openInvestor} />

      <Card className="gap-3 py-4" data-chart-card="Investors">
        <CardHeader className="px-4">
          <h3 className="text-sm font-semibold">Investors ({t.investors})</h3>
          <p className="text-sm text-ink-300">
            {t.investors} investors across {t.rounds} rounds
            {t.topLead && (
              <>
                ; {t.topLead.name} led the most rounds ({t.topLead.leads})
              </>
            )}
            {t.topTenShare !== null && (
              <>
                ; the ten most active investors sat in rounds worth {fmtPct(t.topTenShare)} of the {fmtUsd(t.disclosedTotal)} disclosed
              </>
            )}
            . Everyone named as a lead or participating investor in the rounds file. Disclosed total sums the rounds an investor joined, not their own cheque; it reads n/a when none of their rounds disclose an amount
            {undisclosed > 0 ? ` (${undisclosed} investor${undisclosed === 1 ? "" : "s"})` : ""}. ◆ marks investors whose every deal is NEAR related. Click an investor for their rounds, or a portfolio chip to open the project.
          </p>
        </CardHeader>
        <CardContent className="px-0">
          <DataTable data={investors} columns={columns} initialSorting={[{ id: "deals", desc: true }]} pageSize={25} dense getRowId={(i) => i.id} onRowClick={(i) => openInvestor(i.id)} emptyMessage="No investors recorded in the funding rounds file." />
        </CardContent>
      </Card>
    </div>
  );
}
