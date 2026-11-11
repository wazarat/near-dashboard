"use client";

import { OneLineAxis } from "@/components/atlas/one-line-axis";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, EmptyState } from "@/components/atlas/chart-card";
import { frameHeight, type ChartFrame } from "@/components/atlas/chart-frame";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { fmtPct } from "@/lib/format";
import { fundingBreakdown, type FundingRow } from "@/lib/funding";
import type { Project } from "@/lib/types";

function takeawayFor(projects: Project[], b: ReturnType<typeof fundingBreakdown>): string {
  if (projects.length === 0) return "No projects match the current filters.";
  if (b.disclosed === 0) return `${b.researched} of ${projects.length} projects were researched for funding and none has a disclosed funding type.`;
  const top = b.rows[0];
  return `${b.disclosed} of ${projects.length} projects have a disclosed funding type; ${top.bucket} is the most common with ${top.count} (${fmtPct(top.share)} of those disclosed).`;
}

/**
 * Projects per disclosed funding type. The two "no information" states are a sentence under the chart, not bars
 * (standard section 9). A bar or a legend entry opens that type's pop-up; filtering is a separate action inside it.
 */
export function FundingTypeBreakdown({ projects, onSelect, className }: { projects: Project[]; onSelect: (bucket: string) => void; className?: string }) {
  const b = useMemo(() => fundingBreakdown(projects), [projects]);
  const multi = useMemo(() => projects.filter((p) => p.fundingTypes.length > 1).length, [projects]);

  return (
    <ChartCard
      className={className}
      id="funding-type"
      title="Funding type"
      takeaway={takeawayFor(projects, b)}
      info={`Projects per funding type from the Funding Type column of the research sheet, counting only projects with a disclosed type. A project with two types (for example "VC-backed; Token-funded") counts once in each bar${multi ? `; ${multi} projects do` : ""}. Rare types fold into Other. Projects never checked (Not researched) and projects checked with nothing found (Not disclosed) are counted in the line under the chart. Click a bar or a legend entry to open that type's projects and rounds.`}
      source="Research CSV, Funding Type column"
      table={{
        columns: [
          { key: "bucket", label: "Funding type" },
          { key: "count", label: "Projects", align: "right" },
          { key: "share", label: "Share of disclosed", align: "right", format: (v) => fmtPct(v as number | null) },
        ],
        rows: b.rows.map(({ bucket, count, share }) => ({ bucket, count, share })),
        filename: "funding-type.csv",
        caption: "Projects per disclosed funding type",
      }}
      footer={projects.length ? <span data-testid="funding-coverage">{b.sentence}.</span> : undefined}
    >
      {(frame: ChartFrame) =>
        b.rows.length === 0 ? (
          <EmptyState message={projects.length ? "No project in the selection has a disclosed funding type." : undefined} />
        ) : (
          <div>
            <OneLineAxis labels={b.rows.map((r) => r.bucket)} className="w-full" style={{ height: frameHeight(frame, Math.max(160, b.rows.length * 32 + 16), Math.max(320, b.rows.length * 48 + 16)) }}>
              {(axis) => (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={b.rows}
                  layout="vertical"
                  margin={{ top: 4, right: 44, bottom: 4, left: 4 }}
                  barCategoryGap={6}
                  onClick={(s) => {
                    const i = s?.activeIndex;
                    const r = i === null || i === undefined ? undefined : b.rows[Number(i)];
                    if (r) onSelect(r.bucket);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <CartesianGrid horizontal={false} stroke="var(--grid)" />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={10} />
                  <YAxis type="category" dataKey="bucket" width={axis.width} tickLine={false} axisLine={false} interval={0} tick={axis.tick} />
                  <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} content={<FundingTip />} wrapperStyle={{ zIndex: 10 }} allowEscapeViewBox={{ x: false, y: false }} />
                  <Bar dataKey="count" name="Projects" radius={[0, 3, 3, 0]} isAnimationActive={false} maxBarSize={18}>
                    {b.rows.map((r) => (
                      <Cell key={r.bucket} fill={r.color} />
                    ))}
                    <LabelList dataKey="count" position="right" fontSize={10} fill="var(--ink-secondary)" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              )}
            </OneLineAxis>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-300">
              {b.rows.map((r) => (
                <li key={r.bucket}>
                  <button
                    type="button"
                    onClick={() => onSelect(r.bucket)}
                    title={`Open ${r.bucket}`}
                    className="inline-flex items-center gap-1.5 rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60"
                  >
                    <span aria-hidden="true" className="inline-block size-2.5 rounded-[2px]" style={{ backgroundColor: r.color }} />
                    {r.bucket} <span className="tabular">{r.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      }
    </ChartCard>
  );
}

function FundingTip({ active, payload }: TipProps<FundingRow>) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipFrame title={d.bucket}>
      <TooltipRow label="Projects" value={`${d.count} (${fmtPct(d.share)} of disclosed)`} color={d.color} />
      <div className="pt-1 text-ink-300">Click to open its projects and rounds</div>
    </TooltipFrame>
  );
}
