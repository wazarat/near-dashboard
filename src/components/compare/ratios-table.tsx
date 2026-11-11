"use client";

import { NotTracked } from "@/components/atlas/not-tracked";
import { useMemo } from "react";
import { ChartCard, EmptyState } from "@/components/atlas/chart-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CAT } from "@/lib/colors";
import { compareRatios, type RatioRow } from "@/lib/compare";
import type { MetricKey, Project } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ratiosTakeaway(rows: RatioRow[], projects: Project[]): string {
  if (projects.length < 2) return "Add a second project to compare efficiency without size getting in the way.";
  const fees = rows.find((r) => r.key === "feesPerTvl");
  const bestIdx = fees ? fees.best.findIndex(Boolean) : -1;
  const parts: string[] = [];
  if (fees && bestIdx >= 0) parts.push(`${projects[bestIdx].name} earns the most fees per dollar locked (${fees.format(fees.values[bestIdx])} over 30 days)`);
  const capture = rows.find((r) => r.key === "capture");
  const capIdx = capture ? capture.best.findIndex(Boolean) : -1;
  if (capture && capIdx >= 0) parts.push(`${projects[capIdx].name} keeps the largest share of its fees (${capture.format(capture.values[capIdx])})`);
  if (parts.length === 0) {
    const anyValue = rows.some((r) => r.values.filter((v) => v !== null).length >= 2);
    return anyValue ? "Only one ratio has two or more values; most of these projects lack the fee, TVL or activity figures needed." : "None of these projects report enough figures to compute a shared ratio.";
  }
  return `${parts.join("; ")}.`;
}

interface Props {
  projects: Project[];
  metric: MetricKey;
}

/** Size-independent ratios so a small protocol can be read next to a large one. */
export function RatiosTable({ projects, metric }: Props) {
  const rows = useMemo(() => compareRatios(projects, metric), [projects, metric]);
  const takeaway = useMemo(() => ratiosTakeaway(rows, projects), [rows, projects]);
  return (
    <ChartCard
      scope="selection"
      id="compare-ratios"
      title="Ratios that remove size"
      takeaway={takeaway}
      info="Fees, revenue, volume and TVL from DefiLlama (30-day sums, TVL as the latest level); 30d change from DefiLlama daily history; function calls from BigQuery receipt actions to tracked contracts. A dash means one side of the ratio is missing or zero, never that the ratio is zero."
    >
      {projects.length === 0 ? (
        <EmptyState message="No projects selected." />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table className="text-xs">
            <caption className="sr-only">Size-independent ratios for the compared projects</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="sticky left-0 z-10 min-w-[8.5rem] bg-card pl-3 shadow-[inset_-1px_0_0_var(--border)]">
                  Ratio
                </TableHead>
                {projects.map((p, i) => (
                  <TableHead key={p.id} scope="col" className="min-w-[8rem] text-right">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ backgroundColor: CAT[i] }} />
                      {p.name}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell scope="row" className="sticky left-0 z-10 bg-card pl-3 font-medium shadow-[inset_-1px_0_0_var(--border)]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="cursor-help rounded text-left underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${r.label}. ${r.info}`}>
                          {r.label}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs leading-relaxed">{r.info}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  {r.values.map((v, i) => (
                    <TableCell key={projects[i].id} className={cn("tabular text-right", r.best[i] && "bg-accent font-semibold")}>
                      {v === null ? <NotTracked /> : r.format(v)}
                      {r.best[i] && <span className="ml-1 font-mono text-label text-ink-300">best</span>}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ChartCard>
  );
}
