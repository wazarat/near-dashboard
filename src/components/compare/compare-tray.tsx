"use client";

import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CAT } from "@/lib/colors";
import { useCompare } from "@/lib/compare";
import { filterParsers, useFilters } from "@/lib/filters";

/** Link to the compare page carrying the selection plus any non-default compare metric, range, scale and legacy switch. */
export function compareHref(ids: readonly string[], state: { cm: string; range: string; scale: string; legacy?: string }): string {
  const parts = [`compare=${ids.join(",")}`];
  if (state.cm !== filterParsers.cm.defaultValue) parts.push(`cm=${state.cm}`);
  if (state.range !== filterParsers.range.defaultValue) parts.push(`range=${state.range}`);
  if (state.scale !== filterParsers.scale.defaultValue) parts.push(`scale=${state.scale}`);
  if (state.legacy && state.legacy !== filterParsers.legacy.defaultValue) parts.push(`legacy=${state.legacy}`);
  return `/compare/?${parts.join("&")}`;
}

/** Fixed bottom bar listing the projects picked for comparison. Hidden while the selection is empty. */
export function CompareTray() {
  const { ids, projects, remove, clear } = useCompare();
  const { state } = useFilters();
  if (ids.length === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-700/60 bg-ink-950/80 backdrop-blur-xl" role="region" aria-label="Compare tray" data-testid="compare-tray">
      <div className="mx-auto flex w-full max-w-atlas items-center gap-2 px-5 py-2 sm:px-6 lg:px-8">
        <span className="hidden text-label text-ink-300 sm:inline">Compare</span>
        <ul className="flex min-w-0 flex-1 gap-3 overflow-x-auto" aria-label="Projects in compare">
          {projects.map((p, i) => (
            <li key={p.id} className="inline-flex shrink-0 items-center gap-1.5 text-xs text-ink-100">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: CAT[i] }} />
              <span className="max-w-[9rem] truncate">{p.name}</span>
              <button type="button" onClick={() => remove(p.id)} aria-label={`Remove ${p.name} from compare`} className="rounded text-ink-400 hover:text-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60">
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
