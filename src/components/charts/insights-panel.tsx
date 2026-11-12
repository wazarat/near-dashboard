"use client";

import { useMemo } from "react";
import { ScopeNote } from "@/components/atlas/chart-card";
import { LegacySwitch, useLegacyOn } from "@/components/atlas/legacy-switch";
import { MetricSegmented } from "@/components/atlas/chart-metric";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { memoInsights } from "@/lib/data";
import { useActiveFilterCount } from "@/lib/filters";
import { generateInsights } from "@/lib/insights";
import type { MemoInsight, MetricKey, Project } from "@/lib/types";

const MEMO_LABEL = "From the Nov 8, 2026 research memo";

/** The memo text repeats its title as the first sentence; drop it when it does. */
function memoBody(m: MemoInsight): string {
  const t = m.text.trim();
  const prefix = `${m.title}.`;
  return t.startsWith(prefix) ? t.slice(prefix.length).trim() : t;
}

export function InsightsPanel({ projects, metric, onMetricChange, total }: { projects: Project[]; metric: MetricKey; onMetricChange: (m: MetricKey) => void; total: number }) {
  const live = useMemo(() => generateInsights(projects, metric), [projects, metric]);
  // "Full dataset" means no search or facet is set; legacy listings are a card switch, not a filter.
  const filteredView = useActiveFilterCount() > 0 || projects.length > total;
  const legacy = useLegacyOn("insights");

  return (
    <Card className="gap-3 py-4" data-chart-card="Insights">
      <CardHeader className="gap-1 px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h3 className="text-sm font-semibold leading-tight">Insights</h3>
            <ScopeNote legacy={legacy} />
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <LegacySwitch card="insights" label="Insights" />
            <MetricSegmented value={metric} onChange={onMetricChange} ariaLabel="Insights metric" />
          </span>
        </div>
        <p className="text-sm text-ink-300">Live sentences are recomputed from the {filteredView ? "current selection" : "full dataset"} for the chosen metric; analyst notes are fixed.</p>
      </CardHeader>
      <CardContent className="px-4">
        <Tabs defaultValue="live">
          <TabsList className="h-8">
            <TabsTrigger value="live" className="h-6 px-2 text-xs">
              Live insights
            </TabsTrigger>
            <TabsTrigger value="memo" className="h-6 px-2 text-xs">
              Analyst notes <span className="tabular text-ink-300">{memoInsights.length}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="live">
            <ul className="space-y-2 text-sm" aria-label="Live insights">
              {live.map((i) => (
                <li key={i.id} className="flex gap-2">
                  <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ink-400" />
                  <span>{i.text}</span>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="memo">
            <p className="mb-2 text-xs text-ink-300">{MEMO_LABEL}. Figures in these notes are as written in the memo and do not follow the filters.</p>
            <ol className="max-h-[420px] space-y-2 overflow-y-auto pr-1 text-sm" aria-label="Analyst notes">
              {memoInsights.map((m) => (
                <li key={m.n} className="flex gap-2">
                  <span className="tabular w-5 shrink-0 text-ink-300">{m.n}.</span>
                  <span>
                    <span className="font-medium">{m.title}.</span> {memoBody(m)}
                  </span>
                </li>
              ))}
            </ol>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
