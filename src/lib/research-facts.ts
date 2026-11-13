/**
 * Facts for unmeasured sectors that come from the research files rather than a live source
 * (docs/SECTOR-METRICS.md, section 3): how many atlas projects name a security firm in their audits column, and the
 * disclosed rounds an ecosystem organisation joined as an investor.
 */
import type { Investor, Project } from "./types";

const SECURITY = "Security, Risk & Compliance";
const ECOSYSTEM = "Ecosystem, Funding & Education";

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The names a firm goes by in the audits column: its name, and the part before a parenthesis ("Hacken (HackenProof)" gives both). */
function aliases(name: string): string[] {
  const base = name.replace(/\s*\(.*\)\s*$/, "").trim();
  const inner = /\(([^)]+)\)/.exec(name)?.[1]?.trim();
  return Array.from(new Set([name, base, inner].filter((s): s is string => Boolean(s && s.length >= 3))));
}

/**
 * Projects (other than the firm itself) whose audits text names the firm as a whole word, so "Hacken" does not
 * match "HackenProof". Only for Security sector projects; null elsewhere.
 */
export function auditedProjectsCount(firm: Pick<Project, "id" | "name" | "sector">, all: readonly Pick<Project, "id" | "audits">[]): number | null {
  if (firm.sector !== SECURITY) return null;
  const re = new RegExp(`(?<![\\w-])(?:${aliases(firm.name).map(escape).join("|")})(?![\\w-])`, "i");
  return all.filter((p) => p.id !== firm.id && p.audits && re.test(p.audits)).length;
}

/** Total size of the disclosed rounds an ecosystem organisation joined, from the investor aggregate. Null outside the sector or with none. */
export function fundingDisclosedFor(org: Pick<Project, "id" | "name" | "sector">, investors: readonly Pick<Investor, "id" | "name" | "totalDisclosed" | "disclosedDeals">[]): number | null {
  if (org.sector !== ECOSYSTEM) return null;
  const inv = investors.find((i) => i.id === org.id || i.name === org.name);
  return inv && inv.disclosedDeals > 0 ? inv.totalDisclosed : null;
}
