"use client";

import { NotTracked } from "@/components/atlas/not-tracked";
import { useMemo } from "react";
import { ChartCard, EmptyState } from "@/components/atlas/chart-card";
import { DataTable, projectColumnHelper as h, type ProjectColumnDef } from "@/components/explorer/data-table";
import { nameColumn, Usd } from "@/components/explorer/project-columns";
import { fmtRatio, fmtUsd } from "@/lib/format";
import type { Project } from "@/lib/types";

/** Projects with a daily fees or revenue figure from DefiLlama. Zero counts as a figure; blank does not. */
export function financialRows(projects: Project[]): Project[] {
  return projects.filter((p) => p.live && (p.live.fees !== null || p.live.revenue !== null));
}

const num = (v: number | null | undefined) => (v === null || v === undefined ? undefined : v);
const right = { meta: { align: "right" as const } };

export function financialColumns(onOpen: (id: string) => void, withPs: boolean): ProjectColumnDef[] {
  const cols: ProjectColumnDef[] = [
    nameColumn(onOpen),
    h.accessor((p) => num(p.live?.fees), { id: "fees", header: "30d fees", cell: ({ getValue }) => <Usd v={getValue()} />, sortUndefined: "last", ...right }),
    h.accessor((p) => num(p.live?.supplySideRevenue), { id: "supplySide", header: "30d supply-side revenue", cell: ({ getValue }) => <Usd v={getValue()} />, sortUndefined: "last", meta: { align: "right", hideBelow: "lg" } }),
    h.accessor((p) => num(p.live?.revenue), { id: "revenue", header: "30d protocol revenue", cell: ({ getValue }) => <Usd v={getValue()} />, sortUndefined: "last", ...right }),
    h.accessor((p) => num(p.live?.holdersRevenue), { id: "holdersRevenue", header: "30d holders revenue", cell: ({ getValue }) => <Usd v={getValue()} />, sortUndefined: "last", meta: { align: "right", hideBelow: "lg" } }),
    h.accessor((p) => num(p.live?.annualisedRevenue), { id: "annualised", header: "Annualised revenue", cell: ({ getValue }) => <Usd v={getValue()} />, sortUndefined: "last", meta: { align: "right", hideBelow: "sm" } }),
    h.accessor((p) => num(p.live?.tokenMarketCap), { id: "mcap", header: "Market cap", cell: ({ getValue }) => <Usd v={getValue()} />, sortUndefined: "last", meta: { align: "right", hideBelow: "md" } }),
  ];
  if (withPs) {
    cols.push(
      h.accessor((p) => num(p.live?.psRatio), {
        id: "ps",
        header: "P/S",
        cell: ({ getValue }) => {
          const v = getValue();
          return v === undefined ? <NotTracked /> : <span title="Market cap divided by annualised 30d revenue">{fmtRatio(v, 1)}</span>;
        },
        sortUndefined: "last",
        meta: { align: "right", hideBelow: "md" },
      }),
    );
  }
  return cols;
}

export function financialsTakeaway(rows: Project[], total: number): string {
  if (rows.length === 0) return "No project in the current selection reports fees or revenue on DefiLlama.";
  const earning = rows.filter((p) => (p.live?.fees ?? 0) > 0);
  const topFees = [...rows].sort((a, b) => (b.live?.fees ?? 0) - (a.live?.fees ?? 0))[0];
  const feeSum = rows.reduce((a, p) => a + (p.live?.fees ?? 0), 0);
  const revSum = rows.reduce((a, p) => a + (p.live?.revenue ?? 0), 0);
  const withPs = rows.filter((p) => p.live?.psRatio !== null && p.live?.psRatio !== undefined).length;
  const share = feeSum > 0 && topFees.live?.fees ? ` (${Math.round((topFees.live.fees / feeSum) * 100)}% of the ${fmtUsd(feeSum)} total)` : "";
  const capture = feeSum > 0 ? `; protocols kept ${Math.round((revSum / feeSum) * 100)}% of fees as revenue` : "";
  const ps = withPs > 0 ? `; ${withPs} ${withPs === 1 ? "has" : "have"} both a market cap and revenue, so a P/S can be read` : "; none has both a market cap and revenue, so no P/S can be read";
  return `${rows.length} of ${total} projects report 30d fees or revenue, ${earning.length} above zero. ${topFees.name} earned the most fees${share}${capture}${ps}.`;
}

interface Props {
  projects: Project[];
  onOpen: (id: string) => void;
  className?: string;
}

/** Fees, the three revenue splits, annualised revenue, market cap and P/S for every project with a DefiLlama fees adapter. */
export function FinancialsTable({ projects, onOpen, className }: Props) {
  const rows = useMemo(() => financialRows(projects), [projects]);
  const withPs = rows.some((p) => p.live?.psRatio !== null && p.live?.psRatio !== undefined);
  const columns = useMemo(() => financialColumns(onOpen, withPs), [onOpen, withPs]);
  return (
    <ChartCard
      id="financials"
      className={className}
      title="Financials"
      takeaway={financialsTakeaway(rows, projects.length)}
      info="DefiLlama fees and revenue adapters summed over the last 30 complete UTC days. Fees are what users pay; supply-side revenue goes to liquidity providers or lenders; protocol revenue to the treasury or token; holders revenue is the part paid or burnt for token holders. Annualised revenue is 30d revenue × 365/30. Market cap from DefiLlama's protocol listing."
      footer="Incentives and emissions are not included (the DefiLlama endpoints for them are paid). Market cap from DefiLlama's listing; P/S = market cap / annualised 30d revenue."
    >
      {rows.length === 0 ? (
        <EmptyState message="No projects with fees or revenue data in this selection." />
      ) : (
        <div className="-mx-4">
          <DataTable key={withPs ? "ps" : "nops"} data={rows} columns={columns} initialSorting={[{ id: "fees", desc: true }]} pageSize={25} dense getRowId={(p) => p.id} onRowClick={(p) => onOpen(p.id)} emptyMessage="No projects with fees or revenue data in this selection." />
        </div>
      )}
    </ChartCard>
  );
}
