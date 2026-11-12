import type { SeriesFile, SeriesKey } from "./types";

/**
 * The selection's own daily figures, for the Overview chain cards when a filter is active
 * (owner request, 2026-11-12). Summed from the per-project DefiLlama and BigQuery history in
 * series.json, which covers the last 90 days for the projects that have it. Chain totals cannot be
 * split by project, and summed protocol TVL double counts what the chain total leaves out, so a
 * selection is compared with the same sum over every project with history, never with the chain.
 */
export interface SelectionMetric {
  /** Per day, the sum over selected projects that report the metric that day; null when none does. */
  values: Array<number | null>;
  /** Per day, the same sum over every project in the file, for a like-for-like share. */
  all: Array<number | null>;
  /** Selected projects with at least one value for the metric. */
  withHistory: number;
}

export interface SelectionSeries {
  dates: string[];
  metrics: Record<SeriesKey, SelectionMetric>;
  /** Selected projects with any history at all. */
  withAnyHistory: number;
}

export const SELECTION_KEYS: readonly SeriesKey[] = ["tvl", "volume", "fees", "revenue", "calls"];

function sumDays(file: SeriesFile, ids: readonly string[], key: SeriesKey): { values: Array<number | null>; withHistory: number } {
  const values: Array<number | null> = file.dates.map(() => null);
  let withHistory = 0;
  for (const id of ids) {
    const s = file.projects[id]?.[key];
    if (!s) continue;
    let any = false;
    for (let i = 0; i < values.length; i++) {
      const v = s[i];
      if (v === null || v === undefined) continue;
      any = true;
      values[i] = (values[i] ?? 0) + v;
    }
    if (any) withHistory += 1;
  }
  return { values, withHistory };
}

/** Pure, so it is tested. `ids` are the selected projects; ids without history are skipped. */
export function selectionSeries(file: SeriesFile, ids: readonly string[]): SelectionSeries {
  const every = Object.keys(file.projects);
  const metrics = {} as Record<SeriesKey, SelectionMetric>;
  for (const key of SELECTION_KEYS) {
    const sel = sumDays(file, ids, key);
    metrics[key] = { values: sel.values, all: sumDays(file, every, key).values, withHistory: sel.withHistory };
  }
  const withAnyHistory = ids.filter((id) => {
    const p = file.projects[id];
    return p && SELECTION_KEYS.some((k) => p[k]?.some((v) => v !== null));
  }).length;
  return { dates: file.dates, metrics, withAnyHistory };
}

/** The last day on which both the selection and the whole file report a value, as a share. */
export function lastShare(m: SelectionMetric): number | null {
  for (let i = m.values.length - 1; i >= 0; i--) {
    const a = m.values[i];
    const b = m.all[i];
    if (a !== null && b !== null && b > 0) return a / b;
  }
  return null;
}

/** The sum of a flow over its last `n` days, ignoring blank days; null when every day is blank. */
export function windowSum(values: ReadonlyArray<number | null>, n: number): number | null {
  let total: number | null = null;
  for (const v of values.slice(Math.max(0, values.length - n))) if (v !== null) total = (total ?? 0) + v;
  return total;
}
