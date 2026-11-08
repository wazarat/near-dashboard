"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/atlas/chart-card";
import type { ChartTableSpec } from "@/components/atlas/chart-table";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { RISK_COLOR } from "@/lib/colors";
import { fmtInt, fmtPct } from "@/lib/format";
import { RISK_LEVELS, type Project, type RiskLevel } from "@/lib/types";

export interface RiskRow {
  risk: RiskLevel;
  count: number;
  /** Share of the projects passed in. */
  share: number;
}

const NOTE: Partial<Record<RiskLevel, string>> = {
  "Not researched": "Not researched = never checked.",
  Unknown: "Unknown = checked, nothing found. No audit and no incident turned up; it does not mean unaudited.",
};

const HATCH_ID = "risk-hatch-notresearched";

/** Counts per Security Risk Level in the fixed order High, Medium, Low, Unknown, Not researched. */
export function riskCounts(projects: Project[]): RiskRow[] {
  const n = projects.length;
  return RISK_LEVELS.map((risk) => {
    const count = projects.filter((p) => p.risk === risk).length;
    return { risk, count, share: n ? count / n : 0 };
  });
}

export function riskTableSpec(rows: RiskRow[]): ChartTableSpec {
  return {
    caption: "Projects per security risk level",
    filename: "near-atlas-risk-levels.csv",
    columns: [
      { key: "risk", label: "Security risk level" },
      { key: "count", label: "Projects", align: "right" },
      { key: "share", label: "Share of selection", align: "right", format: (v) => fmtPct(v as number, 1) },
      { key: "note", label: "Meaning", format: (v) => (v ? String(v) : "Researcher's rating") },
    ],
    rows: rows.map((r) => ({ ...r, note: NOTE[r.risk] ?? null })),
  };
}

export function RiskBreakdown({ rows, onSelect }: { rows: RiskRow[]; onSelect?: (risk: RiskLevel) => void }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (total === 0) return <EmptyState />;
  return (
    <div>
      <div className="h-[200px] w-full" role="img" aria-label={rows.map((r) => `${r.risk} ${fmtInt(r.count)}`).join("; ")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 44, bottom: 4, left: 4 }}
            barCategoryGap={8}
            onClick={(s) => {
              const i = s?.activeIndex;
              const r = i === null || i === undefined ? undefined : rows[Number(i)];
              if (r && onSelect) onSelect(r.risk);
            }}
            style={{ cursor: onSelect ? "pointer" : undefined }}
          >
            <defs>
              <pattern id={HATCH_ID} patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
                <rect width={6} height={6} fill="var(--surface-chart)" />
                <line x1={0} y1={0} x2={0} y2={6} stroke={RISK_COLOR["Not researched"]} strokeWidth={2} />
              </pattern>
            </defs>
            <CartesianGrid horizontal={false} stroke="var(--grid)" />
            <XAxis type="number" scale="sqrt" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--ink-muted)", fontSize: 11 }} tickFormatter={(v) => fmtInt(v as number)} />
            <YAxis type="category" dataKey="risk" width={104} tickLine={false} axisLine={false} interval={0} tick={{ fill: "var(--ink-secondary)", fontSize: 11 }} />
            <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} content={<RiskTip />} wrapperStyle={{ outline: "none" }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false} maxBarSize={18} minPointSize={2}>
              {rows.map((r) =>
                r.risk === "Not researched" ? (
                  <Cell key={r.risk} fill={`url(#${HATCH_ID})`} stroke={RISK_COLOR[r.risk]} strokeWidth={1} strokeDasharray="3 2" />
                ) : (
                  <Cell key={r.risk} fill={RISK_COLOR[r.risk]} />
                ),
              )}
              <LabelList dataKey="count" position="right" fontSize={11} fill="var(--ink-secondary)" formatter={(v: unknown) => fmtInt(v as number)} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Square-root axis so the small rated groups stay visible next to the unresearched rows. {onSelect ? "Click a bar to filter the Atlas to that level." : ""}</p>
    </div>
  );
}

function RiskTip({ active, payload }: TipProps<RiskRow>) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipFrame title={d.risk}>
      <TooltipRow label="Projects" color={RISK_COLOR[d.risk]} value={fmtInt(d.count)} />
      <TooltipRow label="Share of selection" value={fmtPct(d.share, 1)} />
      {NOTE[d.risk] && <p className="pt-1 leading-snug text-muted-foreground">{NOTE[d.risk]}</p>}
    </TooltipFrame>
  );
}
