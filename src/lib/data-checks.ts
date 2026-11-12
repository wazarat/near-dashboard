/**
 * Accuracy checks run before data is committed (docs/LIVE-DATA.md, section 1 rule 3 and requirement 8).
 * Pure, so each rule is tested. scripts/check-data.ts runs them over data/history and exits non-zero on a
 * failure; it runs in CI and in the daily refresh before the commit, not in the Vercel build, so a conflict
 * in new data never freezes the live site on old numbers.
 */
import type { Series } from "./history-types";

export interface Finding {
  rule: string;
  severity: "fail" | "review";
  message: string;
}

/** Two sources for the same headline: their sums over the last `days` shared days must agree within `tolerance`. */
export function crossCheck(name: string, a: { label: string; series: Series }, b: { label: string; series: Series }, days = 7, tolerance = 0.1): Finding | null {
  const bm = new Map(b.series);
  const shared = a.series.filter(([d]) => bm.has(d)).map(([d]) => d).sort().slice(-days);
  if (shared.length === 0) return { rule: "two-source", severity: "review", message: `${name}, ${a.label} and ${b.label} share no day yet, so they cannot be compared.` };
  const am = new Map(a.series);
  const sa = shared.reduce((s, d) => s + (am.get(d) ?? 0), 0);
  const sb = shared.reduce((s, d) => s + (bm.get(d) ?? 0), 0);
  const base = Math.max(Math.abs(sa), Math.abs(sb));
  const diff = base === 0 ? 0 : Math.abs(sa - sb) / base;
  if (diff <= tolerance) return null;
  return { rule: "two-source", severity: "fail", message: `${name}, ${a.label} ${Math.round(sa).toLocaleString("en-US")} vs ${b.label} ${Math.round(sb).toLocaleString("en-US")} over ${shared[0]} to ${shared[shared.length - 1]}, ${(diff * 100).toFixed(1)}% apart (limit ${Math.round(tolerance * 100)}%).` };
}

/**
 * Every exploit on DefiLlama's hacks list should have an Incident in the events file for the same project within
 * 45 days. One that does not is listed for review (a missing event, or a project matched wrongly); it never fails.
 */
export function hacksWithoutIncident(hacks: Array<{ project: string; name: string; date: string }>, incidents: Array<{ projectIds: string[]; date: string }>, days = 45): Finding[] {
  const ms = (d: string) => Date.parse(`${d.slice(0, 10)}T00:00:00Z`);
  return hacks
    .filter((h) => !incidents.some((e) => e.projectIds.includes(h.project) && Math.abs(ms(e.date) - ms(h.date)) <= days * 86_400_000))
    .map((h) => ({ rule: "hack-without-incident", severity: "review" as const, message: `${h.name} exploit on ${h.date} (DefiLlama hacks) has no Incident event for that project within ${days} days.` }));
}

/**
 * Gas fees missing (no value, or a reported 0) on days the chain still had transactions. More than `maxDays`
 * in a row within the last `windowDays` means the fee source has stopped, not that the chain did. Older gaps
 * (NEAR's 2020 history has some) are history, not an outage.
 */
export function gasFeeOutage(chain: string, gasFees: Series, txns: Series, maxDays = 3, windowDays = 30): Finding | null {
  // A series never fetched yet (the first refresh after the source was added) is a note, not an outage.
  if (gasFees.length === 0) return { rule: "gas-fee-outage", severity: "review", message: `${chain} gas fees have no history yet; the next refresh fetches them.` };
  const fees = new Map(gasFees);
  let run: string[] = [];
  let worst: string[] = [];
  const recent = [...txns].sort((x, y) => (x[0] < y[0] ? -1 : 1)).slice(-windowDays);
  for (const [d, t] of recent) {
    if (!(t > 0)) {
      run = [];
      continue;
    }
    const f = fees.get(d);
    if (f === undefined || f === 0) {
      run = [...run, d];
      if (run.length > worst.length) worst = run;
    } else run = [];
  }
  if (worst.length <= maxDays) return null;
  return { rule: "gas-fee-outage", severity: "fail", message: `${chain} gas fees are missing for ${worst.length} days in a row (${worst[0]} to ${worst[worst.length - 1]}) while the chain had transactions.` };
}
