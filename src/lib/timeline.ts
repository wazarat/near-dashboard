import type { EcosystemEvent, EventType } from "./types";

/** Each atlas sets the date its timeline opens on. Events before it stay one click away (standard section 8). */
export const TIMELINE_DEFAULT_START = "2024-01-01";

export interface TimelineSplit {
  /** Events on or after the default start, in input order. */
  shown: EcosystemEvent[];
  /** Events before it, collapsed behind "Show earlier events". */
  earlier: EcosystemEvent[];
}

export function splitTimeline(events: EcosystemEvent[], defaultStart: string): TimelineSplit {
  const shown: EcosystemEvent[] = [];
  const earlier: EcosystemEvent[] = [];
  for (const e of events) (e.date < defaultStart ? earlier : shown).push(e);
  return { shown, earlier };
}

/** Counts per type for the legend chips and the summary line. */
export function countByType(events: EcosystemEvent[], order: readonly EventType[]): Array<{ type: EventType; count: number }> {
  return order.map((type) => ({ type, count: events.filter((e) => e.type === type).length }));
}
