import { daysBetween, type DateStr } from "./dates";
import { meta } from "./data";

/** Accuracy rule 4 (docs/LIVE-DATA.md): a value more than 3 days older than this build's data counts as old and shows its date. */
export const STALE_AFTER_DAYS = 3;

/** Pure form, for tests: is `asOf` more than STALE_AFTER_DAYS before `ref`? */
export function isStaleAt(asOf: string, ref: string): boolean {
  return daysBetween(asOf.slice(0, 10) as DateStr, ref.slice(0, 10) as DateStr) > STALE_AFTER_DAYS;
}

/** Against the data date of this build (meta.asOf), so a prerendered page never drifts as the clock moves. */
export function isStale(asOf: string): boolean {
  return isStaleAt(asOf, meta.asOf);
}
