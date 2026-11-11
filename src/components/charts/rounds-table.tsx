"use client";

import { NONE } from "@/lib/coverage";
import { ExternalLink } from "lucide-react";
import { useId, useMemo } from "react";
import { DataTable, makeColumnHelper, type AnyColumnDef } from "@/components/explorer/data-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { investorByIdFn } from "@/lib/data";
import { fmtEventDate, fmtUsd, fmtUsdFull } from "@/lib/format";
import { slugify } from "@/lib/parse";
import type { Round } from "@/lib/types";
import { cn } from "@/lib/utils";

const h = makeColumnHelper<Round>();

/** Investor ids are the slug of the name without any trailing parenthetical, matching the build step. */
export function investorIdFor(name: string): string {
  return slugify(name.replace(/\s*\(.*?\)\s*$/, "").trim());
}

export function ConfidenceTag({ confidence }: { confidence: string }) {
  const sourced = confidence === "Sourced";
  return (
    <span
      className={cn("whitespace-nowrap font-mono text-label", sourced ? "text-ink-300" : "text-ink-300")}
      title={sourced ? "Backed by the linked source" : "Not fully verified against a primary source; re-verify before quoting"}
    >
      {confidence}
    </span>
  );
}

function InvestorList({ names, onOpen }: { names: string[]; onOpen?: (id: string) => void }) {
  if (names.length === 0) return <span className="text-ink-300">{NONE}</span>;
  return (
    <span className="flex max-w-xs flex-wrap gap-x-1">
      {names.map((n, i) => {
        const id = investorIdFor(n);
        const known = onOpen && investorByIdFn(id);
        return (
          <span key={`${n}-${i}`}>
            {known ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(id);
                }}
                className="rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {n}
              </button>
            ) : (
              n
            )}
            {i < names.length - 1 ? "," : ""}
          </span>
        );
      })}
    </span>
  );
}

export function roundColumns(onOpenProject: (id: string) => void, onOpenInvestor?: (id: string) => void): AnyColumnDef<Round>[] {
  return [
    h.accessor((r) => r.date ?? undefined, {
      id: "date",
      header: "Date",
      cell: ({ row }) => (row.original.date ? <span className="whitespace-nowrap">{fmtEventDate(row.original.date, row.original.monthOnly)}</span> : <span className="text-ink-300">undated</span>),
      sortUndefined: "last",
    }),
    h.accessor("project", {
      header: "Project",
      cell: ({ row }) =>
        row.original.projectId ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenProject(row.original.projectId as string);
            }}
            className="text-left font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {row.original.project}
          </button>
        ) : (
          <span className="font-medium" title="No project row in the Atlas">
            {row.original.project}
          </span>
        ),
      sortFn: "alphanumeric",
    }),
    h.accessor("roundType", { header: "Round", cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue()}</span> }),
    h.accessor((r) => r.amount ?? undefined, {
      id: "amount",
      header: "Amount",
      cell: ({ row }) =>
        row.original.amount === null ? (
          <span className="text-ink-300" title={row.original.amountNote ?? "No amount in the source"}>
            undisclosed
          </span>
        ) : (
          <span title={`${fmtUsdFull(row.original.amount)}${row.original.amountNote ? ` · ${row.original.amountNote}` : ""}`}>{fmtUsd(row.original.amount)}</span>
        ),
      sortUndefined: "last",
      meta: { align: "right" },
    }),
    h.accessor((r) => r.leadInvestors.join(", ") || undefined, {
      id: "lead",
      header: "Lead investors",
      cell: ({ row }) => <InvestorList names={row.original.leadInvestors} onOpen={onOpenInvestor} />,
      sortUndefined: "last",
      meta: { hideBelow: "md" },
    }),
    h.accessor((r) => r.otherInvestors.join(", ") || undefined, {
      id: "others",
      header: "Other investors",
      cell: ({ getValue }) => {
        const v = getValue();
        return v ? (
          <span className="block max-w-xs truncate" title={v}>
            {v}
          </span>
        ) : (
          <span className="text-ink-300">{NONE}</span>
        );
      },
      sortUndefined: "last",
      meta: { hideBelow: "lg" },
    }),
    h.accessor("nearRelated", {
      header: "NEAR related",
      cell: ({ getValue }) => {
        const v = getValue();
        return v.startsWith("Yes") ? (
          <span className="whitespace-nowrap">◆ {v}</span>
        ) : (
          <span className="block max-w-[10rem] truncate text-ink-300" title={v}>
            {v}
          </span>
        );
      },
      meta: { hideBelow: "lg" },
    }),
    h.accessor("confidence", { header: "Confidence", cell: ({ getValue }) => <ConfidenceTag confidence={getValue()} /> }),
    h.accessor((r) => r.sourceUrl ?? undefined, {
      id: "source",
      header: "Source",
      cell: ({ getValue, row }) => {
        const v = getValue();
        return v ? (
          <a href={v} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 whitespace-nowrap underline-offset-2 hover:underline" aria-label={`Source for ${row.original.project} ${row.original.roundType}`}>
            link <ExternalLink className="size-3 text-ink-300" />
          </a>
        ) : (
          <span className="text-ink-300">{NONE}</span>
        );
      },
      sortUndefined: "last",
      meta: { hideBelow: "sm" },
    }),
  ];
}

