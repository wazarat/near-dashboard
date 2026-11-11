"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PlainState } from "@/components/ui/plain-state";
import { newlyDetected } from "@/lib/data";
import { fmtDate, fmtUsd } from "@/lib/format";
import type { NewlyDetected } from "@/lib/history-types";

const SOURCE_LABEL: Record<NewlyDetected["source"], string> = { defillama: "DefiLlama", catalog: "NEAR Catalog" };
const SHOW = 12;

/** Review list of protocols the live sources know about but the research CSVs do not. Renders nothing while the list is empty. */
export function NewlyDetectedCard() {
  const [showAll, setShowAll] = useState(false);
  const items = newlyDetected.items;
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => (b.tvl ?? -1) - (a.tvl ?? -1) || a.name.localeCompare(b.name));
  const shown = showAll ? sorted : sorted.slice(0, SHOW);

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <h3 className="text-sm font-semibold">Newly detected ({items.length})</h3>
        <p className="text-sm text-ink-300">Protocols seen on DefiLlama or NEAR Catalog that are not in the research CSVs. Review candidates only; nothing is added automatically.</p>
      </CardHeader>
      <CardContent className="px-4">
        <ul className="divide-y text-sm">
          {shown.map((i) => (
            <li key={`${i.source}-${i.slug}`} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <a href={i.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="truncate">{i.name}</span>
                  <ExternalLink className="size-3 shrink-0 text-ink-300" />
                </a>
                <PlainState proof={SOURCE_LABEL[i.source]}>from</PlainState>
                <span className="text-xs text-ink-300">{i.category}</span>
                <span className="text-xs text-ink-300">{i.chain}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3 text-xs text-ink-300">
                <span className="tabular">{i.tvl === null ? "no TVL" : fmtUsd(i.tvl)}</span>
                <span className="whitespace-nowrap">first seen {fmtDate(i.firstSeen)}</span>
              </span>
            </li>
          ))}
        </ul>
        {items.length > SHOW && (
          <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show fewer" : `Show all ${items.length}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
