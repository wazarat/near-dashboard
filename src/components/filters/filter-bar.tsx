"use client";

import { Check, Link2, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { InfoTip } from "@/components/ui/info-tip";
import { CHAIN_COLOR, STATUS_COLOR, STATUS_GROUP_LABEL, TIER_COLOR } from "@/lib/colors";
import { meta, projects as allProjects } from "@/lib/data";
import { FACETS, LEGACY_GROUP, applyFilters, facetValue, useFilters, type FacetKey } from "@/lib/filters";
import { NOT_APPLICABLE_LINE, TBD_LINE, tierLabel } from "@/lib/tier";
import { CHAIN_PRESENCE, NATIVE_CHAINS, STATUS_GROUPS, TIERS, type Tier } from "@/lib/types";
import { MultiSelect, type Option } from "./multi-select";

const FACET_HINTS: Partial<Record<string, string>> = {
  "Not researched": "This field was never checked for the project",
  Unknown: "Checked, nothing found",
  "Not disclosed": "Checked, no funding disclosed",
  [LEGACY_GROUP]: "Listed only in the 2021 to 2023 AwesomeNEAR directory, which marks everything active, so the current status is unverified",
  Defunct: "DefiLlama page no longer resolves",
  "Tracked, negligible": "Listed on DefiLlama but every figure is zero",
  "Not tracked": TBD_LINE,
  "Not applicable": NOT_APPLICABLE_LINE,
};

function orderedValues(key: FacetKey): string[] {
  switch (key) {
    case "chain":
      return [...NATIVE_CHAINS];
    case "presence":
      return [...CHAIN_PRESENCE, "Unknown"];
    case "tier":
      return [...TIERS];
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
  if (key === "status") return STATUS_COLOR[value as keyof typeof STATUS_COLOR];
  return undefined;
}

function labelFor(key: FacetKey, value: string): string | undefined {
  if (key === "status") return STATUS_GROUP_LABEL[value as keyof typeof STATUS_GROUP_LABEL];
  if (key === "tier") return tierLabel(value as Tier);
  return undefined;
}

const legacyCount = allProjects.filter((p) => p.statusGroup === LEGACY_GROUP).length;
const LEGACY_NOTE = `${legacyCount.toLocaleString("en-US")} legacy listings from the 2021 to 2023 AwesomeNEAR directory are left out by default. A card whose counts they change has its own switch to include them, and the Status filter shows them when Legacy listing is picked.`;

/** The sticky filter bar: search, facets, the result count, Reset and Copy link. Time ranges and the legacy-listing switches live on each card (standard section 4). */
export function FilterBar() {
  const { state, setState, filtered, setFacet, reset, activeCount } = useFilters();
  const [copied, setCopied] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Faceted counts: for each facet, count values among projects matching every other filter.
  const optionsByFacet = useMemo(() => {
    const out = {} as Record<FacetKey, Option[]>;
    for (const { key } of FACETS) {
      // The Status counts include legacy listings, so "Legacy listing" shows how many picking it brings back.
      const base = applyFilters(allProjects, { ...state, [key]: [] }, key === "status");
      const counts = new Map<string, number>();
      for (const p of base) for (const v of facetValue(p, key)) counts.set(v, (counts.get(v) ?? 0) + 1);
      out[key] = orderedValues(key)
        .filter((v) => counts.has(v) || state[key].includes(v) || key !== "presence")
        .map((v) => ({ value: v, label: labelFor(key, v), count: counts.get(v) ?? 0, color: colorFor(key, v), hint: FACET_HINTS[v] }));
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


  return (
    <div className="sticky top-0 z-30 border-b border-ink-700/40 bg-ink-950/80 backdrop-blur-xl">
      {/*
        One wrapping row with a forced break, so each control exists once and only its place changes with the width.
        Wide screens: search, facets and the result count, then, under the count, Reset and Copy link (standard
        section 4). Narrow screens: search and Filters, then the count and the two icon buttons.
      */}
      <div className="mx-auto flex w-full max-w-atlas flex-wrap items-center gap-x-2 gap-y-2 px-5 py-2.5 sm:px-6 lg:px-8">
        <div className="relative order-1 min-w-0 flex-1 md:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-300" />
          <Input
            type="search"
            value={state.q}
            onChange={(e) => void setState({ q: e.target.value })}
            placeholder="Search name, description, token, X handle"
            aria-label="Search projects"
            className="h-8 rounded-lg border-ink-700/60 bg-ink-900 pl-8 text-xs"
          />
        </div>
        <div className="order-2 hidden flex-wrap items-center gap-1.5 xl:flex">{facetControls(false)}</div>
        <div className="order-2 xl:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <SlidersHorizontal className="size-3.5" />
                Filters
                {activeCount > 0 && <span className="font-mono text-ink-300">({activeCount})</span>}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-2 px-4 pb-6">
                {facetControls(true)}
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={reset} disabled={activeCount === 0}>
                    Reset
                  </Button>
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => setSheetOpen(false)}>
                    Show {filtered.length}
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <p className="order-6 shrink-0 text-label text-ink-300 lg:order-3 lg:ml-auto" aria-live="polite" data-testid="result-count">
          <span className="inline-flex items-center gap-1">
            <span>
              Showing <span className="tabular font-medium text-ink-50">{filtered.length.toLocaleString("en-US")}</span> of {allProjects.length.toLocaleString("en-US")} projects
            </span>
            <InfoTip label="About legacy listings">{LEGACY_NOTE}</InfoTip>
          </span>
        </p>
        <div aria-hidden className="order-4 h-0 basis-full" />
        <div className="order-7 ml-auto hidden items-center gap-1.5 lg:flex" data-testid="filter-actions">
          <Button variant="ghost" size="sm" className="h-8" onClick={reset} disabled={activeCount === 0} title="Clear search and filters">
            <RotateCcw className="size-3.5" /> Reset
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={copyLink}>
            {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
            {copied ? "Copied" : "Copy link to this view"}
          </Button>
        </div>
        <div className="order-7 ml-auto flex items-center gap-1 lg:hidden">
          <Button variant="ghost" size="icon-sm" onClick={reset} disabled={activeCount === 0} aria-label="Reset filters">
            <RotateCcw className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={copyLink} aria-label="Copy link to this view">
            {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
