/**
 * Build-time validation. Static facts must match exactly (failure);
 * live totals are sanity-checked (warnings, except impossible values).
 */
export interface Expected {
  static: Record<string, number>;
  snapshot: Record<string, number>;
  liveSanity?: { maxDayOverDayRatio?: number };
}

export interface Actual {
  static: Record<string, number>;
  snapshot: Record<string, number>;
  live: Record<string, number | null>;
  liveVsSnapshot: Record<string, number | null>;
  dayOverDay: Record<string, number | null>;
  sourceErrors: string[];
  lastRunAgeDays: number | null;
}

export interface ValidationResult {
  failures: string[];
  warnings: string[];
  rows: Array<{ group: string; key: string; expected: string; actual: string; ok: boolean }>;
}

export function validate(expected: Expected, actual: Actual): ValidationResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  const rows: ValidationResult["rows"] = [];
  for (const [key, exp] of Object.entries(expected.static)) {
    const act = actual.static[key];
    const ok = act === exp;
    rows.push({ group: "static", key, expected: String(exp), actual: String(act), ok });
    if (!ok) failures.push(`static.${key} expected ${exp}, got ${act}`);
  }
  for (const [key, exp] of Object.entries(expected.snapshot)) {
    const act = actual.snapshot[key];
    const ok = act === exp;
    rows.push({ group: "snapshot", key, expected: String(exp), actual: String(act), ok });
    if (!ok) failures.push(`snapshot.${key} expected ${exp}, got ${act}`);
  }
  const maxRatio = expected.liveSanity?.maxDayOverDayRatio ?? 10;
  for (const [key, v] of Object.entries(actual.live)) {
    if (v === null) {
      rows.push({ group: "live", key, expected: "≥ 0", actual: "no data", ok: true });
      continue;
    }
    const ok = Number.isFinite(v) && v >= 0;
    rows.push({ group: "live", key, expected: "≥ 0", actual: String(Math.round(v)), ok });
    if (!ok) failures.push(`live.${key} is ${v}`);
  }
  for (const [key, r] of Object.entries(actual.liveVsSnapshot)) {
    if (r === null) continue;
    if (r > maxRatio || r < 1 / maxRatio) warnings.push(`live ${key} is ${r.toFixed(2)}× the snapshot value`);
  }
  for (const [key, r] of Object.entries(actual.dayOverDay)) {
    if (r === null) continue;
    if (r > maxRatio || r < 1 / maxRatio) warnings.push(`chain ${key} jumped ${r.toFixed(2)}× day over day`);
  }
  for (const e of actual.sourceErrors) warnings.push(`source ${e}`);
  if (actual.lastRunAgeDays !== null && actual.lastRunAgeDays > 3) warnings.push(`last refresh is ${actual.lastRunAgeDays} days old`);
  return { failures, warnings, rows };
}
