"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState, Legend } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { TIER_COLOR, TIER_SHORT } from "@/lib/colors";
import { TIERS, type Project, type Tier } from "@/lib/types";
import { SECTOR_AXIS_WIDTH, SectorTick } from "./sector-bars";

export type TierRow = { [key: string]: unknown; sector: string; total: number; tracked: number } & Record<Tier, number>;

/** Project counts per traction tier for each sector, largest sector first. */
export function tierRows(projects: Project[]): TierRow[] {
  const m = new Map<string, TierRow>();
  for (const p of projects) {
    const r = m.get(p.sector) ?? ({ sector: p.sector, total: 0, tracked: 0, ...Object.fromEntries(TIERS.map((t) => [t, 0])) } as TierRow);
    r[p.tier] += 1;
    r.total += 1;
    if (p.tier !== "Not tracked") r.tracked += 1;
    m.set(p.sector, r);
  }
  return Array.from(m.values()).sort((a, b) => b.total - a.total);
}

export function tierTable(rows: TierRow[]): ChartTableSpec {
  return {
    caption: "Traction tier counts by sector",
    filename: "tier-by-sector.csv",
    columns: [{ key: "sector", label: "Sector" }, ...TIERS.map((t) => ({ key: t, label: TIER_SHORT[t], align: "right" as const })), { key: "total", label: "Total", align: "right" }],
    rows,
  };
}

export function TierBySector({ projects, onSelect }: { projects: Project[]; onSelect: (sector: string) => void }) {
  const rows = useMemo(() => tierRows(projects), [projects]);

  if (rows.length === 0) return <EmptyState />;
  const height = Math.max(240, rows.length * 24 + 30);
  const open = (i: number | string | undefined | null) => {
    if (i === null || i === undefined) return;
    const r = rows[Number(i)];
    if (r) onSelect(r.sector);
  };

  return (
    <div>
      <Legend items={TIERS.map((t) => ({ label: TIER_SHORT[t], color: TIER_COLOR[t], shape: "square" as const }))} className="mb-2" />
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }} barCategoryGap={4} onClick={(s) => open(s?.activeIndex)} style={{ cursor: "pointer" }}>
            <CartesianGrid horizontal={false} stroke="var(--grid)" />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="sector" width={SECTOR_AXIS_WIDTH} tickLine={false} axisLine={false} interval={0} tick={<SectorTick onSelect={onSelect} />} />
            <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} content={<TierTip />} />
            {TIERS.map((t) => (
              <Bar key={t} dataKey={t} stackId="t" fill={TIER_COLOR[t]} stroke="var(--background)" strokeWidth={1} isAnimationActive={false} maxBarSize={18} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-ink-300">&ldquo;Negligible&rdquo; means listed on DefiLlama with every figure at zero; &ldquo;TBD&rdquo; means no DefiLlama listing yet, so the tier is to be determined.</p>
    </div>
  );
}

function TierTip({ active, payload }: TipProps<TierRow>) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipFrame title={d.sector}>
      {TIERS.map((t) => (
        <TooltipRow key={t} label={TIER_SHORT[t]} color={TIER_COLOR[t]} value={d[t]} />
      ))}
      <TooltipRow label="Total" value={d.total} />
      <div className="pt-1 text-ink-300">Click to open sector</div>
    </TooltipFrame>
  );
}
