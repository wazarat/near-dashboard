"use client";

import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CAT } from "@/lib/colors";
import { useCompare } from "@/lib/compare";
import { filterParsers, useFilters } from "@/lib/filters";

/** Link to the compare page carrying the selection plus any non-default metric, range and scale. */
export function compareHref(ids: readonly string[], state: { metric: string; range: string; scale: string }): string {
  const parts = [`compare=${ids.join(",")}`];
  if (state.metric !== filterParsers.metric.defaultValue) parts.push(`metric=${state.metric}`);
  if (state.range !== filterParsers.range.defaultValue) parts.push(`range=${state.range}`);
  if (state.scale !== filterParsers.scale.defaultValue) parts.push(`scale=${state.scale}`);
  return `/compare/?${parts.join("&")}`;
}

/** Fixed bottom bar listing the projects picked for comparison. Hidden while the selection is empty. */
export function CompareTray() {
  const { ids, projects, remove, clear } = useCompare();
  const { state } = useFilters();
  if (ids.length === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85" role="region" aria-label="Compare tray" data-testid="compare-tray">
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-2 px-4 py-2 sm:px-6">
        <span className="hidden text-xs text-muted-foreground sm:inline">Compare</span>
        <ul className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto" aria-label="Projects in compare">
          {projects.map((p, i) => (
            <li key={p.id} className="inline-flex shrink-0 items-center gap-1 rounded-md border py-1 pl-2 pr-1 text-xs" style={{ borderLeftWidth: 3, borderLeftColor: CAT[i] }}>
              <span className="max-w-[9rem] truncate">{p.name}</span>
              <button type="button" onClick={() => remove(p.id)} aria-label={`Remove ${p.name} from compare`} className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clear}>
          Clear
        </Button>
        <Button asChild size="sm" className="h-8 gap-1 text-xs">
          <Link href={compareHref(ids, state)}>
            Compare {ids.length} <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
