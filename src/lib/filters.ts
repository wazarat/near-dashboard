"use client";

import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryStates, type inferParserType } from "nuqs";
import { useCallback, useMemo } from "react";
import { projects as allProjects } from "./data";
import { MIN_SIZES } from "./movers";
import { RANGES, type Range } from "./ranges";
import { METRICS, type MetricKey, type NumericMetricKey, type Project } from "./types";

export const SCALES = ["log", "linear"] as const;
export type Scale = (typeof SCALES)[number];

export const COL_SETS = ["traction", "momentum", "activity", "financials"] as const;
export type ColSet = (typeof COL_SETS)[number];

/** The Explorer opens on its table; the map of the same selection is ?view=map. */
export const EXPLORER_VIEWS = ["table", "map"] as const;
export type ExplorerViewMode = (typeof EXPLORER_VIEWS)[number];

export const ALIGNS = ["date", "days"] as const;
export type Align = (typeof ALIGNS)[number];

/**
 * Legacy listings (status "Unknown (legacy 2021-23 listing)", 591 rows from the 2021 to 2023 AwesomeNEAR
 * directory) are hidden by default (owner, 2026-11-12). Each card whose numbers they change has its own
 * "Include legacy listings" switch; the `legacy` URL key lists the cards that include them
 * (`?legacy=kpi,sectors`). None of them carries a TVL, volume, fee or revenue figure, so only counts move.
 */
export const LEGACY_GROUP = "Legacy listing" as const;
export const LEGACY_CARDS = [
  "kpi",
  "sectors",
  "insights",
  "native-vs-imported",
  "sector-bars",
  "tier-by-sector",
  "sector-cards",
  "sector-modal",
  "leaderboard",
  "activity-without-tvl",
  "listed-vs-live",
  "funding-type",
  "security-facts",
  "explorer",
] as const;
export type LegacyCard = (typeof LEGACY_CARDS)[number];

const NUMERIC_METRICS = ["tvl", "volume", "fees", "revenue"] as const satisfies readonly NumericMetricKey[];

/**
 * Per-card time range (standard section 4). There is no global range control; each card that shows
 * a time window keeps its own choice under one of these keys. `cr` chain over time, `ar` chain
 * activity, `mr` risers and fallers, `hr` project history and `xr` compare trend are the standard's
 * names; `lr` (leaderboard trend), `ir` (Intents daily volume) and `rr` (Intents status rates) are
 * NEAR's own.
 */
export const RANGE_KEYS = ["cr", "ar", "mr", "lr", "hr", "xr", "ir", "rr"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];
/** No default, so an absent key can fall back to the old global key (see `cardRange`). */
const cardRangeParser = parseAsStringLiteral(RANGES);

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
  /** Cards that include legacy listings. An old `legacy=hide` link names no card, so it hides them everywhere, as it meant to. */
  legacy: list,
  scale: parseAsStringLiteral(SCALES).withDefault("log"),
  /** The old global range. Nothing writes it any more; it is read so a link shared before the change opens as it did. */
  range: parseAsStringLiteral(RANGES).withDefault("30d"),
  cr: cardRangeParser,
  ar: cardRangeParser,
  mr: cardRangeParser,
  lr: cardRangeParser,
  hr: cardRangeParser,
  xr: cardRangeParser,
  ir: cardRangeParser,
  rr: cardRangeParser,
  minSize: parseAsStringLiteral(MIN_SIZES).withDefault("100k"),
  cols: parseAsStringLiteral(COL_SETS).withDefault("traction"),
  align: parseAsStringLiteral(ALIGNS).withDefault("date"),
  compare: list,
  project: parseAsString,
  sectorDrawer: parseAsString,
  investor: parseAsString,
  /** Funding type pop-up. */
  fundingType: parseAsString,
  /** Timeline event pop-up. */
  event: parseAsString,
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
  /** Sector pop-up ordering. */
  sm: metricParser("count"),
  /** Explorer, table or map. The map shares the treemap keys (tm, tmSector) with the Overview chart it reuses. */
  view: parseAsStringLiteral(EXPLORER_VIEWS).withDefault("table"),
};

