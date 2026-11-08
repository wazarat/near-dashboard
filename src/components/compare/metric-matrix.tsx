"use client";

import { useMemo } from "react";
import { ChartCard, EmptyState } from "@/components/atlas/chart-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CAT } from "@/lib/colors";
import { compareMatrix, type MatrixRow } from "@/lib/compare";
import { fmtPct } from "@/lib/format";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Short sector name for the rank line, e.g. "DEXs" from "DEXs & Liquidity". */
export function shortSector(sector: string): string {
  return sector.split(/\s*[&,]\s*/)[0] || sector;
}

export function matrixTakeaway(rows: MatrixRow[], projects: Project[]): string {
  if (projects.length < 2) return "Add a second project to see ranks and shares side by side.";
  const wins = projects.map((p, i) => ({ p, n: rows.filter((r) => r.cells[i].best).length }));
  const contested = rows.filter((r) => r.cells.filter((c) => c.value !== null).length >= 2).length;
  if (contested === 0) return "These projects report no metric in common, so no row can be ranked.";
  const top = [...wins].sort((a, b) => b.n - a.n)[0];
  const tied = wins.filter((w) => w.n === top.n);
  const lead = tied.length > 1 ? `${tied.map((w) => w.p.name).join(" and ")} tie with ${top.n} best cell${top.n === 1 ? "" : "s"} each` : `${top.p.name} has the best value in ${top.n} of the ${contested} rows where two or more projects report a figure`;
  const topRank = rows.flatMap((r) => r.cells.map((c, i) => ({ r, c, p: projects[i] }))).filter((x) => x.c.rank === 1 && x.c.of > 1);
  const first = topRank[0];
  return `${lead}.${first ? ` ${first.p.name} ranks #1 of ${first.c.of} in ${shortSector(first.p.sector)} on ${first.r.label.toLowerCase()}.` : ""}`;
}

interface Props {
  projects: Project[];
  all: Project[];
}

/** Raw values with each project's rank and share inside its own sector. The first column stays put while the rest scroll. */
export function MetricMatrix({ projects, all }: Props) {
  const rows = useMemo(() => compareMatrix(projects, all), [projects, all]);
  const takeaway = useMemo(() => matrixTakeaway(rows, projects), [rows, projects]);
  return (
    <ChartCard
      id="compare-matrix"
      title="Metrics, with rank and share in sector"
      takeaway={takeaway}
      info="TVL, volume, fees, revenue, annualised revenue, market cap and P/S come from DefiLlama daily history (or the research snapshot when no history exists); function calls and signers from BigQuery receipt actions to tracked contracts. Rank counts only projects in the same sector that report the metric; share is the project's part of that sector's total. Signers are an estimate because one person can hold many accounts."
    >
      {projects.length === 0 ? (
        <EmptyState message="No projects selected." />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table className="text-xs">
            <caption className="sr-only">Metrics for the compared projects with rank and share inside each project&apos;s sector</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="sticky left-0 z-10 min-w-[8.5rem] bg-card pl-3 shadow-[inset_-1px_0_0_var(--border)]">
                  Metric
                </TableHead>
                {projects.map((p, i) => (
                  <TableHead key={p.id} scope="col" className="min-w-[9.5rem] text-right">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ backgroundColor: CAT[i] }} />
                      {p.name}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell scope="row" className="sticky left-0 z-10 bg-card pl-3 font-medium shadow-[inset_-1px_0_0_var(--border)]">
                    {row.label}
                  </TableCell>
                  {row.cells.map((c, i) => (
                    <TableCell key={projects[i].id} className={cn("tabular text-right align-top", c.best && "bg-accent")}>
                      <div className={cn(c.best && "font-semibold")}>
                        {c.value === null ? <span className="text-muted-foreground">—</span> : row.format(c.value)}
                        {c.best && <span className="ml-1 rounded border px-1 text-[9px] font-medium uppercase tracking-wide">best</span>}
                      </div>
                      {c.value !== null && c.rank !== null && (
                        <div className="text-[11px] font-normal text-muted-foreground">
                          #{c.rank} of {c.of} in {shortSector(projects[i].sector)}
                          {c.share !== null && ` · ${fmtPct(c.share, 1)} of sector`}
                        </div>
                      )}
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
