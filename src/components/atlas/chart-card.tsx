"use client";

import { Maximize2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoTip } from "@/components/ui/info-tip";
import { Segmented } from "@/components/ui/segmented";
import { useAccess } from "@/lib/access";
import { meta } from "@/lib/data";
import { useActiveFilterCount, type LegacyCard, type Scale } from "@/lib/filters";
import { points } from "@/lib/takeaways";
import { cn } from "@/lib/utils";
import { ChartFrameProvider, type ChartFrame } from "./chart-frame";
import { ChartTable, ChartTableToggle, type ChartTableSpec, type ChartView } from "./chart-table";
import { LegacySwitch, useLegacyOn } from "./legacy-switch";
import { TakeawayList } from "./takeaway-list";

export interface QuerySpec {
  /** "sql" for BigQuery, "http" for an API call, "transform" for a pure function. */
  kind: "sql" | "http" | "transform";
  title: string;
  code: string;
}

export type ChartScope = "filtered" | "whole-chain" | "selection";

interface ChartCardProps {
  title: string;
  /** The card's computed summary sentence. */
  takeaway: string;
  /**
   * Where the summary shows (standard section 6). "expanded", the default, keeps the card face to the chart
   * and lists the summary as points in the expanded view. "inline" keeps it on the card as well, for pages
   * whose summaries are the argument (Thesis, NEAR Intents). A card that cannot expand always shows it inline.
   */
  takeawayPlacement?: "expanded" | "inline";
  /** Explains the metric and the source. */
  info: string;
  /** The chart, or a function of the chart frame so the same chart can render larger, with a brush, inside the expand dialog. */
  children: ReactNode | ((frame: ChartFrame) => ReactNode);
  className?: string;
  actions?: ReactNode;
  scale?: Scale;
  onScaleChange?: (s: Scale) => void;
  footer?: ReactNode;
  /** Stable id. Drives the DOM id and the shareable `?expand=<id>` dialog. */
  id?: string;
  /** When given, a Chart / Table toggle lets readers see the plotted rows. */
  table?: ChartTableSpec;
  /** When given, a Query tab shows the exact SQL, API call and transform behind the chart. */
  queries?: QuerySpec[];
  /** What the card responds to (standard section 4). */
  scope?: ChartScope;
  /** False for charts that live inside a pop-up; the expand dialog needs an id. */
  expandable?: boolean;
  /** Level series (TVL, price, a ratio) get a fitted y axis and a "From zero" toggle (standard section 6). */
  level?: boolean;
  /** Min, max and change over the visible range, written by the chart. */
  subtitle?: ReactNode;
  /** Short source line, shown in the expand dialog. */
  source?: string;
  /** The view the card and its expanded copy open on. A card of records (the timeline) opens on its table. */
  defaultView?: ChartView;
  /** A card whose counts legacy listings change: shows its "Include legacy" switch and says when it includes them. */
  legacyCard?: LegacyCard;
}

const SCALE_OPTIONS = [
  { value: "log" as const, label: "Log" },
  { value: "linear" as const, label: "Linear" },
];
const AXIS_OPTIONS = [
  { value: "fitted" as const, label: "Fitted" },
  { value: "zero" as const, label: "From zero" },
];
const noop = () => {};

/**
 * Honest filter scope (standard section 4). A filtered card shows the active filter count next to
 * its title. A card that ignores the filters (whole-chain history, a compare selection) simply stays
 * the same when filters change and carries no note.
 */
export function ScopeNote({ scope = "filtered", className, legacy = false }: { scope?: ChartScope; className?: string; /** The card includes legacy listings, which the rest of the page leaves out. */ legacy?: boolean }) {
  const active = useActiveFilterCount();
  const parts = [scope === "filtered" && active > 0 ? `${active} filter${active === 1 ? "" : "s"} active` : null, legacy ? "includes legacy listings" : null].filter(Boolean);
  const text = parts.length ? parts.join(", ").replace(/^./, (c) => c.toUpperCase()) : null;
  if (!text) return null;
  return (
    <span className={cn("text-label text-ink-300", className)} data-scope={scope}>
      {text}
    </span>
  );
}

