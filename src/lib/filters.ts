"use client";

import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryStates, type inferParserType } from "nuqs";
import { useCallback, useMemo } from "react";
import { projects as allProjects } from "./data";
import { MIN_SIZES } from "./movers";
import { RANGES } from "./ranges";
import { METRICS, type MetricKey, type NumericMetricKey, type Project } from "./types";

export const SCALES = ["log", "linear"] as const;
export type Scale = (typeof SCALES)[number];

export const COL_SETS = ["traction", "momentum", "activity", "financials"] as const;
export type ColSet = (typeof COL_SETS)[number];

export const ALIGNS = ["date", "days"] as const;
export type Align = (typeof ALIGNS)[number];

/** Legacy listings (status "Unknown (legacy 2021-23 listing)") are shown by default and can be hidden with one switch. */
export const LEGACY_MODES = ["show", "hide"] as const;
export type LegacyMode = (typeof LEGACY_MODES)[number];
export const LEGACY_GROUP = "Legacy listing" as const;

const NUMERIC_METRICS = ["tvl", "volume", "fees", "revenue"] as const satisfies readonly NumericMetricKey[];

const list = parseAsArrayOf(parseAsString, ",").withDefault([]);
const metricParser = (fallback: MetricKey) => parseAsStringLiteral(METRICS).withDefault(fallback);
const numericMetricParser = (fallback: NumericMetricKey) => parseAsStringLiteral(NUMERIC_METRICS).withDefault(fallback);

/**
 * URL state. There is no global metric (standard section 4); each chart that
 * needs one owns a short key below, so a shared link reproduces every chart.
 */
export const filterParsers = {
  q: parseAsString.withDefault(""),
  sector: list,
  chain: list,
  presence: list,
  tier: list,
  status: list,
  funding: list,
  via: list,
  legacy: parseAsStringLiteral(LEGACY_MODES).withDefault("show"),
  scale: parseAsStringLiteral(SCALES).withDefault("log"),
  range: parseAsStringLiteral(RANGES).withDefault("30d"),
  minSize: parseAsStringLiteral(MIN_SIZES).withDefault("100k"),
  cols: parseAsStringLiteral(COL_SETS).withDefault("traction"),
  align: parseAsStringLiteral(ALIGNS).withDefault("date"),
  compare: list,
  project: parseAsString,
  sectorDrawer: parseAsString,
  investor: parseAsString,
  /** Sector treemap metric and drill-down sector. */
  tm: metricParser("count"),
  tmSector: parseAsString,
  /** Concentration curve. */
  cc: numericMetricParser("tvl"),
  /** Risers and fallers. */
  mv: numericMetricParser("tvl"),
  /** Insights panel. */
  ins: metricParser("count"),
  /** Sector bars and sector cards. */
  sb: metricParser("count"),
  sg: metricParser("count"),
  /** Leaderboard. */
  lb: metricParser("count"),
  /** Compare page (matrix ratios, overlay, top-project buttons). */
  cm: numericMetricParser("tvl"),
  /** Sector drawer ordering. */
  sm: metricParser("count"),
};

export type FilterState = inferParserType<typeof filterParsers>;

/** Params that follow the reader from page to page. Chart keys stay on their page. */
export const CARRIED_PARAMS = ["compare", "range", "scale", "legacy"] as const;

export const FACETS = [
  { key: "sector", label: "Sector" },
  { key: "chain", label: "Native chain" },
  { key: "presence", label: "Chain presence" },
  { key: "tier", label: "Traction tier" },
  { key: "status", label: "Status" },
  { key: "funding", label: "Funding type" },
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
    case "via":
      return p.discoveredViaList;
  }
}

/** Pure filter so it can be tested without React. */
export function applyFilters(projects: Project[], f: Partial<FilterState>): Project[] {
  const q = (f.q ?? "").trim().toLowerCase();
  const hideLegacy = f.legacy === "hide";
  const sets: Partial<Record<FacetKey, Set<string>>> = {};
  for (const { key } of FACETS) {
    const vals = f[key] ?? [];
    if (vals.length) sets[key] = new Set(vals);
  }
  return projects.filter((p) => {
    if (hideLegacy && p.statusGroup === LEGACY_GROUP) return false;
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

export function activeFilterCount(f: Pick<FilterState, "q" | "legacy" | FacetKey>): number {
  let n = f.q.trim() ? 1 : 0;
  for (const { key } of FACETS) n += f[key].length;
  if (f.legacy === "hide") n += 1;
  return n;
}

const EMPTY_FACETS = { q: "", sector: [], chain: [], presence: [], tier: [], status: [], funding: [], via: [], legacy: "show" as const };

export function useFilters() {
  const [state, setState] = useQueryStates(filterParsers, { history: "replace", clearOnDefault: true });
  const filtered = useMemo(() => applyFilters(allProjects, state), [state]);

  const reset = useCallback(() => {
    void setState(EMPTY_FACETS);
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

/** The active filter count alone, for cards that only need to say "n filters active". */
export function useActiveFilterCount(): number {
  const [state] = useQueryStates(filterParsers, { history: "replace", clearOnDefault: true });
  return activeFilterCount(state);
}
