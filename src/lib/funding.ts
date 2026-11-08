import { FUNDING_ORDER, fundingBucket, fundingColor } from "./colors";
import type { Project } from "./types";

/**
 * Funding-type breakdown (standard section 9). The chart shows disclosed
 * funding only; "Not disclosed" and "Not researched" become one sentence.
 */
export interface FundingRow {
  bucket: string;
  count: number;
  /** Share of the projects with disclosed funding. */
  share: number | null;
  color: string;
}

export interface FundingBreakdown {
  rows: FundingRow[];
  total: number;
  researched: number;
  disclosed: number;
  notDisclosed: number;
  notResearched: number;
  /** "159 researched, 63 with disclosed funding, 96 not disclosed, 448 not researched". */
  sentence: string;
}

const NO_INFO = new Set(["Not researched", "Not disclosed"]);

export function fundingBreakdown(projects: Project[]): FundingBreakdown {
  const counts = new Map<string, number>();
  let researched = 0;
  let disclosed = 0;
  let notDisclosed = 0;
  for (const p of projects) {
    const types = p.fundingTypes.length ? p.fundingTypes : ["Not researched"];
    if (types.every((t) => t === "Not researched")) continue;
    researched += 1;
    const buckets = new Set(types.map(fundingBucket).filter((b) => !NO_INFO.has(b)));
    if (buckets.size === 0) {
      notDisclosed += 1;
      continue;
    }
    disclosed += 1;
    for (const b of buckets) counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  const rows = (FUNDING_ORDER as readonly string[])
    .filter((b) => counts.has(b))
    .map((b) => ({ bucket: b, count: counts.get(b) as number, share: disclosed ? (counts.get(b) as number) / disclosed : null, color: fundingColor(b) }));
  const notResearched = projects.length - researched;
  const n = (v: number) => v.toLocaleString("en-US");
  const sentence = `${n(researched)} researched, ${n(disclosed)} with disclosed funding, ${n(notDisclosed)} not disclosed, ${n(notResearched)} not researched`;
  return { rows, total: projects.length, researched, disclosed, notDisclosed, notResearched, sentence };
}
