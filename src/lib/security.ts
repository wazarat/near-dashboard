import type { Project } from "./types";

/**
 * Security facts without ratings (CanHav Atlas UI standard, section 10).
 * Every count comes from a structured column of the research CSV: Audits,
 * Incidents, Red Flags and Status. Whether a project was checked at all is
 * read from the Security Risk Level column being filled, never its value.
 */
export const FACT_TYPES = ["No published audit found", "Past incident", "Paused or shut down", "Noted red flag"] as const;
export type FactType = (typeof FACT_TYPES)[number];

export const FACT_HELP: Record<FactType, string> = {
  "No published audit found": "Security was checked and no published audit was found in the sources consulted. Not the same as unaudited.",
  "Past incident": "The Incidents column records at least one dated incident.",
  "Paused or shut down": "Status is Inactive or Defunct.",
  "Noted red flag": "The researcher noted a red flag in the Red Flags column, quoted in the project pop-up.",
};

export function securityChecked(p: Project): boolean {
  return p.risk !== "Not researched";
}

export function securityFacts(p: Project): FactType[] {
  const out: FactType[] = [];
  if (securityChecked(p) && !p.audits) out.push("No published audit found");
  if (p.incidents) out.push("Past incident");
  if (p.statusGroup === "Inactive" || p.statusGroup === "Defunct") out.push("Paused or shut down");
  if (p.redFlags) out.push("Noted red flag");
  return out;
}

export interface FactCount {
  fact: FactType;
  count: number;
}

export interface SectorFacts {
  sector: string;
  projects: number;
  checked: number;
  counts: Record<FactType, number>;
}

export interface SecurityAggregates {
  total: number;
  checked: number;
  notChecked: number;
  auditFound: number;
  byFact: FactCount[];
  bySector: SectorFacts[];
}

export function securityAggregates(projects: Project[]): SecurityAggregates {
  const byFact = Object.fromEntries(FACT_TYPES.map((f) => [f, 0])) as Record<FactType, number>;
  const sectors = new Map<string, SectorFacts>();
  let checked = 0;
  let auditFound = 0;
  for (const p of projects) {
    const isChecked = securityChecked(p);
    if (isChecked) checked += 1;
    if (isChecked && p.audits) auditFound += 1;
    const facts = securityFacts(p);
    for (const f of facts) byFact[f] += 1;
    const s = sectors.get(p.sector) ?? { sector: p.sector, projects: 0, checked: 0, counts: Object.fromEntries(FACT_TYPES.map((f) => [f, 0])) as Record<FactType, number> };
    s.projects += 1;
    if (isChecked) s.checked += 1;
    for (const f of facts) s.counts[f] += 1;
    sectors.set(p.sector, s);
  }
  const bySector = [...sectors.values()]
    .filter((s) => s.checked > 0 || FACT_TYPES.some((f) => s.counts[f] > 0))
    .sort((a, b) => b.checked - a.checked || b.projects - a.projects || a.sector.localeCompare(b.sector));
  return {
    total: projects.length,
    checked,
    notChecked: projects.length - checked,
    auditFound,
    byFact: FACT_TYPES.map((fact) => ({ fact, count: byFact[fact] })),
    bySector,
  };
}
