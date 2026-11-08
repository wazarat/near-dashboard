/**
 * Compare mode. The selection lives in the URL (compare=a,b,c, at most four
 * ids). Everything here is a pure function over Project rows and the 90-day
 * series file, except useCompare() at the bottom, which wraps the URL state.
 */
import { useCallback, useMemo } from "react";
import { projectById } from "./data";
import { useFilters } from "./filters";
import { fmtInt, fmtPctSigned, fmtUsd, METRIC_LABEL, METRIC_SHORT } from "./format";
import type { MetricKey, NumericMetricKey, Project, SeriesFile, SeriesKey } from "./types";

export const COMPARE_MAX = 4;

/** The "count" metric has no series, so comparisons fall back to TVL. */
export function numericMetric(metric: MetricKey): NumericMetricKey {
  return metric === "count" ? "tvl" : metric;
}

/** Keeps known ids only, in order, without duplicates, capped at COMPARE_MAX. */
export function normalizeSelection(ids: readonly string[], known: Set<string>): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (known.has(id) && !out.includes(id)) out.push(id);
    if (out.length === COMPARE_MAX) break;
  }
  return out;
}

/* ------------------------------------------------------------------ presets */

export interface ComparePreset {
  name: string;
  projects: string[];
}

/** Resolved by exact project name at render time; names missing from the dataset are skipped. */
export const COMPARE_PRESETS: ComparePreset[] = [
  { name: "Liquid staking", projects: ["Meta Pool", "Rhea LST (rNEAR)", "LiNEAR Protocol"] },
  { name: "DEXs", projects: ["Rhea Finance", "Jumbo Exchange", "Veax", "Trisolaris"] },
  { name: "Lending", projects: ["Rhea Lend (formerly Burrow)", "Templar Protocol", "Bastion", "Aurigami"] },
  { name: "Bridges", projects: ["NEAR Intents", "NEAR Omni Bridge", "Portal (Wormhole)"] },
];

export function nameLookup(all: readonly Project[]): Map<string, string> {
  return new Map(all.map((p) => [p.name, p.id]));
}

export function resolvePreset(names: readonly string[], lookup: Map<string, string>): string[] {
  const out: string[] = [];
  for (const n of names) {
    const id = lookup.get(n);
    if (id && !out.includes(id)) out.push(id);
  }
  return out.slice(0, COMPARE_MAX);
}

export interface ResolvedPreset {
  name: string;
  ids: string[];
  /** Names that resolved, for the chip title. */
  names: string[];
}

/** Presets with at least two projects present in the dataset. */
export function availablePresets(all: readonly Project[], presets: ComparePreset[] = COMPARE_PRESETS): ResolvedPreset[] {
  const lookup = nameLookup(all);
  return presets
    .map((p) => ({ name: p.name, ids: resolvePreset(p.projects, lookup), names: p.projects.filter((n) => lookup.has(n)) }))
    .filter((p) => p.ids.length >= 2);
}

/* ------------------------------------------------------------------- matrix */

export type MatrixKind = "money" | "count" | "ratio";

export interface MatrixMetric {
  key: string;
  label: string;
  get: (p: Project) => number | null;
  kind: MatrixKind;
  higherIsBetter: boolean;
  estimate?: boolean;
}

export const MATRIX_METRICS: MatrixMetric[] = [
  { key: "tvl", label: "TVL", get: (p) => p.tvl, kind: "money", higherIsBetter: true },
  { key: "volume", label: "30d volume", get: (p) => p.volume, kind: "money", higherIsBetter: true },
  { key: "fees", label: "30d fees", get: (p) => p.fees, kind: "money", higherIsBetter: true },
  { key: "revenue", label: "30d revenue", get: (p) => p.revenue, kind: "money", higherIsBetter: true },
  { key: "annualised", label: "Annualised revenue", get: (p) => p.live?.annualisedRevenue ?? null, kind: "money", higherIsBetter: true },
  { key: "mcap", label: "Market cap", get: (p) => p.live?.tokenMarketCap ?? null, kind: "money", higherIsBetter: true },
  { key: "ps", label: "P/S", get: (p) => p.live?.psRatio ?? null, kind: "ratio", higherIsBetter: false },
  { key: "calls7d", label: "7d function calls", get: (p) => p.live?.calls7d ?? null, kind: "count", higherIsBetter: true },
  { key: "signers7d", label: "7d signers (est.)", get: (p) => p.live?.signers7d ?? null, kind: "count", higherIsBetter: true, estimate: true },
];