export function ChartCard({ title, takeaway, info, children, className, actions, scale, onScaleChange, footer, id, table, queries, scope, expandable = true, level = false, subtitle, source, takeawayPlacement = "expanded", defaultView = "chart", legacyCard }: ChartCardProps) {
  const legacy = useLegacyOn(legacyCard);
  const firstView: ChartView = defaultView === "table" && !table ? "chart" : defaultView;
  const [view, setView] = useState<ChartView>(firstView);
  const [dialogView, setDialogView] = useState<ChartView>(firstView);
  const [axis, setAxis] = useState<"fitted" | "zero">("fitted");
  const [brushRange, setBrushRange] = useState<[number, number] | null>(null);
  const [expand, setExpand] = useQueryState("expand", parseAsString.withOptions({ history: "replace" }));
  const canExpand = expandable && Boolean(id);
  // The expand dialog renders above the page, so on a walled page it stays closed until the reader logs in.
  const walled = !useAccess().can({ path: usePathname() });
  const open = canExpand && expand === id && !walled;
  const hasQuery = Boolean(queries && queries.length);
  const inline = takeawayPlacement === "inline" || !canExpand;
  const startAtZero = !level || axis === "zero";

  const inlineFrame = useMemo<ChartFrame>(() => ({ expanded: false, brush: false, startAtZero, brushRange: null, setBrushRange: noop }), [startAtZero]);
  const dialogFrame = useMemo<ChartFrame>(() => ({ expanded: true, brush: true, startAtZero, brushRange, setBrushRange }), [startAtZero, brushRange]);

  const close = () => {
    setBrushRange(null);
    setDialogView(firstView);
    void setExpand(null);
  };

  const controls = (v: ChartView, setV: (v: ChartView) => void) => (
    <>
      {legacyCard && <LegacySwitch card={legacyCard} label={title} />}
      {actions}
      {level && v === "chart" && <Segmented value={axis} onChange={setAxis} options={AXIS_OPTIONS} ariaLabel="Y axis" />}
      {scale && onScaleChange && v === "chart" && <Segmented value={scale} onChange={onScaleChange} options={SCALE_OPTIONS} ariaLabel="Axis scale" />}
      {(table || hasQuery) && <ChartTableToggle view={v} onChange={setV} hasQuery={hasQuery} />}
    </>
  );

  const body = (v: ChartView, frame: ChartFrame) =>
    v === "table" && table ? (
      <ChartTable spec={table} />
    ) : v === "query" && queries ? (
      <QueryView queries={queries} />
    ) : (
      <ChartFrameProvider value={frame}>{typeof children === "function" ? children(frame) : children}</ChartFrameProvider>
    );

  return (
    <Card id={id} className={cn("gap-3 py-4", className)} data-chart-card={title}>
      <CardHeader className="gap-1 px-4">
        {/* The controls wrap under the title when both do not fit on one row, so a narrow card never squeezes its title. */}
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-[min(15rem,100%)] flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="flex items-center gap-1">
                <h3 className="text-sm font-semibold leading-tight">{title}</h3>
                <InfoTip label={`About ${title}`}>{info}</InfoTip>
              </span>
              <ScopeNote scope={scope} legacy={legacy} />
            </div>
            {inline && <p className="mt-1 text-sm text-ink-300">{takeaway}</p>}
            {subtitle && <p className="mt-1 text-label text-ink-300">{subtitle}</p>}
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-2">
            {controls(view, setView)}
            {canExpand && (
              <Button variant="ghost" size="icon-sm" aria-label={`Expand ${title}`} title="Expand" onClick={() => void setExpand(id ?? null)}>
                <Maximize2 />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4">{body(view, inlineFrame)}</CardContent>
      {footer && <div className="px-4 text-xs text-ink-300">{footer}</div>}

      {canExpand && (
        <Dialog open={open} onOpenChange={(o) => !o && close()}>
          <DialogContent className="flex max-h-[92vh] w-full flex-col gap-3 overflow-y-auto sm:max-w-[min(1400px,calc(100%-2rem))]" data-expanded-chart={id}>
            <DialogHeader className="gap-1 pr-8">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <DialogTitle className="text-title">{title}</DialogTitle>
                <ScopeNote scope={scope} legacy={legacy} />
              </div>
              <DialogDescription className={inline ? "text-sm text-ink-300" : "sr-only"}>{takeaway}</DialogDescription>
              {subtitle && <p className="text-label text-ink-300">{subtitle}</p>}
            </DialogHeader>
            <div className="flex flex-wrap items-center gap-2">{controls(dialogView, setDialogView)}</div>
            <div className="min-h-0 flex-1">{open && body(dialogView, dialogFrame)}</div>
            {!inline && <TakeawayList takeaway={points(takeaway)} className="border-t border-ink-700/40 pt-3" />}
            {footer && <div className="text-xs text-ink-300">{footer}</div>}
            <p className="text-label text-ink-300">
              {source ? `Source. ${/[.!?]$/.test(source) ? source : `${source}.`}` : info}
              {" Press Escape to close."}
            </p>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

function QueryView({ queries }: { queries: QuerySpec[] }) {
  return (
    <div className="space-y-3">
      {queries.map((q, i) => (
        <div key={i}>
          <div className="mb-1 flex items-center gap-2 text-xs text-ink-300">
            <span className="font-mono text-label uppercase text-ink-300">{q.kind}</span>
            <span>{q.title}</span>
          </div>
          <pre className="max-h-80 overflow-auto rounded-lg border border-ink-700/40 bg-ink-950/60 p-3 font-mono text-[11px] leading-relaxed text-ink-50">
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

/** Hatch pattern definitions for "Other" fills; render once inside an SVG chart with a unique id (see useSvgId). */
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
