/**
 * Coverage language (CanHav Atlas UI standard, section 5). A blank metric
 * means the source does not track that project. It is not a zero and not
 * unverified data, so every blank reads "Not tracked" and sums leave it out.
 */
export const NOT_TRACKED = "Not tracked";

export const NOT_TRACKED_HELP = "DefiLlama does not report this metric for these projects. This is a coverage gap, not a zero and not unverified data.";

/** A blank that is not a metric, such as no investors named or no source link. */
export const NONE = "none";

/** "Tracked for 2/13 projects", the short form a KPI tile has room for. */
export function coverageShort(tracked: number, total: number, noun = "projects"): string {
  return `Tracked for ${tracked.toLocaleString("en-US")}/${total.toLocaleString("en-US")} ${noun}`;
}

/** "Tracked for 2 of 13 projects", the sentence form. */
export function coverageLabel(tracked: number, total: number, noun = "projects"): string {
  return `Tracked for ${tracked.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} ${noun}`;
}
