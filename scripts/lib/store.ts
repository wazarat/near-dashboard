/**
 * Idempotent history store helpers. A rerun with the same inputs writes
 * byte-identical files, so daily commits only contain real changes.
 */
import fs from "node:fs";
import path from "node:path";
import type { DateStr } from "../../src/lib/dates";

/** Sorted [date, value] pairs. */
export type Series = Array<[DateStr, number]>;

export interface UpsertOpts {
  /** Today's UTC date; points after it are dropped. */
  today: DateStr;
  /** Points dated inside the last N days may be overwritten (sources revise recent days). Default 3. */
  revisionDays?: number;
  /** Allow a point for `today` itself (true for stocks like TVL, false for flows that are still accruing). */
  allowToday?: boolean;
}

export function upsertSeries(existing: Series, incoming: Series, opts: UpsertOpts): Series {
  const revision = opts.revisionDays ?? 3;
  const cutoff = shiftDate(opts.today, -revision);
  const map = new Map<DateStr, number>(existing);
  for (const [d, v] of incoming) {
    if (!Number.isFinite(v)) continue;
    if (d > opts.today) continue;
    if (d === opts.today && !opts.allowToday) continue;
    if (map.has(d) && d < cutoff) continue; // frozen
    map.set(d, v);
  }
  return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

function shiftDate(d: DateStr, n: number): DateStr {
  return new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

export function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) out[k] = sortKeys((value as Record<string, unknown>)[k]);
    return out;
  }
  return value;
}

/** Deterministic JSON: sorted keys, one top-level entry per line for small diffs. */
export function stableJson(value: unknown): string {
  const sorted = sortKeys(value);
  if (sorted && typeof sorted === "object" && !Array.isArray(sorted)) {
    const entries = Object.entries(sorted as Record<string, unknown>);
    if (entries.length === 0) return "{}\n";
    return "{\n" + entries.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n") + "\n}\n";
  }
  if (Array.isArray(sorted)) {
    if (sorted.length === 0) return "[]\n";
    return "[\n" + sorted.map((v) => `  ${JSON.stringify(v)}`).join(",\n") + "\n]\n";
  }
  return JSON.stringify(sorted) + "\n";
}

/** Writes only when the content changed; returns true when it did. */
export function writeJsonStable(file: string, value: unknown): boolean {
  const next = stableJson(value);
  const prev = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (prev === next) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
  return true;
}
