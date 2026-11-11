"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, EmptyState } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { CAT } from "@/lib/colors";
import { fmtUsd, fmtUsdFull } from "@/lib/format";
import type { Investor } from "@/lib/types";

export interface InvestorBarRow {
  [key: string]: unknown;
  id: string;
  name: string;
  deals: number;
  leads: number;
  disclosed: number;
  disclosedDeals: number;
  nearRelatedDeals: number;
}

export const TOP_INVESTORS = 15;

export function investorBarRows(investors: Investor[], n = TOP_INVESTORS): InvestorBarRow[] {
  return [...investors]
    .sort((a, b) => b.deals - a.deals || b.leads - a.leads || a.name.localeCompare(b.name))
    .slice(0, n)
    .map((i) => ({ id: i.id, name: i.name, deals: i.deals, leads: i.leads, disclosed: i.totalDisclosed, disclosedDeals: i.disclosedDeals, nearRelatedDeals: i.nearRelatedDeals }));
}

function tableSpec(rows: InvestorBarRow[]): ChartTableSpec {
  return {
    caption: "Investors ranked by number of rounds",
    filename: "top-investors.csv",
    columns: [
      { key: "name", label: "Investor" },
      { key: "deals", label: "Deals", align: "right" },
      { key: "leads", label: "Led", align: "right" },
      { key: "disclosed", label: "Disclosed round total", align: "right", format: (v) => ((v as number) > 0 ? fmtUsdFull(v as number) : "n/a") },
      { key: "nearRelatedDeals", label: "NEAR-related deals", align: "right" },
    ],
    rows,
  };
}

const AXIS_WIDTH = 150;
const LABEL_CHARS = 22;
const shorten = (s: string) => (s.length > LABEL_CHARS ? `${s.slice(0, LABEL_CHARS - 1).trimEnd()}…` : s);

interface TickProps {
  x?: number;
  y?: number;
  payload?: { value?: unknown };
  onSelect: (name: string) => void;
}

/** Investor name rendered as a keyboard-reachable button. */
function InvestorTick({ x = 0, y = 0, payload, onSelect }: TickProps) {
  const name = typeof payload?.value === "string" ? payload.value : "";
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Open ${name}`}
      onClick={() => onSelect(name)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(name);
        }
      }}
      style={{ cursor: "pointer", outline: "none" }}
    >
      <title>{name}</title>
      <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill="var(--ink-secondary)">
        {shorten(name)}
      </text>
    </g>
  );
}

interface Props {
  investors: Investor[];
  totalRounds: number;
  onOpen: (id: string) => void;
  className?: string;
}

/** Horizontal bars: the most active investors by number of rounds they appear in. */
export function InvestorsBars({ investors, totalRounds, onOpen, className }: Props) {
  const rows = useMemo(() => investorBarRows(investors), [investors]);
  const byName = useMemo(() => new Map(rows.map((r) => [r.name, r.id])), [rows]);
  const top = rows[0];
  const allNear = investors.filter((i) => i.deals > 0 && i.nearRelatedDeals === i.deals).length;
  const multi = investors.filter((i) => i.deals >= 2).length;

  const takeaway = top
    ? `${top.name} appears in ${top.deals} of ${totalRounds} recorded rounds; ${multi} of ${investors.length} investors backed more than one project and ${allNear} only appear in NEAR-related deals.`
    : "No investors are recorded in the funding rounds file.";

  const open = (i: number | string | undefined | null) => {
    if (i === null || i === undefined) return;
    const r = rows[Number(i)];
    if (r) onOpen(r.id);
  };

  return (
    <ChartCard
      scope="whole-chain"
      id="top-investors"
      className={className}
      title={`Top ${Math.min(TOP_INVESTORS, rows.length) || TOP_INVESTORS} investors by deals`}
      takeaway={takeaway}
      info="Counts each investor once per round in data/near-funding-rounds-*.csv, whether named as lead or participant. The disclosed total sums the size of the rounds they joined, not their own cheque. Click a bar or a name to open the investor."
      table={tableSpec(rows)}
    >
      {rows.length === 0 ? (
        <EmptyState message="No investors recorded." />
      ) : (
        <div>
          <div style={{ height: Math.max(200, rows.length * 24 + 30) }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 0 }} barCategoryGap={4} onClick={(s) => open(s?.activeIndex)} style={{ cursor: "pointer" }}>
                <CartesianGrid horizontal={false} stroke="var(--grid)" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={AXIS_WIDTH} tickLine={false} axisLine={false} interval={0} tick={<InvestorTick onSelect={(name) => { const id = byName.get(name); if (id) onOpen(id); }} />} />
                <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} content={<InvestorTip />} />
                <Bar dataKey="deals" fill={CAT[0]} radius={[0, 4, 4, 0]} isAnimationActive={false} maxBarSize={18}>
                  <LabelList dataKey="deals" position="right" fontSize={10} fill="var(--ink-secondary)" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-ink-300">Bars count rounds. Click a bar or an investor name to see their rounds and portfolio.</p>
        </div>
      )}
    </ChartCard>
  );
}

function InvestorTip({ active, payload }: TipProps<InvestorBarRow>) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipFrame title={d.name}>
      <TooltipRow label="Rounds" value={d.deals} />
      <TooltipRow label="Led" value={d.leads} />
      <TooltipRow label="Disclosed round total" value={d.disclosedDeals > 0 ? fmtUsd(d.disclosed) : "n/a"} />
      <TooltipRow label="NEAR-related" value={`${d.nearRelatedDeals} of ${d.deals}`} />
      <div className="pt-1 text-ink-300">Click to open</div>
    </TooltipFrame>
  );
}
