"use client";

import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { DataTable, makeColumnHelper, type AnyColumnDef } from "@/components/explorer/data-table";
import { ClampedText } from "@/components/ui/clamped-text";
import { NONE } from "@/lib/coverage";
import { displayUrl, fmtEventDate, fmtUsd, fmtUsdFull } from "@/lib/format";
import type { EcosystemEvent } from "@/lib/types";

export interface IncidentSummary {
  count: number;
  statedCount: number;
  statedTotal: number;
  largest: EcosystemEvent | null;
  first: EcosystemEvent | null;
  last: EcosystemEvent | null;
}

/** Figures the card's takeaway is built from; everything comes from the events passed in. */
export function summariseIncidents(events: EcosystemEvent[]): IncidentSummary {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const stated = sorted.filter((e) => e.amount !== null && e.amount > 0);
  let largest: EcosystemEvent | null = null;
  for (const e of stated) if (!largest || (e.amount ?? 0) > (largest.amount ?? 0)) largest = e;
  return {
    count: sorted.length,
    statedCount: stated.length,
    statedTotal: stated.reduce((s, e) => s + (e.amount ?? 0), 0),
    largest,
    first: sorted[0] ?? null,
    last: sorted[sorted.length - 1] ?? null,
  };
}

interface IncidentRow {
  id: string;
  date: string;
  dateLabel: string;
  title: string;
  detail: string | null;
  amount: number | undefined;
  amountNote: string | null;
  projects: string;
  sourceUrl: string | null;
}

const h = makeColumnHelper<IncidentRow>();

const columns: AnyColumnDef<IncidentRow>[] = [
  h.accessor("date", { header: "Date", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.dateLabel}</span> }),
  h.accessor("title", { header: "Event", cell: ({ getValue }) => <ClampedText text={getValue()} maxWidth="max-w-xs" threshold={90} className="font-medium" /> }),
  h.accessor((r) => r.detail ?? undefined, {
    id: "detail",
    header: "What happened",
    sortUndefined: "last",
    cell: ({ getValue }) => {
      const v = getValue();
      return v ? <ClampedText text={v} maxWidth="max-w-md" /> : <span className="text-ink-300">{NONE}</span>;
    },
  }),
  h.accessor("amount", {
    header: "Amount (USD)",
    sortUndefined: "last",
    cell: ({ row }) => {
      const r = row.original;
      return r.amount === undefined ? (
        <span className="text-ink-300">not stated</span>
      ) : (
        <span title={`${fmtUsdFull(r.amount)}${r.amountNote ? `, ${r.amountNote}` : ""}`}>{fmtUsd(r.amount)}</span>
      );
    },
    meta: { align: "right" },
  }),
  h.accessor((r) => r.amountNote ?? undefined, { id: "amountNote", header: "Amount note", sortUndefined: "last", cell: ({ getValue }) => (getValue() ? <ClampedText text={getValue() as string} maxWidth="max-w-[14rem]" threshold={70} /> : <span className="text-ink-300">{NONE}</span>), meta: { hideBelow: "lg" } }),
  h.accessor("projects", { header: "Projects", cell: ({ getValue }) => (getValue() ? <ClampedText text={getValue()} maxWidth="max-w-[12rem]" threshold={60} /> : <span className="text-ink-300">{NONE}</span>), meta: { hideBelow: "md" } }),
  h.accessor((r) => r.sourceUrl ?? undefined, {
    id: "source",
    header: "Source",
    sortUndefined: "last",
    cell: ({ getValue }) => {
      const v = getValue();
      return v ? (
        <a href={v} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60" title={displayUrl(v)}>
          source <ExternalLink className="size-3 text-ink-300" />
        </a>
      ) : (
        <span className="text-ink-300">{NONE}</span>
      );
    },
  }),
];

/** Incidents as a sortable table, newest first, in the wording of the research events file (standard section 10). */
export function IncidentsTable({ events }: { events: EcosystemEvent[] }) {
  const rows = useMemo<IncidentRow[]>(
    () =>
      events.map((e) => ({
        id: e.id,
        date: e.date,
        dateLabel: fmtEventDate(e.date, e.monthOnly),
        title: e.title,
        detail: e.detail,
        amount: e.amount ?? undefined,
        amountNote: e.amountNote,
        projects: e.projects.join(", "),
        sourceUrl: e.sourceUrl,
      })),
    [events],
  );
  return <DataTable data={rows} columns={columns} initialSorting={[{ id: "date", desc: true }]} pageSize={25} dense getRowId={(r) => r.id} emptyMessage="No incidents recorded." />;
}
