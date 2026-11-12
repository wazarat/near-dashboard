"use client";

import { ExternalLink, Filter } from "lucide-react";
import { useMemo } from "react";
import { AtlasModal } from "@/components/atlas/atlas-modal";
import { ScopeNote } from "@/components/atlas/chart-card";
import { LoginPanel } from "@/components/auth/login-dialog";
import { roundColumns } from "@/components/charts/rounds-table";
import { DataTable, makeColumnHelper, type AnyColumnDef } from "@/components/explorer/data-table";
import { Button } from "@/components/ui/button";
import { ClampedText } from "@/components/ui/clamped-text";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAccess } from "@/lib/access";
import { fundingColor } from "@/lib/colors";
import { NONE } from "@/lib/coverage";
import { projects as allProjects, rounds as allRounds } from "@/lib/data";
import { useFilters } from "@/lib/filters";
import { displayUrl, fmtEventDate, fmtPct, fmtUsd, fmtUsdFull } from "@/lib/format";
import { fundingBreakdown, isFundingBucket, projectsInBucket, typesInBucket } from "@/lib/funding";
import type { Project, Round } from "@/lib/types";

type Row = Project & { latest: Round | null };
const h = makeColumnHelper<Row>();

/** The Funding Source URL column also holds "N/A" and notes, so only a plain web address becomes a link. */
const isWebUrl = (v: string | undefined): v is string => typeof v === "string" && /^https?:\/\/\S+$/.test(v);

/** The newest dated round of a project, from the rounds file. */
function latestRound(rounds: Round[], projectId: string): Round | null {
  let best: Round | null = null;
  for (const r of rounds) if (r.projectId === projectId && r.date && (!best || r.date > (best.date as string))) best = r;
  return best;
}

function projectColumns(onOpenProject: (id: string) => void): AnyColumnDef<Row>[] {
  return [
    h.accessor("name", {
      header: "Project",
      sortFn: "alphanumeric",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenProject(row.original.id);
          }}
          className="text-left font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.original.name}
        </button>
      ),
    }),
    h.accessor("sector", { header: "Sector", cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue()}</span>, meta: { hideBelow: "sm" } }),
    h.accessor("fundingType", { header: "Funding type", cell: ({ getValue }) => <span className="block max-w-[11rem] whitespace-normal">{getValue()}</span>, meta: { hideBelow: "md" } }),
    h.accessor((p) => p.investors ?? undefined, {
      id: "investors",
      header: "Investors / backers",
      enableSorting: false,
      cell: ({ getValue }) => {
        const v = getValue();
        return v ? <ClampedText text={v} lines={2} maxWidth="max-w-[16rem]" threshold={70} /> : <span className="text-ink-300">{NONE}</span>;
      },
      meta: { hideBelow: "md" },
    }),
    h.accessor((p) => p.amountRaised ?? undefined, {
      id: "amountRaised",
      header: "Amount raised",
      enableSorting: false,
      cell: ({ getValue }) => {
        const v = getValue();
        return v ? <ClampedText text={v} lines={2} maxWidth="max-w-[14rem]" threshold={60} /> : <span className="text-ink-300">undisclosed</span>;
      },
    }),
    h.accessor((p) => p.latest?.date ?? undefined, {
      id: "latestRound",
      header: "Latest round",
      sortUndefined: "last",
      cell: ({ row }) => {
        const r = row.original.latest;
        return r?.date ? <span className="whitespace-nowrap">{fmtEventDate(r.date, r.monthOnly)}</span> : <span className="text-ink-300">{NONE}</span>;
      },
      meta: { hideBelow: "sm" },
    }),
    h.accessor((p) => p.fundingSourceUrl ?? undefined, {
      id: "source",
      header: "Source",
      enableSorting: false,
      cell: ({ getValue, row }) => {
        const v = getValue();
        return isWebUrl(v) ? (
          <a href={v} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 whitespace-nowrap underline-offset-2 hover:underline" aria-label={`Funding source for ${row.original.name}`}>
            {displayUrl(v).split("/")[0]} <ExternalLink className="size-3 text-ink-300" />
          </a>
        ) : (
          <span className="text-ink-300">{NONE}</span>
        );
      },
      meta: { hideBelow: "lg" },
    }),
  ];
}

/**
 * One funding type as a centred modal (docs/ATLAS-UI.md, sections 3 and 9), opened by
 * ?fundingType=<type> from a bar or a legend entry of the funding type chart. It lists the
 * projects that bar counts and the rounds recorded for them, and follows the active filters
 * like the chart does. It never filters the page on its own; "Filter the atlas to this type"
 * is the separate action. Opening a project from here replaces this modal.
 */