export interface MatrixCell {
  value: number | null;
  /** Rank among projects in the same sector that report the metric; null when the value is null. */
  rank: number | null;
  /** How many projects in the sector report the metric. */
  of: number;
  /** Share of the sector total; null for ratios or when the total is zero. */
  share: number | null;
  best: boolean;
}

export interface MatrixRow {
  key: string;
  label: string;
  kind: MatrixKind;
  estimate: boolean;
  higherIsBetter: boolean;
  cells: MatrixCell[];
  format: (v: number | null) => string;
}

export function formatMatrixValue(kind: MatrixKind, v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  if (kind === "money") return fmtUsd(v);
  if (kind === "count") return fmtInt(v);
  return `${v.toFixed(1)}×`;
}

/** Marks the best cells in place; ties share the tag. Needs at least two values. */
function markBest<T extends { value: number | null; best: boolean }>(cells: T[], higherIsBetter: boolean): void {
  const present = cells.map((c) => c.value).filter((v): v is number => v !== null && Number.isFinite(v));
  if (present.length < 2) return;
  const target = higherIsBetter ? Math.max(...present) : Math.min(...present);
  for (const c of cells) c.best = c.value === target;
}

/** Rank and share are computed inside each project's own sector so mixed-sector comparisons stay honest. */
export function compareMatrix(selected: readonly Project[], all: readonly Project[], metrics: MatrixMetric[] = MATRIX_METRICS): MatrixRow[] {
  const bySector = new Map<string, Project[]>();
  for (const p of all) {
    const arr = bySector.get(p.sector) ?? [];
    arr.push(p);
    bySector.set(p.sector, arr);
  }
  return metrics.map((m) => {
    const cells: MatrixCell[] = selected.map((p) => {
      const value = m.get(p);
      const peers = (bySector.get(p.sector) ?? [p]).map((x) => ({ id: x.id, v: m.get(x) })).filter((x): x is { id: string; v: number } => x.v !== null && Number.isFinite(x.v));
      peers.sort((a, b) => (m.higherIsBetter ? b.v - a.v : a.v - b.v));
      const idx = value === null ? -1 : peers.findIndex((x) => x.id === p.id);
      const total = peers.reduce((a, x) => a + x.v, 0);
      const share = value !== null && m.kind !== "ratio" && total > 0 ? value / total : null;
      return { value, rank: idx === -1 ? null : idx + 1, of: peers.length, share, best: false };
    });
    markBest(cells, m.higherIsBetter);
    return { key: m.key, label: m.label, kind: m.kind, estimate: Boolean(m.estimate), higherIsBetter: m.higherIsBetter, cells, format: (v) => formatMatrixValue(m.kind, v) };
  });
}

/* ------------------------------------------------------------------- ratios */

/** a / b, or null when either side is missing or b is not positive. */
export function ratio(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return a / b;
}

export interface RatioRow {
  key: string;
  label: string;
  info: string;
  values: Array<number | null>;
  format: (v: number | null) => string;
  higherIsBetter: boolean;
  best: boolean[];
}