export type FilterState = inferParserType<typeof filterParsers>;

/**
 * A card's range: its own key, else the old global `range` key from a link shared before the
 * per-card controls, else 30d (that key's default). Pure, so it is tested.
 */
export function cardRange(state: Pick<FilterState, RangeKey | "range">, key: RangeKey): Range {
  return state[key] ?? state.range;
}

/** What picking a range on a card writes: its own key, or nothing when the pick is what the card shows without one. */
export function cardRangeWrite(state: Pick<FilterState, "range">, key: RangeKey, next: Range): Partial<Record<RangeKey, Range | null>> {
  return { [key]: next === state.range ? null : next };
}

/** Params that follow the reader from page to page. Chart keys stay on their page; `range` is the old global key, carried so an old link keeps working. */
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

/**
 * Pure filter so it can be tested without React. Legacy listings are left out unless `includeLegacy`
 * is set or the Status facet selects them by name (an explicit filter wins over the default).
 */
export function applyFilters(projects: Project[], f: Partial<FilterState>, includeLegacy = false): Project[] {
  const q = (f.q ?? "").trim().toLowerCase();
  const hideLegacy = !includeLegacy && !(f.status ?? []).includes(LEGACY_GROUP);
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

/** Search and facets. The legacy switches are a card's control, not a filter, so they do not count. */
export function activeFilterCount(f: Pick<FilterState, "q" | FacetKey>): number {
  let n = f.q.trim() ? 1 : 0;
  for (const { key } of FACETS) n += f[key].length;
  return n;
}

/** Whether a card includes legacy listings. Pure. */
export function legacyIncluded(state: Pick<FilterState, "legacy">, card: LegacyCard): boolean {
  return state.legacy.includes(card);
}

/** The `legacy` list after a card's switch is turned on or off, in the fixed card order. Pure. */
export function legacyWrite(state: Pick<FilterState, "legacy">, card: LegacyCard, on: boolean): string[] {
  const next = new Set(state.legacy.filter((c) => (LEGACY_CARDS as readonly string[]).includes(c)));
  if (on) next.add(card);
  else next.delete(card);
  return LEGACY_CARDS.filter((c) => next.has(c));
}

const EMPTY_FACETS = { q: "", sector: [], chain: [], presence: [], tier: [], status: [], funding: [], via: [] };

export function useFilters() {
  const [state, setState] = useQueryStates(filterParsers, { history: "replace", clearOnDefault: true });
  const filtered = useMemo(() => applyFilters(allProjects, state), [state]);
  const withLegacy = useMemo(() => applyFilters(allProjects, state, true), [state]);
  /** The projects a card shows: the filtered list, with legacy listings when that card's switch is on. */
  const projectsFor = useCallback((card: LegacyCard) => (legacyIncluded(state, card) ? withLegacy : filtered), [state, withLegacy, filtered]);
  const legacyOn = useCallback((card: LegacyCard) => legacyIncluded(state, card), [state]);
  const setLegacy = useCallback((card: LegacyCard, on: boolean) => void setState((prev) => ({ legacy: legacyWrite(prev, card, on) })), [setState]);

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
  const openFundingType = useCallback((bucket: string | null) => void setState({ fundingType: bucket }), [setState]);
  const openEvent = useCallback((id: string | null) => void setState({ event: id }), [setState]);
  const rangeOf = useCallback((key: RangeKey) => cardRange(state, key), [state]);
  const setRange = useCallback((key: RangeKey, next: Range) => void setState((prev) => cardRangeWrite(prev, key, next)), [setState]);

  return {
    state,
    setState,
    filtered,
    projectsFor,
    legacyOn,
    setLegacy,
    all: allProjects,
    scale: state.scale,
    rangeOf,
    setRange,
    reset,
    toggleFacet,
    setFacet,
    openProject,
    openSector,
    openInvestor,
    openFundingType,
    openEvent,
    activeCount: activeFilterCount(state),
  };
}

/** The active filter count alone, for cards that only need to say "n filters active". */
export function useActiveFilterCount(): number {
  const [state] = useQueryStates(filterParsers, { history: "replace", clearOnDefault: true });
  return activeFilterCount(state);
}