export function FundingTypeModal() {
  const { state, setState, openFundingType, openInvestor, projectsFor, legacyOn } = useFilters();
  // The pop-up lists what its bar counts, so it follows the funding type card's legacy switch.
  const filtered = projectsFor("funding-type");
  const legacy = legacyOn("funding-type");
  // Logged out, a shared link shows the title and the summary line; the lists sit behind one login panel.
  const full = useAccess().can({ action: "funding-detail" });
  const everyMember = useMemo(() => (isFundingBucket(state.fundingType) ? projectsInBucket(allProjects, state.fundingType) : []), [state.fundingType]);
  const bucket = everyMember.length > 0 ? state.fundingType : null;
  const inBucket = everyMember.length;
  // The same rounds count before the page filters, for the table's "Showing X of N" line.
  const allBucketRounds = useMemo(() => {
    const ids = new Set(everyMember.map((p) => p.id));
    return allRounds.filter((r) => r.projectId !== null && ids.has(r.projectId)).length;
  }, [everyMember]);
  const members = useMemo(() => (bucket ? projectsInBucket(filtered, bucket) : []), [bucket, filtered]);
  const rounds = useMemo(() => {
    const ids = new Set(members.map((p) => p.id));
    return allRounds.filter((r) => r.projectId !== null && ids.has(r.projectId));
  }, [members]);
  const rows = useMemo<Row[]>(() => members.map((p) => ({ ...p, latest: latestRound(rounds, p.id) })), [members, rounds]);
  const disclosed = useMemo(() => fundingBreakdown(filtered).disclosed, [filtered]);
  const withAmount = rounds.filter((r) => r.amount !== null);
  const total = withAmount.reduce((a, r) => a + (r.amount as number), 0);

  const openProject = (id: string) => void setState({ fundingType: null, project: id });
  const openInvestorFromHere = (id: string) => {
    void setState({ fundingType: null });
    openInvestor(id);
  };
  const projectCols = useMemo(
    () => projectColumns(openProject),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const roundCols = useMemo(
    () => roundColumns(openProject, openInvestorFromHere),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <AtlasModal open={Boolean(bucket)} onOpenChange={(o) => !o && openFundingType(null)} testId="funding-type-modal">
      {bucket && (
        <div className="space-y-5">
          <header className="space-y-2 pr-8">
            <p className="inline-flex items-center gap-1.5 text-label text-ink-300">
              <span aria-hidden="true" className="inline-block size-2.5 rounded-[2px]" style={{ backgroundColor: fundingColor(bucket) }} />
              Funding type
            </p>
            <DialogTitle className="font-display text-title text-ink-50">{bucket}</DialogTitle>
            <DialogDescription data-testid="funding-type-summary">
              {members.length} {members.length === 1 ? "project" : "projects"}
              {disclosed > 0 && `, ${fmtPct(members.length / disclosed)} of the ${disclosed} with a disclosed funding type`}
              {rounds.length === 0 ? (
                ", no rounds recorded for them"
              ) : (
                <>
                  {`, ${rounds.length} ${rounds.length === 1 ? "round" : "rounds"} recorded for them`}
                  {withAmount.length > 0 && (
                    <>
                      {", "}
                      <span title={fmtUsdFull(total)}>{fmtUsd(total)}</span> disclosed across {withAmount.length === rounds.length ? "all of them" : `${withAmount.length} of them`}
                    </>
                  )}
                </>
              )}
            </DialogDescription>
            <ScopeNote className="block" legacy={legacy} />
            <p className="text-sm text-ink-300">A project with two funding types is listed under each of them.</p>
          </header>
          {!full && <LoginPanel trigger="funding" />}
          {full && (
            <>
              <div>
                <Button variant="outline" size="sm" onClick={() => void setState({ fundingType: null, funding: typesInBucket(allProjects, bucket) })}>
                  <Filter /> Filter the atlas to this type
                </Button>
              </div>
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-300">Projects</h4>
                <div className="-mx-4 sm:-mx-6">
                  <DataTable
                    data={rows}
                    columns={projectCols}
                    initialSorting={[{ id: "latestRound", desc: true }]}
                    pageSize={15}
                    dense
                    getRowId={(p) => p.id}
                    showing={{ total: inBucket, noun: "projects of this type" }}
                    onRowClick={(p) => openProject(p.id)}
                    emptyMessage="No project of this type matches the current filters."
                  />
                </div>
              </section>
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-300">Rounds</h4>
                {rounds.length === 0 ? (
                  <p className="text-sm text-ink-300">No rounds recorded for these projects.</p>
                ) : (
                  <div className="-mx-4 sm:-mx-6">
                    <DataTable data={rounds} columns={roundCols} initialSorting={[{ id: "date", desc: true }]} pageSize={10} dense getRowId={(r) => r.id} showing={{ total: allBucketRounds, noun: "rounds for this type" }} rowClassName={(r) => (r.sourced ? undefined : "text-ink-300")} />
                  </div>
                )}
                <p className="text-xs text-ink-300">Amounts are the whole round. Rounds without a linked primary source are muted and carry a re-verify tag.</p>
              </section>
            </>
          )}
        </div>
      )}
    </AtlasModal>
  );
}
