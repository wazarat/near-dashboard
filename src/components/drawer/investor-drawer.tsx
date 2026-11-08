"use client";

import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { ConfidenceTag, investorIdFor } from "@/components/charts/rounds-table";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { investorByIdFn, projectById, rounds } from "@/lib/data";
import { useFilters } from "@/lib/filters";
import { fmtEventDate, fmtUsd, fmtUsdFull } from "@/lib/format";
import type { Investor, Round } from "@/lib/types";

/** Rounds the investor appears in, newest first; undated rounds last. */
export function roundsForInvestor(inv: Investor, all: Round[]): Round[] {
  const ids = new Set(inv.roundIds);
  return all.filter((r) => ids.has(r.id)).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** Whether the investor is named as a lead on a round, matching ids rather than raw names. */
export function isLead(inv: Investor, r: Round): boolean {
  return r.leadInvestors.some((n) => investorIdFor(n) === inv.id);
}

/**
 * Opens from ?investor=<id>. Mounted before ProjectDrawer in the shell so a
 * project opened from here stacks on top of this sheet.
 */
export function InvestorDrawer() {
  const { state, openInvestor, openProject } = useFilters();
  const inv = investorByIdFn(state.investor);
  const mine = useMemo(() => (inv ? roundsForInvestor(inv, rounds) : []), [inv]);
  const leadCount = inv ? mine.filter((r) => isLead(inv, r)).length : 0;

  return (
    <Sheet open={Boolean(inv)} onOpenChange={(o) => !o && openInvestor(null)}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {inv && (
          <>
            <SheetHeader className="pb-2">
              <SheetTitle className="text-xl">{inv.name}</SheetTitle>
              <SheetDescription>
                {inv.deals} {inv.deals === 1 ? "deal" : "deals"} · led {leadCount} · {inv.disclosedDeals > 0 ? <span title={fmtUsdFull(inv.totalDisclosed)}>{fmtUsd(inv.totalDisclosed)} disclosed across {inv.disclosedDeals === inv.deals ? "all of them" : `${inv.disclosedDeals} of them`}</span> : "no disclosed amounts"} · {inv.nearRelatedDeals} of {inv.deals} NEAR related
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-8">
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Portfolio ({inv.projects.length})</h4>
                <ul className="flex flex-wrap gap-1.5">
                  {inv.projects.map((name, i) => {
                    const known = projectById(inv.projectIds[i]);
                    return (
                      <li key={`${name}-${i}`}>
                        {known ? (
                          <button type="button" onClick={() => openProject(known.id)} className="text-xs text-ink-100 underline-offset-2 hover:text-ink-50 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60">
                            {name}
                          </button>
                        ) : (
                          <span className="text-xs text-ink-400" title="No project row in the Atlas">
                            {name}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              <Separator />

              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rounds ({mine.length})</h4>
                {mine.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No rounds found for this investor.</p>
                ) : (
                  <ul className="divide-y rounded-md border text-sm">
                    {mine.map((r) => {
                      const lead = isLead(inv, r);
                      return (
                        <li key={r.id} className={`space-y-0.5 px-3 py-2 ${r.sourced ? "" : "text-muted-foreground"}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="min-w-0 font-medium">
                              {r.projectId && projectById(r.projectId) ? (
                                <button type="button" onClick={() => openProject(r.projectId as string)} className="underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                  {r.project}
                                </button>
                              ) : (
                                <span title="No project row in the Atlas">{r.project}</span>
                              )}
                              <span className="text-muted-foreground"> · {r.roundType}</span>
                            </span>
                            <span className="tabular shrink-0 text-muted-foreground" title={r.amount !== null ? `${fmtUsdFull(r.amount)}${r.amountNote ? ` · ${r.amountNote}` : ""}` : (r.amountNote ?? "No amount in the source")}>
                              {r.amount !== null ? fmtUsd(r.amount) : "undisclosed"}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{r.date ? fmtEventDate(r.date, r.monthOnly) : "undated"}</span>
                            <span className={`font-mono text-label ${lead ? "text-ink-200" : "text-ink-500"}`}>{lead ? "lead" : "other"}</span>
                            {r.nearRelated.startsWith("Yes") ? <span title={r.nearRelated}>◆ NEAR</span> : <span title={r.nearRelated}>partial</span>}
                            {r.confidence !== "Sourced" && <ConfidenceTag confidence={r.confidence} />}
                            {r.sourceUrl && (
                              <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline" aria-label={`Source for ${r.project} ${r.roundType}`}>
                                source <ExternalLink className="size-3" />
                              </a>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">Amounts are the whole round, not this investor&apos;s share. Rounds without a linked primary source are muted and carry a re-verify tag.</p>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
