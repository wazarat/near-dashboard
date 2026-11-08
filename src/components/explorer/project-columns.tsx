"use client";

import { ExternalLink } from "lucide-react";
import { ChainChip, RiskBadge, StatusBadge, TierBadge } from "@/components/atlas/badges";
import { ChangeCell } from "@/components/atlas/change-cell";
import { EstimateLabel } from "@/components/atlas/estimate-label";
import { SparkLine } from "@/components/atlas/spark-line";
import { displayUrl, fmtInt, fmtPct, fmtUsd, fmtUsdFull, METRIC_SHORT, xUrl } from "@/lib/format";
import { changeLabel, rangeDays, sliceTail, type Range } from "@/lib/ranges";
import type { MetricChange, MetricKey, NumericMetricKey, Project } from "@/lib/types";
import { useSeries } from "@/lib/use-series";
import { projectColumnHelper as h, type ProjectColumnDef } from "./data-table";

const num = (v: number | null) => v ?? undefined;

export function Usd({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>;
  return <span title={fmtUsdFull(v)}>{fmtUsd(v)}</span>;
}

function NameCell({ p, onOpen }: { p: Project; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(p.id);
      }}
      className="text-left font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {p.name}
    </button>
  );
}

const right = { meta: { align: "right" } };
const Truncated = ({ v, max = "max-w-xs" }: { v: string | undefined; max?: string }) => (
  <span className={`block ${max} truncate`} title={v}>
    {v ?? <span className="text-muted-foreground">—</span>}
  </span>
);

export function nameColumn(onOpen: (id: string) => void): ProjectColumnDef {
  return h.accessor("name", { header: "Project", cell: ({ row }) => <NameCell p={row.original} onOpen={onOpen} />, sortFn: "alphanumeric" });
}

