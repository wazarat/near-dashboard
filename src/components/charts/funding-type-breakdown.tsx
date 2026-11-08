"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, EmptyState } from "@/components/atlas/chart-card";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { FUNDING_ORDER, fundingBucket, fundingColor } from "@/lib/colors";
import { fmtPct } from "@/lib/format";
import type { Project } from "@/lib/types";

interface Row {
  bucket: string;
  count: number;
  share: number | null;
  color: string;
  hint?: string;
}

const HINT: Record<string, string> = {
  "Not researched": "Not researched = never checked",
  "Not disclosed": "Not disclosed = checked, nothing found",
};

/** Display order: the fixed categorical buckets first, then the two muted "no information" buckets. */
const ORDER: readonly string[] = [...FUNDING_ORDER, "Not disclosed", "Not researched"];

export function fundingRows(projects: Project[]): Row[] {
  const m = new Map<string, number>();
  for (const p of projects) {
    const buckets = new Set((p.fundingTypes.length ? p.fundingTypes : ["Not researched"]).map(fundingBucket));
    for (const b of buckets) m.set(b, (m.get(b) ?? 0) + 1);
  }
  return ORDER.filter((b) => m.has(b)).map((b) => ({
    bucket: b,
    count: m.get(b) as number,
    share: projects.length ? (m.get(b) as number) / projects.length : null,
    color: fundingColor(b),
    hint: HINT[b],
  }));
}

function takeawayFor(projects: Project[], rows: Row[]): string {
  if (projects.length === 0) return "No projects match the current filters.";
  const researched = projects.filter((p) => p.fundingType !== "Not researched").length;
  const vc = rows.find((r) => r.bucket === "VC-backed")?.count ?? 0;
  const nd = rows.find((r) => r.bucket === "Not disclosed")?.count ?? 0;
  let s = `${researched} of ${projects.length} projects were researched for funding; ${vc} ${vc === 1 ? "is" : "are"} VC-backed`;
  if (nd > 0) s += ` and ${nd} ${nd === 1 ? "was" : "were"} checked with nothing found`;
  return `${s}.`;
}

export function FundingTypeBreakdown({ projects, onSelect, className }: { projects: Project[]; onSelect: (bucket: string) => void; className?: string }) {
  const rows = useMemo(() => fundingRows(projects), [projects]);
  const multi = useMemo(() => projects.filter((p) => p.fundingTypes.length > 1).length, [projects]);

  return (
    <ChartCard
      className={className}
      id="funding-type"
      title="Funding type"
      takeaway={takeawayFor(projects, rows)}
      info={`Projects per funding type from the Funding Type column of the research sheet. A project with two types (for example "VC-backed; Token-funded") counts once in each bar${multi ? `; ${multi} projects do` : ""}. Rare types fold into Other. The grey bars separate projects never checked (Not researched) from those checked with nothing found (Not disclosed). Click a bar to filter.`}
      table={{
        columns: [
          { key: "bucket", label: "Funding type" },
          { key: "count", label: "Projects", align: "right" },
          { key: "share", label: "Share of selection", align: "right", format: (v) => fmtPct(v as number | null) },
        ],
        rows: rows.map(({ bucket, count, share }) => ({ bucket, count, share })),
        filename: "funding-type.csv",
        caption: "Projects per funding type",
      }}
    >
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div>
          <div className="w-full" style={{ height: Math.max(160, rows.length * 32 + 16) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 4, right: 44, bottom: 4, left: 4 }}
                barCategoryGap={6}
                onClick={(s) => {
                  const i = s?.activeIndex;
                  const r = i === null || i === undefined ? undefined : rows[Number(i)];
                  if (r && r.bucket !== "Other") onSelect(r.bucket);
                }}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid horizontal={false} stroke="var(--grid)" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={10} />
                <YAxis type="category" dataKey="bucket" width={150} tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} content={<FundingTip />} />
                <Bar dataKey="count" name="Projects" radius={[0, 3, 3, 0]} isAnimationActive={false} maxBarSize={18}>
                  {rows.map((r) => (
                    <Cell key={r.bucket} fill={r.color} stroke={r.hint ? "var(--ink-muted)" : undefined} strokeDasharray={r.bucket === "Not researched" ? "3 2" : undefined} />
                  ))}
                  <LabelList dataKey="count" position="right" fontSize={10} fill="var(--ink-secondary)" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {rows.map((r) => (
              <li key={r.bucket}>
                <button
                  type="button"
                  onClick={() => onSelect(r.bucket)}
                  disabled={r.bucket === "Other"}
                  title={r.hint ?? `Filter to ${r.bucket}`}
                  className="inline-flex items-center gap-1.5 rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:no-underline"
                >
                  <span aria-hidden="true" className="inline-block size-2.5 rounded-[2px]" style={{ backgroundColor: r.color }} />
                  {r.bucket} <span className="tabular">{r.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}

function FundingTip({ active, payload }: TipProps<Row>) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipFrame title={d.bucket}>
      <TooltipRow label="Projects" value={`${d.count} (${fmtPct(d.share)})`} color={d.color} />
      {d.hint && <div className="text-muted-foreground">Not researched = never checked; Not disclosed = checked, nothing found</div>}
      {d.bucket !== "Other" && <div className="pt-1 text-muted-foreground">Click to filter</div>}
    </TooltipFrame>
  );
}
