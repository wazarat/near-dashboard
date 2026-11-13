import { rangeDays, type Range } from "./ranges";

/**
 * Pure helpers behind the expandable chart frame (CanHav Atlas UI standard,
 * section 6). Level series (TVL, price, a ratio) get a fitted y axis with
 * about 10% padding so small moves are readable; flow series start at zero.
 */

/** Fitted domain with `pad` of the span on each side. Positive data never dips below zero. undefined when nothing is finite. */
export function fittedDomain(values: ReadonlyArray<number | null | undefined>, pad = 0.1): [number, number] | undefined {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min)) return undefined;
  if (min === max) {
    if (min === 0) return [0, 1];
    const lo = min > 0 ? min * (1 - pad) : min * (1 + pad);
    const hi = min > 0 ? min * (1 + pad) : min * (1 - pad);
    return [lo, hi];
  }
  const span = max - min;
  let lo = min - span * pad;
  const hi = max + span * pad;
  if (min >= 0) lo = Math.max(0, lo);
  return [lo, hi];
}

export interface RangeStats {
  min: number;
  max: number;
  first: number;
  last: number;
  /**
   * last / start - 1. The start is the first point unless that point is too small to compare with (under 1% of the
   * last value, or under `minStart`): then it is the first day the series reached that bar, given in `changeSince`,
   * so a series that began near zero never reads as "+7,000,000%". null when no day reaches the bar.
   */
  change: number | null;
  /** The date the change is measured from, when it is not the first point. */
  changeSince: string | null;
  minDate: string;
  maxDate: string;
}

/** Min, max, first, last and percent change over the visible points, ignoring blanks. null when nothing is finite. */
export function rangeStats(dates: ReadonlyArray<string>, values: ReadonlyArray<number | null | undefined>, opts: { minStart?: number } = {}): RangeStats | null {
  let first: number | null = null;
  let last: number | null = null;
  let min = Infinity;
  let max = -Infinity;
  let minDate = "";
  let maxDate = "";
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    if (first === null) first = v;
    last = v;
    if (v < min) {
      min = v;
      minDate = dates[i] ?? "";
    }
    if (v > max) {
      max = v;
      maxDate = dates[i] ?? "";
    }
  }
  if (first === null || last === null) return null;
  const bar = Math.max(Math.abs(last) * 0.01, opts.minStart ?? 0);
  let change: number | null = null;
  let changeSince: string | null = null;
  if (first !== 0 && Math.abs(first) >= bar) change = last / first - 1;
  else {
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v === null || v === undefined || !Number.isFinite(v) || v === 0 || Math.abs(v) < bar) continue;
      change = last / v - 1;
      changeSince = dates[i] ?? null;
      break;
    }
  }
  return { min, max, first, last, change, changeSince, minDate, maxDate };
}

/** A money level series is compared only from a start of at least $1M (and 1% of the last value). */
export const MIN_USD_START = 1e6;

/** "+80.7% over 2306 days", or "+80.7% since 2021-03-04" when the start had to move, or nothing when no day qualifies. */
export function changePhrase(stats: RangeStats, days: number, fmtPct: (v: number | null) => string, fmtDay: (d: string) => string): string {
  if (stats.change === null) return `over ${days} days`;
  return stats.changeSince ? `${fmtPct(stats.change)} since ${fmtDay(stats.changeSince)}` : `${fmtPct(stats.change)} over ${days} days`;
}

/** Level series show at least 90 days so there is shape to read; All stays All. Never more than the data has. */
export function levelWindow(range: Range, available: number): number {
  if (range === "all") return Math.max(1, available);
  return Math.max(1, Math.min(available, Math.max(90, rangeDays(range, available))));
}

/** React 19 ids contain characters an SVG url(#id) reference cannot carry. */
export function sanitizeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, "");
}

/** Slice a series to the brush window, when there is one. */
export function brushSlice<T>(arr: ReadonlyArray<T>, brush: [number, number] | null): T[] {
  if (!brush) return [...arr];
  const [a, b] = brush;
  return arr.slice(Math.max(0, a), Math.min(arr.length, b + 1));
}

/**
 * Where a panel's data starts within the range. A series that begins later than the range (Aurora transactions
 * from BigQuery, the one-year BigQuery panels on an All-history axis) would otherwise be squeezed into a spike
 * at the right edge; the panel clips its x axis to this index and labels it with `from`.
 */
export function dataStart(dates: ReadonlyArray<string>, ...series: Array<ReadonlyArray<number | null | undefined> | undefined>): { start: number; from: string | null } {
  for (let i = 0; i < dates.length; i++) {
    if (series.some((s) => s && s[i] !== null && s[i] !== undefined && Number.isFinite(s[i] as number))) return { start: i, from: i > 0 ? dates[i] : null };
  }
  return { start: 0, from: null };
}