export const sectorColumn = h.accessor("sector", { header: "Sector", cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue()}</span> });
export const subcategoryColumn = h.accessor((p) => p.subcategory ?? undefined, { id: "subcategory", header: "Subcategory", sortUndefined: "last" });
export const chainColumn = h.accessor("chain", { header: "Native chain", cell: ({ getValue }) => <ChainChip chain={getValue()} /> });
export const chainDetailColumn = h.accessor((p) => p.chainDetail ?? undefined, { id: "chainDetail", header: "Chain detail", sortUndefined: "last" });
export const presenceColumn = h.accessor((p) => (p.presence.length ? p.presence.join(", ") : undefined), { id: "presence", header: "Chain presence", sortUndefined: "last", cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground">Unknown</span> });
export const tierColumn = h.accessor("tier", { header: "Tier", cell: ({ getValue }) => <TierBadge tier={getValue()} /> });
export const statusColumn = h.accessor("statusGroup", { header: "Status", cell: ({ row }) => <StatusBadge group={row.original.statusGroup} status={row.original.status} /> });
export const tvlColumn = h.accessor((p) => num(p.tvl), { id: "tvl", header: "TVL", cell: ({ getValue }) => <Usd v={getValue()} />, sortUndefined: "last", ...right });
export const tvlNearColumn = h.accessor((p) => num(p.tvlNear), { id: "tvlNear", header: "TVL on NEAR", cell: ({ getValue }) => <Usd v={getValue()} />, sortUndefined: "last", ...right });
export const tvlAuroraColumn = h.accessor((p) => num(p.tvlAurora), { id: "tvlAurora", header: "TVL on Aurora", cell: ({ getValue }) => <Usd v={getValue()} />, sortUndefined: "last", ...right });
export const volumeColumn = h.accessor((p) => num(p.volume), { id: "volume", header: "30d volume", cell: ({ getValue }) => <Usd v={getValue()} />, sortUndefined: "last", ...right });
export const feesColumn = h.accessor((p) => num(p.fees), { id: "fees", header: "30d fees", cell: ({ getValue }) => <Usd v={getValue()} />, sortUndefined: "last", ...right });
export const revenueColumn = h.accessor((p) => num(p.revenue), { id: "revenue", header: "30d revenue", cell: ({ getValue }) => <Usd v={getValue()} />, sortUndefined: "last", ...right });
export const captureColumn = h.accessor((p) => num(p.revenueCapture), {
  id: "capture",
  header: "Revenue capture",
  cell: ({ getValue }) => {
    const v = getValue();
    return v === undefined ? <span className="text-muted-foreground">—</span> : fmtPct(v);
  },
  sortUndefined: "last",
  ...right,
});
export const otherTractionColumn = h.accessor((p) => p.otherTraction ?? undefined, { id: "otherTraction", header: "Other traction signal", sortUndefined: "last", cell: ({ getValue }) => <Truncated v={getValue()} /> });
export const fundingColumn = h.accessor("fundingType", { header: "Funding type", cell: ({ getValue }) => <span className={getValue() === "Not researched" ? "text-muted-foreground" : undefined}>{getValue()}</span> });
export const investorsColumn = h.accessor((p) => p.investors ?? undefined, { id: "investors", header: "Investors / backers", sortUndefined: "last", cell: ({ getValue }) => <Truncated v={getValue()} /> });
export const amountColumn = h.accessor((p) => p.amountRaised ?? undefined, { id: "amountRaised", header: "Amount raised", sortUndefined: "last", cell: ({ getValue }) => <Truncated v={getValue()} /> });
export const tokenColumn = h.accessor((p) => p.tokenRaw ?? undefined, { id: "token", header: "Token", sortUndefined: "last", cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground">—</span> });
export const riskColumn = h.accessor("risk", { header: "Security risk", cell: ({ getValue }) => <RiskBadge risk={getValue()} /> });
export const auditsColumn = h.accessor((p) => p.audits ?? undefined, { id: "audits", header: "Audits", sortUndefined: "last", cell: ({ getValue }) => <Truncated v={getValue()} /> });
export const incidentsColumn = h.accessor((p) => p.incidents ?? undefined, { id: "incidents", header: "Incidents", sortUndefined: "last", cell: ({ getValue }) => <Truncated v={getValue()} /> });
export const redFlagsColumn = h.accessor((p) => p.redFlags ?? undefined, { id: "redFlags", header: "Red flags", sortUndefined: "last", cell: ({ getValue }) => <Truncated v={getValue()} /> });
export const viaColumn = h.accessor("discoveredVia", { header: "Discovered via", cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue()}</span> });
export const descriptionColumn = h.accessor("description", { header: "Description", cell: ({ getValue }) => <Truncated v={getValue()} max="max-w-sm" /> });
export const websiteColumn = h.accessor((p) => p.website ?? undefined, {
  id: "website",
  header: "Website",
  sortUndefined: "last",
  cell: ({ getValue }) => {
    const v = getValue();
    return v ? (
      <a href={v} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex max-w-[12rem] items-center gap-1 underline-offset-2 hover:underline">
        <span className="truncate">{displayUrl(v)}</span> <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
      </a>
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  },
});
export const xColumn = h.accessor((p) => p.xHandle ?? undefined, {
  id: "x",
  header: "X",
  sortUndefined: "last",
  cell: ({ getValue }) => {
    const v = getValue();
    return v ? (
      <a href={xUrl(v)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 whitespace-nowrap underline-offset-2 hover:underline">
        {v} <ExternalLink className="size-3 text-muted-foreground" />
      </a>
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  },
});

const numeric = (metric: MetricKey): NumericMetricKey => (metric === "count" ? "tvl" : metric);

/** Percent change of the selected metric over a window, from DefiLlama daily history. */
export function changeColumn(metric: MetricKey, win: keyof MetricChange, hideBelow?: "sm" | "md"): ProjectColumnDef {
  const m = numeric(metric);
  const label = win === "d7" ? "7d" : win === "d30" ? "30d" : "90d";
  return h.accessor((p) => p.live?.change[m][win] ?? undefined, {
    id: `change-${win}`,
    header: `${label} Δ`,
    cell: ({ getValue }) => <ChangeCell value={getValue()} label={`${METRIC_SHORT[m]} ${label}`} />,
    sortUndefined: "last",
    meta: { align: "right", hideBelow },
  });
}

function SparkCell({ id, metric, range }: { id: string; metric: NumericMetricKey; range: Range }) {
  const series = useSeries();
  const pts = series?.projects[id]?.[metric];
  const n = rangeDays(range, 90);
  return <SparkLine points={series ? (pts ? sliceTail(pts, n) : []) : null} label={`${METRIC_SHORT[metric]} trend`} />;
}

/** Inline 80×20 trend of the selected metric over the current range. Not sortable. */
export function sparkColumn(metric: MetricKey, range: Range): ProjectColumnDef {
  const m = numeric(metric);
  return h.display({
    id: "spark",
    header: `Trend (${range === "all" ? "90d" : changeLabel(range)})`,
    cell: ({ row }) => (row.original.live ? <SparkCell id={row.original.id} metric={m} range={range} /> : <span className="text-muted-foreground">—</span>),
    meta: { hideBelow: "md" },
  });
}

function Count({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>;
  return <span>{fmtInt(v)}</span>;
}

export const calls7Column = h.accessor((p) => p.live?.calls7d ?? undefined, { id: "calls7d", header: "7d function calls", cell: ({ getValue }) => <Count v={getValue()} />, sortUndefined: "last", meta: { align: "right" } });
export const calls30Column = h.accessor((p) => p.live?.calls30d ?? undefined, { id: "calls30d", header: "30d function calls", cell: ({ getValue }) => <Count v={getValue()} />, sortUndefined: "last", meta: { align: "right", hideBelow: "sm" } });
export const signersColumn = h.accessor((p) => p.live?.signers7d ?? undefined, {
  id: "signers7d",
  header: () => <EstimateLabel note="Distinct signer accounts summed per day over 7 days from BigQuery receipt_actions to the project's tracked contracts. One person can use many accounts, and relayers or intents hide the end user, so treat it as an estimate.">7d signers</EstimateLabel>,
  cell: ({ getValue }) => <Count v={getValue()} />,
  sortUndefined: "last",
  meta: { align: "right", estimate: true },
});
export const cexReservesColumn = h.accessor((p) => p.live?.cexReserves ?? undefined, { id: "cexReserves", header: "CEX reserves on NEAR", cell: ({ getValue }) => <Usd v={getValue()} />, sortUndefined: "last", ...right });
