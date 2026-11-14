/**
 * Part B of the thesis tests (B1 to B6). Each test is computed from committed files only and judged by the rule
 * pre-registered in THESIS.md.
 */
import type { DateStr } from "../../src/lib/dates";
import type { ChainHistory, IntentsDay, Series } from "../../src/lib/history-types";
import type { RelatedTest } from "../../src/lib/thesis-types";
import type { EcosystemEvent } from "../../src/lib/types";

export interface RelatedCtx {
  chain: ChainHistory;
  start: DateStr;
  end: DateStr;
  cutoff: DateStr;
  explorerDays: IntentsDay[];
  xIntents: Series;
  xPrice: Series;
  maxLag: number;
  /** Weekly log changes of total transactions, the headline series B1 compares with. */
  txnsWeekly: Series;
  txnsIntentsR: number | null;
  events: EcosystemEvent[];
}

export function relatedTests(ctx: RelatedCtx): RelatedTest[] {
  void ctx;
  return [];
}
