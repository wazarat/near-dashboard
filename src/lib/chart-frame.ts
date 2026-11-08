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
  /** last / first - 1, or null when the first finite value is zero. */
  change: number | null;
  minDate: string;
  maxDate: string;
}

/** Min, max, first, last and percent change over the visible points, ignoring blanks. null when nothing is finite. */
export function rangeStats(dates: ReadonlyArray<string>, values: ReadonlyArray<number | null | undefined>): RangeStats | null {
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
  return { min, max, first, last, change: first === 0 ? null : last / first - 1, minDate, maxDate };
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
