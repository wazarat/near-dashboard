"use client";

import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { AtlasModal } from "@/components/atlas/atlas-modal";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EVENT_COLOR } from "@/lib/colors";
import { NONE } from "@/lib/coverage";
import { events, projectById } from "@/lib/data";
import { useFilters } from "@/lib/filters";
import { displayUrl, fmtEventDate, fmtUsdFull } from "@/lib/format";
import type { Project } from "@/lib/types";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 text-sm">
      <dt className="text-ink-300">{label}</dt>
      <dd className="min-w-0 break-words text-ink-50">{children}</dd>
    </div>
  );
}

/**
 * Everything recorded about one timeline event (docs/ATLAS-UI.md, section 8): the amount, what it
 * measures, the detail and the source. Opened by ?event=<id> from a timeline table row or chart
 * marker, an Ecosystem capital card or a project's Events list. Every recorded source link is
 * offered as it is; this atlas does not apply the direct-sources rule. The timeline is on the
 * public Overview, so the pop-up is open to every reader.
 */
export function EventModal() {
  const { state, setState, openEvent } = useFilters();
  const ev = state.event ? events.find((e) => e.id === state.event) : undefined;
  // The names are as the events file gives them; the ids are only the ones that resolve to an atlas project, so the two lists do not line up one to one.
  const linked = (ev?.projectIds ?? []).map((id) => projectById(id)).filter((p): p is Project => Boolean(p));
  // When every recorded name is an atlas project under the same name, one row of links says it all.
  const sameList = linked.length > 0 && linked.length === (ev?.projects.length ?? 0) && linked.every((p, i) => p.name === ev?.projects[i]);
  // Opening a project from here replaces whatever pop-up is open.
  const openProject = (id: string) => void setState({ event: null, fundingType: null, sectorDrawer: null, investor: null, project: id });

  return (
    <AtlasModal open={Boolean(ev)} onOpenChange={(o) => !o && openEvent(null)} testId="event-modal" width="narrow" className="sm:w-[min(560px,calc(100vw-2rem))]">
      {ev && (
        <div className="space-y-4">
          <header className="space-y-1 pr-8">
            <DialogDescription className="inline-flex items-center gap-1.5 text-label text-ink-300">
              <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ backgroundColor: EVENT_COLOR[ev.type] }} />
              {ev.type}, {fmtEventDate(ev.date, ev.monthOnly)}
            </DialogDescription>
            <DialogTitle className="font-display text-title text-ink-50">{ev.title}</DialogTitle>
          </header>
          <dl className="space-y-2">
            {!sameList && <Row label="Projects">{ev.projects.length === 0 ? <span className="text-ink-300">{NONE}</span> : ev.projects.join(", ")}</Row>}
            {linked.length > 0 && (
              <Row label={sameList ? "Projects" : "In the atlas"}>
                {linked.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && ", "}
                    <button type="button" className="underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60" onClick={() => openProject(p.id)}>
                      {p.name}
                    </button>
                  </span>
                ))}
              </Row>
            )}
            <Row label="Amount">{ev.amount === null ? <span className="text-ink-300">no USD figure</span> : <span className="tabular">{fmtUsdFull(ev.amount)}</span>}</Row>
            {ev.amountNote && <Row label="Amount note">{ev.amountNote}</Row>}
            {ev.detail && <Row label="Detail">{ev.detail}</Row>}
            <Row label="Source">
              {ev.sourceUrl ? (
                <a href={ev.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 underline-offset-2 hover:underline" aria-label={`Source for ${ev.title}`}>
                  <span className="break-all">{displayUrl(ev.sourceUrl)}</span>
                  <ExternalLink className="size-3 shrink-0 text-ink-300" />
                </a>
              ) : (
                <span className="text-ink-300">{NONE}</span>
              )}
            </Row>
          </dl>
        </div>
      )}
    </AtlasModal>
  );
}
