"use client";

import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EVENT_COLOR } from "@/lib/colors";
import { events, projectById } from "@/lib/data";
import { displayUrl, fmtEventDate, fmtUsd, fmtUsdFull } from "@/lib/format";
import type { EcosystemEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Title fragments that pick the headline capital events out of the events file.
 * Matching is case-insensitive; a fragment that matches nothing simply yields no card.
 */
const KEYWORDS = ["800M", "Proximity Labs launches", "Aurora launches 90M", "AI agent fund", "Aurora DAO grants 25M", "Aurora DAO approves 25M", "120M USD PIPE", "Bitwise NEAR ETF (NRR) begins trading"] as const;

export function pickMoneyEvents(all: EcosystemEvent[]): EcosystemEvent[] {
  const seen = new Set<string>();
  const out: EcosystemEvent[] = [];
  for (const kw of KEYWORDS) {
    const needle = kw.toLowerCase();
    const hit = all.find((e) => e.title.toLowerCase().includes(needle));
    if (hit && !seen.has(hit.id)) {
      seen.add(hit.id);
      out.push(hit);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function MoneyCards({ className, onOpenProject }: { className?: string; onOpenProject?: (id: string) => void }) {
  const picked = useMemo(() => pickMoneyEvents(events), []);
  const stated = picked.filter((e) => e.amount !== null);
  const total = stated.reduce((a, e) => a + (e.amount as number), 0);

  return (
    <Card className={cn("gap-3 py-4", className)} data-chart-card="Ecosystem capital">
      <CardHeader className="px-4">
        <h3 className="text-sm font-semibold">Ecosystem capital</h3>
        <p className="text-sm text-ink-300">
          Headline funds, grant programmes, treasuries and listings from the events file; not affected by the project filters.{" "}
          {picked.length > 0 && (
            <>
              {stated.length} of {picked.length} carry a USD figure, <span title={fmtUsdFull(total)}>{fmtUsd(total)}</span> in all; the rest state a token amount or none.
            </>
          )}
        </p>
      </CardHeader>
      <CardContent className="px-4">
        {picked.length === 0 ? (
          <p className="text-sm text-ink-300">No matching events in the file.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {picked.map((e) => (
              <li key={e.id} className="flex flex-col rounded-md border p-3 text-sm">
                <div className="flex items-start justify-between gap-2 text-xs text-ink-300">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: EVENT_COLOR[e.type] }} />
                    {e.type} · {fmtEventDate(e.date, e.monthOnly)}
                  </span>
                  <span className={cn("tabular shrink-0 text-right font-semibold", e.amount === null ? "text-ink-300" : "text-foreground")} title={e.amount !== null ? fmtUsdFull(e.amount) : undefined}>
                    {e.amount !== null ? fmtUsd(e.amount) : (e.amountNote ?? "no USD figure")}
                  </span>
                </div>
                <div className="mt-1 font-medium leading-snug">{e.title}</div>
                {e.detail && <p className="mt-1 text-xs text-ink-300">{e.detail}</p>}
                {e.amount !== null && e.amountNote && <p className="mt-1 text-xs text-ink-300">{e.amountNote}</p>}
                {(e.projectIds.length > 0 || e.sourceUrl) && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {onOpenProject &&
                      e.projectIds.map((id) => {
                        const p = projectById(id);
                        return p ? (
                          <button key={id} type="button" onClick={() => onOpenProject(id)} className="rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            {p.name}
                          </button>
                        ) : null;
                      })}
                    {e.sourceUrl && (
                      <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink-300 underline-offset-2 hover:underline" aria-label={`Source for ${e.title}`}>
                        {displayUrl(e.sourceUrl).split("/")[0]} <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
