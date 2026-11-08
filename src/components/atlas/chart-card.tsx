"use client";

import { useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { Segmented } from "@/components/ui/segmented";
import { meta } from "@/lib/data";
import { useActiveFilterCount, type Scale } from "@/lib/filters";
import { cn } from "@/lib/utils";
import { ChartTable, ChartTableToggle, type ChartTableSpec, type ChartView } from "./chart-table";

export interface QuerySpec {
  /** "sql" for BigQuery, "http" for an API call, "transform" for a pure function. */
  kind: "sql" | "http" | "transform";
  title: string;
  code: string;
}

interface ChartCardProps {
  title: string;
  /** One-line takeaway shown above the chart. */
  takeaway: string;
  /** Explains the metric and the source. */
  info: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  scale?: Scale;
  onScaleChange?: (s: Scale) => void;
  footer?: ReactNode;
  id?: string;
  /** When given, a Chart / Table toggle lets readers see the plotted rows. */
  table?: ChartTableSpec;
  /** When given, a Query tab shows the exact SQL, API call and transform behind the chart. */
  queries?: QuerySpec[];
  /**
   * What the card responds to (standard section 4). Filtered cards say how
   * many filters are active; whole-chain and selection cards say they ignore them.
   */
  scope?: ChartScope;
}

export type ChartScope = "filtered" | "whole-chain" | "selection";

const SCALE_OPTIONS = [
  { value: "log" as const, label: "Log" },
  { value: "linear" as const, label: "Linear" },
];

/** One line of plain text under a title that says whether the filters apply. */
export function ScopeNote({ scope = "filtered", className }: { scope?: ChartScope; className?: string }) {
  const active = useActiveFilterCount();
  const text = scope === "whole-chain" ? "Whole chain, not filtered" : scope === "selection" ? "Selected projects only, not filtered" : active > 0 ? `${active} filter${active === 1 ? "" : "s"} active` : null;
  if (!text) return null;
  return (
    <span className={cn("text-label text-ink-400", className)} data-scope={scope}>
      {text}
    </span>
  );
}

export function ChartCard({ title, takeaway, info, children, className, actions, scale, onScaleChange, footer, id, table, queries, scope }: ChartCardProps) {
  const [view, setView] = useState<ChartView>("chart");
  const hasQuery = Boolean(queries && queries.length);
  return (
    <Card id={id} className={cn("gap-3 py-4", className)} data-chart-card={title}>
      <CardHeader className="gap-1 px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="flex items-center gap-1">
                <h3 className="text-sm font-semibold leading-tight">{title}</h3>
                <InfoTip label={`About ${title}`}>{info}</InfoTip>
              </span>
              <ScopeNote scope={scope} />
            </div>
            <p className="mt-1 text-sm text-ink-300">{takeaway}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {actions}
            {scale && onScaleChange && view === "chart" && <Segmented value={scale} onChange={onScaleChange} options={SCALE_OPTIONS} ariaLabel="Axis scale" />}
            {(table || hasQuery) && <ChartTableToggle view={view} onChange={setView} hasQuery={hasQuery} />}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4">
        {view === "table" && table ? <ChartTable spec={table} /> : view === "query" && queries ? <QueryView queries={queries} /> : children}
      </CardContent>
      {footer && <div className="px-4 text-xs text-ink-300">{footer}</div>}
    </Card>
  );
}

function QueryView({ queries }: { queries: QuerySpec[] }) {
  return (
    <div className="space-y-3">
      {queries.map((q, i) => (
        <div key={i}>
          <div className="mb-1 flex items-center gap-2 text-xs text-ink-300">
            <span className="font-mono text-label uppercase text-ink-500">{q.kind}</span>
            <span>{q.title}</span>
          </div>
          <pre className="max-h-80 overflow-auto rounded-lg border border-ink-700/40 bg-ink-950/60 p-3 font-mono text-[11px] leading-relaxed text-ink-100">
            <code>{q.code}</code>
          </pre>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ message = "No projects match the current filters.", className }: { message?: string; className?: string }) {
  return (
    <div role="status" className={cn("flex h-40 items-center justify-center rounded-lg border border-dashed border-ink-700/60 px-4 text-center text-sm text-ink-300", className)}>
      {message}
    </div>
  );
}

export function Legend({ items, className }: { items: { label: string; color: string; shape?: "circle" | "square" | "hatch" | "line" }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-300", className)} aria-label="Legend">
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5">
          {it.shape === "hatch" ? (
            <span aria-hidden="true" className="inline-block size-2.5 rounded-[2px] border border-ink-400/60" style={{ backgroundImage: "repeating-linear-gradient(45deg, var(--ink-muted) 0 1px, transparent 1px 3px)" }} />
          ) : it.shape === "line" ? (
            <span aria-hidden="true" className="inline-block h-0.5 w-3" style={{ backgroundColor: it.color }} />
          ) : (
            <span aria-hidden="true" className={cn("inline-block size-2.5", it.shape === "square" ? "rounded-[2px]" : "rounded-full")} style={{ backgroundColor: it.color }} />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** Shown wherever protocol TVL is summed. */
export function TvlNote() {
  const chain = meta.chainTvl.near;
  return (
    <span>
      Summed protocol TVL double counts liquid staking and bridges. DefiLlama&apos;s default chain TVL, which excludes them, was{" "}
      {chain !== null ? `$${(chain / 1e6).toFixed(1)}M for NEAR and $${((meta.chainTvl.aurora ?? 0) / 1e6).toFixed(1)}M for Aurora` : "$174.9M for NEAR and $3.8M for Aurora on Nov 8, 2026"}. CEX reserves held on NEAR
      (Binance about $522M) are excluded from TVL and shown as an &ldquo;Other traction signal&rdquo;.
    </span>
  );
}

/** Hatch pattern definitions for "Other" fills; render once inside an SVG chart. */
export function HatchDefs({ id = "hatch-other" }: { id?: string }) {
  return (
    <defs>
      <pattern id={id} patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
        <rect width={6} height={6} fill="var(--surface-chart)" />
        <line x1={0} y1={0} x2={0} y2={6} stroke="var(--ink-muted)" strokeWidth={1.5} />
      </pattern>
    </defs>
  );
}
