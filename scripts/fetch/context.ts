import type { DateStr } from "../../src/lib/dates";
import type { HistoryMeta, SourceId } from "../../src/lib/history-types";

export interface Ctx {
  mode: "daily" | "backfill";
  today: DateStr;
  nowMs: number;
  meta: HistoryMeta;
  env: Record<string, string | undefined>;
  dryRun: boolean;
  /** Per-run cap on paginated API calls (Intents) so a scheduled run stays inside its time budget. */
  maxCalls: number;
}

export interface RunResult {
  rows: number;
  calls: number;
  /** Bytes processed (BigQuery only). */
  bytes?: number;
  notes: string[];
}

export interface Source {
  id: SourceId;
  run: (ctx: Ctx) => Promise<RunResult>;
}

export function skipped(reason: string): RunResult {
  return { rows: 0, calls: 0, notes: [`skipped: ${reason}`] };
}
