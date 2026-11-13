import { ChevronRight } from "lucide-react";
import type { ChartMethod, QuerySpec } from "@/lib/query-specs";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<QuerySpec["kind"], string> = { sql: "BigQuery SQL", http: "API call", transform: "Transform" };

/** The exact SQL, API calls and transforms behind a chart, each under its file path or endpoint. */
export function QueryList({ queries }: { queries: QuerySpec[] }) {
  return (
    <div className="space-y-3">
      {queries.map((q, i) => (
        <div key={i}>
          <div className="mb-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-300">
            <span className="font-mono text-label uppercase">{KIND_LABEL[q.kind]}</span>
            <span className="font-mono break-all text-ink-50">{q.title}</span>
          </div>
          <pre className="max-h-80 overflow-auto rounded-lg border border-ink-700/40 bg-ink-950/60 p-3 font-mono text-[11px] leading-relaxed text-ink-50">
            <code>{q.code}</code>
          </pre>
        </div>
      ))}
    </div>
  );
}

/**
 * "How this is calculated" (thesis track): a collapsed block under the chart with one plain sentence on what
 * the chart shows and the queries behind it. Collapsed by default so the card face stays the chart.
 */
export function HowCalculated({ method, className }: { method: ChartMethod; className?: string }) {
  return (
    <details className={cn("group rounded-lg border border-ink-700/40 text-sm", className)} data-how-calculated>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs text-ink-300 select-none hover:text-ink-50 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
        How this is calculated
      </summary>
      <div className="space-y-3 border-t border-ink-700/40 px-3 py-3">
        <p className="text-sm text-ink-50">{method.sentence}</p>
        <QueryList queries={method.queries} />
      </div>
    </details>
  );
}
