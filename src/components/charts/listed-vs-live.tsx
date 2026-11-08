"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, EmptyState, Legend } from "@/components/atlas/chart-card";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { meta } from "@/lib/data";
import { fmtPct } from "@/lib/format";
import type { Project } from "@/lib/types";

interface Row {
  via: string;
  listed: number;
  live: number;
  share: number | null;
}

const LISTED = "var(--tier-none)";
const LIVE = "var(--chain-near)";

export function listedVsLiveRows(projects: Project[]): Row[] {
  return meta.discoveredVia
    .map((via) => {
      const listed = projects.filter((p) => p.discoveredViaList.includes(via));
      const live = listed.filter((p) => p.hasTraction).length;
      return { via, listed: listed.length, live, share: listed.length ? live / listed.length : null };
    })
    .filter((r) => r.listed > 0)
    .sort((a, b) => b.listed - a.listed || a.via.localeCompare(b.via));
}

function takeawayFor(rows: Row[]): string {
  if (rows.length === 0) return "No projects match the current filters.";
  const top = rows[0];
  let s = `${top.via} lists ${top.listed} project${top.listed === 1 ? "" : "s"}, ${top.live} with measurable activity (${fmtPct(top.share)}).`;
  const best = rows.filter((r) => r.listed >= 5 && r.share !== null).sort((a, b) => (b.share as number) - (a.share as number))[0];
  if (best && best.via !== top.via) s += ` ${best.via} has the highest live share at ${fmtPct(best.share)}.`;
  return s;
}

export function ListedVsLive({ projects, onSelect }: { projects: Project[]; onSelect: (via: string) => void }) {
  const rows = useMemo(() => listedVsLiveRows(projects), [projects]);
  const sources = meta.discoveredVia.join(", ");

  return (
    <ChartCard
      id="listed-vs-live"
      title="Listed vs live by discovery source"
      takeaway={takeawayFor(rows)}
      info={`Projects grouped by where they were found (the Discovered Via column, ${sources}) against the number with any TVL, volume, fee or revenue figure on DefiLlama. A project found in several sources counts once in each. Click a bar to filter by that source.`}
      table={{
        columns: [
          { key: "via", label: "Discovered via" },
          { key: "listed", label: "Listed", align: "right" },
          { key: "live", label: "With any onchain metric", align: "right" },
          { key: "share", label: "Live share", align: "right", format: (v) => fmtPct(v as number | null) },
        ],
        rows: rows as unknown as Record<string, unknown>[],
        filename: "listed-vs-live.csv",
        caption: "Projects listed per discovery source and how many show onchain activity",
      }}
    >
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div>
          <Legend
            className="mb-2"
            items={[
              { label: "Listed", color: LISTED, shape: "square" },
              { label: "With any onchain metric", color: LIVE, shape: "square" },
            ]}
          />
          <div className="w-full" style={{ height: Math.max(180, rows.length * 44 + 24) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 4, right: 44, bottom: 4, left: 4 }}
                barCategoryGap={10}
                barGap={2}
                onClick={(s) => {
                  const i = s?.activeIndex;
                  const r = i === null || i === undefined ? undefined : rows[Number(i)];
                  if (r) onSelect(r.via);
                }}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid horizontal={false} stroke="var(--grid)" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={10} />
                <YAxis type="category" dataKey="via" width={150} tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} content={<LiveTip />} />
                <Bar dataKey="listed" name="Listed" fill={LISTED} radius={[0, 3, 3, 0]} isAnimationActive={false} maxBarSize={12}>
                  <LabelList dataKey="listed" position="right" fontSize={10} fill="var(--ink-secondary)" />
                </Bar>
                <Bar dataKey="live" name="With any onchain metric" fill={LIVE} radius={[0, 3, 3, 0]} isAnimationActive={false} maxBarSize={12}>
                  <LabelList dataKey="live" position="right" fontSize={10} fill="var(--ink-secondary)" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {rows.map((r) => (
              <li key={r.via}>
                <button type="button" onClick={() => onSelect(r.via)} title={`Filter to ${r.via}`} className="rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {r.via} <span className="tabular">{r.live}/{r.listed}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}

function LiveTip({ active, payload }: TipProps<Row>) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipFrame title={d.via}>
      <TooltipRow label="Listed" value={d.listed} color={LISTED} />
      <TooltipRow label="With any onchain metric" value={`${d.live} (${fmtPct(d.share)})`} color={LIVE} />
      <div className="pt-1 text-muted-foreground">Click to filter by this source</div>
    </TooltipFrame>
  );
}
