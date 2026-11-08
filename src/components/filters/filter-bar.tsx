"use client";

import { Check, Link2, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CHAIN_COLOR, RISK_COLOR, STATUS_COLOR, TIER_COLOR } from "@/lib/colors";
import { meta, projects as allProjects } from "@/lib/data";
import { FACETS, applyFilters, facetValue, useFilters, type FacetKey } from "@/lib/filters";
import { METRIC_SHORT } from "@/lib/format";
import type { Range } from "@/lib/ranges";
import { CHAIN_PRESENCE, METRICS, NATIVE_CHAINS, RISK_LEVELS, STATUS_GROUPS, TIERS, type MetricKey } from "@/lib/types";
import { DateRangeControl } from "./date-range-control";
import { MultiSelect, type Option } from "./multi-select";

const FACET_HINTS: Partial<Record<string, string>> = {
  "Not researched": "This field was never checked for the project",
  Unknown: "Checked, nothing found",
  "Not disclosed": "Checked, no funding disclosed",
  "Legacy listing": "Listed only in the 2021 to 2023 AwesomeNEAR directory, which marks everything active; current status unknown",
  Defunct: "DefiLlama page no longer resolves",
  "Tracked, negligible": "Listed on DefiLlama but every figure is zero",
};

function orderedValues(key: FacetKey): string[] {
  switch (key) {
    case "chain":
      return [...NATIVE_CHAINS];
    case "presence":
      return [...CHAIN_PRESENCE, "Unknown"];
    case "tier":
      return [...TIERS];
    case "risk":
      return [...RISK_LEVELS];
    case "status":
      return [...STATUS_GROUPS];
    case "sector":
      return meta.sectors;
    case "funding":
      return meta.fundingTypes;
    case "via":
      return meta.discoveredVia;
  }
}

function colorFor(key: FacetKey, value: string): string | undefined {
  if (key === "chain") return CHAIN_COLOR[value as keyof typeof CHAIN_COLOR];
  if (key === "tier") return TIER_COLOR[value as keyof typeof TIER_COLOR];
  if (key === "risk") return RISK_COLOR[value as keyof typeof RISK_COLOR];
  if (key === "status") return STATUS_COLOR[value as keyof typeof STATUS_COLOR];
  return undefined;
}

export function FilterBar() {
  const { state, setState, filtered, setFacet, reset, activeCount, range } = useFilters();
  const [copied, setCopied] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Faceted counts: for each facet, count values among projects matching every other filter.
  const optionsByFacet = useMemo(() => {
    const out = {} as Record<FacetKey, Option[]>;
    for (const { key } of FACETS) {
      const base = applyFilters(allProjects, { ...state, [key]: [] });
      const counts = new Map<string, number>();
      for (const p of base) for (const v of facetValue(p, key)) counts.set(v, (counts.get(v) ?? 0) + 1);
      out[key] = orderedValues(key)
        .filter((v) => counts.has(v) || state[key].includes(v) || key !== "presence")
        .map((v) => ({ value: v, count: counts.get(v) ?? 0, color: colorFor(key, v), hint: FACET_HINTS[v] }));
    }
    return out;
  }, [state]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const facetControls = (vertical: boolean) =>
    FACETS.map(({ key, label }) => (
      <MultiSelect key={key} label={label} options={optionsByFacet[key]} selected={state[key]} onChange={(vals) => setFacet(key, vals)} className={vertical ? "w-full" : undefined} />
    ));

  const metricSwitcher = (
    <ToggleGroup type="single" size="sm" variant="outline" value={state.metric} onValueChange={(v) => v && void setState({ metric: v as MetricKey })} aria-label="Metric" className="shrink-0">
      {METRICS.map((m) => (
        <ToggleGroupItem key={m} value={m} className="h-8 px-2.5 text-xs">
          {METRIC_SHORT[m]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );

  return (
    <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-2 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1 md:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={state.q}
              onChange={(e) => void setState({ q: e.target.value })}
              placeholder="Search name, description, token, X handle"
              aria-label="Search projects"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="hidden flex-wrap items-center gap-1.5 xl:flex">{facetControls(false)}</div>
          <div className="xl:hidden">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <SlidersHorizontal className="size-3.5" />
                  Filters
                  {activeCount > 0 && <span className="rounded bg-foreground px-1.5 py-px text-[10px] font-semibold text-background">{activeCount}</span>}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 px-4 pb-6">
                  {facetControls(true)}
                  <div className="mt-2 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={reset} disabled={activeCount === 0}>
                      Reset
                    </Button>
                    <Button size="sm" className="flex-1 text-xs" onClick={() => setSheetOpen(false)}>
                      Show {filtered.length}
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <div className="ml-auto hidden items-center gap-1.5 lg:flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={reset} disabled={activeCount === 0}>
                  <RotateCcw className="size-3.5" /> Reset
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear search and filters</TooltipContent>
            </Tooltip>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={copyLink}>
              {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
              {copied ? "Copied" : "Copy link to this view"}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {metricSwitcher}
            <DateRangeControl value={range} onChange={(r: Range) => void setState({ range: r })} className="shrink-0" />
            <span className="hidden text-xs text-muted-foreground lg:inline">metric and range drive the charts</span>
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Showing <span className="tabular font-medium text-foreground">{filtered.length.toLocaleString("en-US")}</span> of {allProjects.length.toLocaleString("en-US")} projects
          </p>
          <div className="flex items-center gap-1 lg:hidden">
            <Button variant="ghost" size="icon" className="size-8" onClick={reset} disabled={activeCount === 0} aria-label="Reset filters">
              <RotateCcw className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={copyLink} aria-label="Copy link to this view">
              {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
