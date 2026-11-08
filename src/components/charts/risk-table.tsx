"use client";

import { NONE } from "@/lib/coverage";
import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { DataTable, projectColumnHelper as h, type ProjectColumnDef } from "@/components/explorer/data-table";
import { chainColumn, nameColumn, riskColumn, tierColumn } from "@/components/explorer/project-columns";
import type { Project, RiskLevel } from "@/lib/types";

const RISK_RANK: Record<RiskLevel, number> = { High: 0, Medium: 1, Low: 2, Unknown: 3, "Not researched": 4 };

/** High before Medium, then TVL descending with blank TVL last, then name. */
export function sortByRisk(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    const r = RISK_RANK[a.risk] - RISK_RANK[b.risk];
    if (r !== 0) return r;
    const at = a.tvl ?? -1;
    const bt = b.tvl ?? -1;
    if (at !== bt) return bt - at;
    return a.name.localeCompare(b.name);
  });
}

function Wrapped({ v }: { v: string | undefined }) {
  return v ? <span className="block max-w-sm whitespace-normal text-xs leading-snug">{v}</span> : <span className="text-ink-400">{NONE}</span>;
}

const auditsText = h.accessor((p) => p.audits ?? undefined, { id: "audits", header: "Audits", sortUndefined: "last", cell: ({ getValue }) => <Wrapped v={getValue()} /> });
const incidentsText = h.accessor((p) => p.incidents ?? undefined, { id: "incidents", header: "Incidents", sortUndefined: "last", cell: ({ getValue }) => <Wrapped v={getValue()} /> });
const redFlagsText = h.accessor((p) => p.redFlags ?? undefined, { id: "redFlags", header: "Red flags", sortUndefined: "last", cell: ({ getValue }) => <Wrapped v={getValue()} /> });
const sourceColumn = h.accessor((p) => p.securitySourceUrl ?? undefined, {
  id: "securitySource",
  header: "Source",
  sortUndefined: "last",
  cell: ({ getValue }) => {
    const v = getValue();
    return v ? (
      <a href={v} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 whitespace-nowrap underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        source <ExternalLink className="size-3 text-muted-foreground" />
      </a>
    ) : (
      <span className="text-ink-400">{NONE}</span>
    );
  },
});

export function RiskTable({ projects, onOpen }: { projects: Project[]; onOpen: (id: string) => void }) {
  const columns = useMemo<ProjectColumnDef[]>(() => [nameColumn(onOpen), chainColumn, tierColumn, riskColumn, auditsText, incidentsText, redFlagsText, sourceColumn], [onOpen]);
  const data = useMemo(() => sortByRisk(projects), [projects]);
  return <DataTable data={data} columns={columns} pageSize={25} dense onRowClick={(p) => onOpen(p.id)} emptyMessage="No High or Medium risk projects in this selection." />;
}
