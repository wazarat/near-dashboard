"use client";

import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryStates, type inferParserType } from "nuqs";
import { useCallback, useMemo } from "react";
import { projects as allProjects } from "./data";
import { MIN_SIZES } from "./movers";
import { RANGES } from "./ranges";
import { METRICS, type MetricKey, type Project } from "./types";

export const SCALES = ["log", "linear"] as const;
export type Scale = (typeof SCALES)[number];

export const COL_SETS = ["traction", "momentum", "activity", "financials"] as const;
export type ColSet = (typeof COL_SETS)[number];

export const ALIGNS = ["date", "days"] as const;
export type Align = (typeof ALIGNS)[number];

const list = parseAsArrayOf(parseAsString, ",").withDefault([]);

export const filterParsers = {
  q: parseAsString.withDefault(""),
  sector: list,
  chain: list,
  presence: list,
  tier: list,
  status: list,
  funding: list,
  risk: list,
  via: list,
  metric: parseAsStringLiteral(METRICS).withDefault("count"),
  scale: parseAsStringLiteral(SCALES).withDefault("log"),
  range: parseAsStringLiteral(RANGES).withDefault("30d"),
  minSize: parseAsStringLiteral(MIN_SIZES).withDefault("100k"),
  cols: parseAsStringLiteral(COL_SETS).withDefault("traction"),
  align: parseAsStringLiteral(ALIGNS).withDefault("date"),
  compare: list,
  project: parseAsString,
  sectorDrawer: parseAsString,
  investor: parseAsString,
};

export type FilterState = inferParserType<typeof filterParsers>;

/** Params that follow the reader from page to page. */
export const CARRIED_PARAMS = ["compare", "range", "metric", "scale"] as const;

export const FACETS = [
  { key: "sector", label: "Sector" },
  { key: "chain", label: "Native chain" },
  { key: "presence", label: "Chain presence" },
  { key: "tier", label: "Traction tier" },
  { key: "status", label: "Status" },
  { key: "funding", label: "Funding type" },
  { key: "risk", label: "Security risk" },
  { key: "via", label: "Discovered via" },
] as const;
export type FacetKey = (typeof FACETS)[number]["key"];

export function facetValue(p: Project, key: FacetKey): string[] {
  switch (key) {
    case "sector":
      return [p.sector];
    case "chain":
      return [p.chain];
    case "presence":
      return p.presence.length ? p.presence : ["Unknown"];
    case "tier":
      return [p.tier];
    case "status":
      return [p.statusGroup];
    case "funding":
      return p.fundingTypes;
    case "risk":
      return [p.risk];
    case "via":
      return p.discoveredViaList;
  }
}

/** Pure filter so it can be tested without React. */
export function applyFilters(projects: Project[], f: Partial<FilterState>): Project[] {
  const q = (f.q ?? "").trim().toLowerCase();
  const sets: Partial<Record<FacetKey, Set<string>>> = {};
  for (const { key } of FACETS) {
    const vals = f[key] ?? [];
    if (vals.length) sets[key] = new Set(vals);
  }
  return projects.filter((p) => {
    for (const { key } of FACETS) {
      const s = sets[key];
      if (s && !facetValue(p, key).some((v) => s.has(v))) return false;
    }
    if (q) {
      const hay = `${p.name} ${p.description} ${p.xHandle ?? ""} ${p.subcategory ?? ""} ${p.token ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function activeFilterCount(f: FilterState): number {
  let n = f.q.trim() ? 1 : 0;
  for (const { key } of FACETS) n += f[key].length;
  return n;
}

export function useFilters() {
  const [state, setState] = useQueryStates(filterParsers, { history: "replace", clearOnDefault: true });
  const filtered = useMemo(() => applyFilters(allProjects, state), [state]);
  const metric: MetricKey = state.metric;

  const reset = useCallback(() => {
    void setState({ q: "", sector: [], chain: [], presence: [], tier: [], status: [], funding: [], risk: [], via: [] });
  }, [setState]);

  const toggleFacet = useCallback(
    (key: FacetKey, value: string) => {
      void setState((prev) => {
        const cur = prev[key];
        return { [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
      });
    },
    [setState],
  );

  const setFacet = useCallback((key: FacetKey, values: string[]) => void setState({ [key]: values }), [setState]);
  const openProject = useCallback((id: string | null) => void setState({ project: id }), [setState]);
  const openSector = useCallback((sector: string | null) => void setState({ sectorDrawer: sector }), [setState]);
  const openInvestor = useCallback((id: string | null) => void setState({ investor: id }), [setState]);

  return {
    state,
    setState,
    filtered,
    all: allProjects,
    metric,
    scale: state.scale,
    range: state.range,
    reset,
    toggleFacet,
    setFacet,
    openProject,
    openSector,
    openInvestor,
    activeCount: activeFilterCount(state),
  };
}
