export type DateStr = string; // YYYY-MM-DD, UTC

export function isDateStr(v: string): v is DateStr {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function dateOf(d: Date): DateStr {
  return d.toISOString().slice(0, 10);
}

export function dateOfMs(ms: number): DateStr {
  return dateOf(new Date(ms));
}

export function dateOfUnix(sec: number): DateStr {
  return dateOf(new Date(sec * 1000));
}

export function utcToday(): DateStr {
  return dateOf(new Date());
}

export function toUnixDay(d: DateStr): number {
  return Math.floor(Date.parse(`${d}T00:00:00Z`) / 1000);
}

export function addDays(d: DateStr, n: number): DateStr {
  return dateOfMs(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000);
}

export function daysBetween(a: DateStr, b: DateStr): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function dateRange(start: DateStr, end: DateStr): DateStr[] {
  const out: DateStr[] = [];
  if (start > end) return out;
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function isoNow(): string {
  return new Date().toISOString();
}

/** Monday of the ISO week that contains d. */
export function weekStart(d: DateStr): DateStr {
  const dt = new Date(`${d}T00:00:00Z`);
  const dow = (dt.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(d, -dow);
}

export function monthLabel(d: DateStr): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