const perDollar = (v: number | null) => (v === null ? "—" : `$${v.toFixed(4)}`);
const times = (v: number | null) => (v === null ? "—" : `${v.toFixed(2)}×`);
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(0)}%`);
const one = (v: number | null) => (v === null ? "—" : v.toFixed(1));

/** Size-independent ratios. Every input may be null and every division is guarded. */
export function compareRatios(selected: readonly Project[], metric: MetricKey): RatioRow[] {
  const m = numericMetric(metric);
  const rows: Array<Omit<RatioRow, "best">> = [
    { key: "feesPerTvl", label: "30d fees per $1 TVL", info: "30-day fees divided by TVL: how hard the locked capital works.", values: selected.map((p) => ratio(p.fees, p.tvl)), format: perDollar, higherIsBetter: true },
    { key: "capture", label: "Revenue capture", info: "30-day revenue divided by 30-day fees: the share of fees the protocol or its token keeps.", values: selected.map((p) => ratio(p.revenue, p.fees)), format: pct, higherIsBetter: true },
    { key: "turnover", label: "30d volume / TVL", info: "30-day DEX volume divided by TVL: capital turnover.", values: selected.map((p) => ratio(p.volume, p.tvl)), format: times, higherIsBetter: true },
    {
      key: "change30",
      label: `30d change (${METRIC_SHORT[m]})`,
      info: `${METRIC_LABEL[m]} on the latest complete day versus 30 days earlier, from DefiLlama daily history.`,
      values: selected.map((p) => p.live?.change[m]?.d30 ?? null),
      format: (v) => fmtPctSigned(v),
      higherIsBetter: true,
    },
    {
      key: "callsPerTvl",
      label: "7d calls per $1M TVL",
      info: "Function calls to tracked contracts over 7 days (BigQuery) per million dollars of TVL: activity relative to size.",
      values: selected.map((p) => {
        const r = ratio(p.live?.calls7d ?? null, p.tvl);
        return r === null ? null : r * 1e6;
      }),
      format: one,
      higherIsBetter: true,
    },
  ];
  return rows.map((r) => {
    const cells = r.values.map((value) => ({ value, best: false }));
    markBest(cells, r.higherIsBetter);
    return { ...r, best: cells.map((c) => c.best) };
  });
}

export function crossSector(selected: readonly Project[]): string[] {
  return Array.from(new Set(selected.map((p) => p.sector)));
}

/* ------------------------------------------------------------------ overlay */

export interface Indexed {
  /** Index of the shared start date, or -1 when no date has data for every active series. */
  start: number;
  indexed: Array<Array<number | null>>;
  /** Positions of series that had no positive value at all. */
  skipped: number[];
}

/**
 * Index every series to 100 at the first date where each series that has any
 * data is positive. Series without data are reported in `skipped` and left null
 * so one empty project does not blank the chart.
 */
export function indexTo100(series: ReadonlyArray<ReadonlyArray<number | null>>): Indexed {
  const n = series.reduce((a, s) => Math.max(a, s.length), 0);
  const hasData = series.map((s) => s.some((v) => v !== null && v > 0));
  const active = series.filter((_, k) => hasData[k]);
  const skipped = hasData.map((h, k) => (h ? -1 : k)).filter((k) => k >= 0);
  let start = -1;
  if (active.length > 0) {
    for (let i = 0; i < n; i++) {
      if (active.every((s) => s[i] !== null && s[i] !== undefined && (s[i] as number) > 0)) {
        start = i;
        break;
      }
    }
  }
  if (start === -1) return { start, indexed: series.map((s) => s.map(() => null)), skipped };
  const indexed = series.map((s, k) => {
    if (!hasData[k]) return s.map(() => null);
    const base = s[start] as number;
    return s.map((v, i) => (i < start || v === null ? null : (v / base) * 100));
  });
  return { start, indexed, skipped };
}

/** Re-base each series on its own first positive value; results are left-aligned and may differ in length. */
export function alignByFirstData(series: ReadonlyArray<ReadonlyArray<number | null>>): Array<Array<number | null>> {
  return series.map((s) => {
    const first = s.findIndex((v) => v !== null && v > 0);
    if (first === -1) return [];
    const base = s[first] as number;
    return s.slice(first).map((v) => (v === null ? null : (v / base) * 100));
  });
}

export function seriesFor(file: SeriesFile | null, ids: readonly string[], key: SeriesKey): Array<Array<number | null>> {
  if (!file) return ids.map(() => []);
  return ids.map((id) => file.projects[id]?.[key] ?? file.dates.map(() => null));
}

/* ---------------------------------------------------------------- sentences */

/** Two or three plain sentences from the numbers; nothing is hardcoded. Empty below two projects. */
export function compareSentences(selected: readonly Project[], metric: MetricKey): string[] {
  const out: string[] = [];
  if (selected.length < 2) return out;
  const m = numericMetric(metric);
  const label = m === "tvl" ? "TVL" : METRIC_LABEL[m].toLowerCase();

  const withMetric = selected.filter((p) => p[m] !== null && (p[m] as number) > 0).sort((a, b) => (b[m] as number) - (a[m] as number));
  if (withMetric.length >= 2) {
    const [a, b] = withMetric;
    const mult = (a[m] as number) / (b[m] as number);
    const tail = mult >= 1.05 ? `${mult.toFixed(1)}× ${b.name}` : `about level with ${b.name}`;
    const rest = withMetric.length < selected.length ? ` ${selected.length - withMetric.length} of the ${selected.length} report no ${label}.` : "";
    out.push(`${a.name} leads on ${label} with ${fmtUsd(a[m])}, ${tail}.${rest}`);
  } else if (withMetric.length === 1) {
    out.push(`Only ${withMetric[0].name} reports ${label} (${fmtUsd(withMetric[0][m])}); the others have no figure.`);
  }

  const eff = selected.map((p) => ({ p, v: ratio(p.fees, p.tvl) })).filter((x): x is { p: Project; v: number } => x.v !== null && x.v > 0).sort((a, b) => b.v - a.v);
  if (eff.length >= 2) {
    const hi = eff[0];
    const lo = eff[eff.length - 1];
    out.push(`${hi.p.name} earns ${(hi.v / lo.v).toFixed(1)}× more fees per dollar of TVL than ${lo.p.name} ($${hi.v.toFixed(4)} vs $${lo.v.toFixed(4)} over 30 days).`);
  }

  const mom = selected.map((p) => ({ p, v: p.live?.change[m]?.d30 ?? null })).filter((x): x is { p: Project; v: number } => x.v !== null && Number.isFinite(x.v)).sort((a, b) => b.v - a.v);
  if (mom.length >= 2) {
    const hi = mom[0];
    const lo = mom[mom.length - 1];
    const verb = (v: number) => (Math.abs(v) < 0.0005 ? "held flat" : v > 0 ? "grew" : "shrank");
    out.push(`Over 30 days ${hi.p.name} ${verb(hi.v)} ${fmtPctSigned(hi.v)} in ${label} while ${lo.p.name} ${verb(lo.v)} ${fmtPctSigned(lo.v)}.`);
  }

  return out.slice(0, 3);
}

/* -------------------------------------------------------------------- hook */

/** Reads and writes the compare selection in the URL. Unknown ids are dropped, duplicates removed, at most four kept. */
export function useCompare() {
  const { state, setState, all } = useFilters();
  const known = useMemo(() => new Set(all.map((p) => p.id)), [all]);
  const ids = useMemo(() => normalizeSelection(state.compare, known), [state.compare, known]);
  const projects = useMemo(() => ids.map((id) => projectById(id)).filter((p): p is Project => p !== undefined), [ids]);
  const set = useCallback((next: readonly string[]) => void setState({ compare: normalizeSelection(next, known) }), [setState, known]);
  const add = useCallback((id: string) => set([...ids, id]), [ids, set]);
  const remove = useCallback((id: string) => set(ids.filter((x) => x !== id)), [ids, set]);
  const toggle = useCallback((id: string) => (ids.includes(id) ? remove(id) : add(id)), [ids, add, remove]);
  const clear = useCallback(() => set([]), [set]);
  const has = useCallback((id: string) => ids.includes(id), [ids]);
  return { ids, projects, set, add, remove, toggle, clear, has, isFull: ids.length >= COMPARE_MAX };
}