interface Props {
  /** Every round in the file. */
  rounds: Round[];
  /** Rounds shown after the selection checkbox is applied. */
  visible: Round[];
  onlySelection: boolean;
  onOnlySelectionChange: (v: boolean) => void;
  onOpenProject: (id: string) => void;
  onOpenInvestor?: (id: string) => void;
}

export function RoundsTable({ rounds, visible, onlySelection, onOnlySelectionChange, onOpenProject, onOpenInvestor }: Props) {
  const columns = useMemo(() => roundColumns(onOpenProject, onOpenInvestor), [onOpenProject, onOpenInvestor]);
  const checkboxId = useId();
  const sourced = visible.filter((r) => r.sourced).length;
  const disclosed = visible.filter((r) => r.amount !== null);
  const total = disclosed.reduce((a, r) => a + (r.amount as number), 0);

  return (
    <Card className="gap-3 py-4" data-chart-card="Funding rounds">
      <CardHeader className="px-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-sm font-semibold">
            Funding rounds ({visible.length}
            {onlySelection && visible.length !== rounds.length ? ` of ${rounds.length}` : ""})
          </h3>
          <label htmlFor={checkboxId} className="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-300">
            <Checkbox id={checkboxId} checked={onlySelection} onCheckedChange={(v) => onOnlySelectionChange(v === true)} />
            Only projects in the current selection
          </label>
        </div>
        <p className="text-sm text-ink-300">
          Individual rounds, grants, token sales and strategic cheques from the rounds file. {sourced} of {visible.length} are backed by a linked primary source; the rest are tagged for re-verification and shown muted.{" "}
          {disclosed.length > 0 && (
            <>
              <span title={fmtUsdFull(total)}>{fmtUsd(total)}</span> disclosed across {disclosed.length} round{disclosed.length === 1 ? "" : "s"}; {visible.length - disclosed.length} undisclosed.
            </>
          )}{" "}
          Click a project or a known investor to open it.
        </p>
      </CardHeader>
      <CardContent className="px-0">
        <DataTable
          data={visible}
          columns={columns}
          initialSorting={[{ id: "date", desc: true }]}
          pageSize={25}
          dense
          getRowId={(r) => r.id}
          rowClassName={(r) => (r.sourced ? undefined : "text-ink-300")}
          emptyMessage={onlySelection ? "No rounds for projects in the current selection." : "No funding rounds recorded."}
        />
      </CardContent>
    </Card>
  );
}
