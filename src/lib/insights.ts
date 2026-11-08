import { fmtPct, METRIC_LABEL } from "./format";
import { concentration, nativeShare, topNShare } from "./metrics";
import type { MetricKey, NumericMetricKey, Project } from "./types";

export interface Insight {
  id: string;
  text: string;
}

function pct(v: number | null): string {
  return fmtPct(v, 0);
}

/**
 * Short sentences computed from the current selection. Pure and deterministic
 * so they can be tested; nothing here is hardcoded to the Nov 2026 numbers.
 */
export function generateInsights(projects: Project[], metric: MetricKey): Insight[] {
  const out: Insight[] = [];
  const n = projects.length;
  if (n === 0) return [{ id: "empty", text: "No projects match the current filters." }];

  const focus: NumericMetricKey = metric === "count" ? "tvl" : metric;
  const focusLabel = METRIC_LABEL[focus];

  const curve = concentration(projects, focus);
  if (curve.length >= 3) {
    const top3 = topNShare(curve, 3);
    const top10 = curve.length >= 10 ? topNShare(curve, 10) : null;
    out.push({
      id: "concentration",
      text: `Top 3 projects hold ${pct(top3)} of ${focusLabel} in this selection` + (top10 !== null ? `, the top 10 hold ${pct(top10)}.` : "."),
    });
  } else if (curve.length > 0) {
    out.push({
      id: "concentration",
      text: `Only ${curve.length} project${curve.length === 1 ? "" : "s"} in this selection report${curve.length === 1 ? "s" : ""} ${focusLabel}.`,
    });
  }

  if (curve.length >= 2) {
    const lead = curve[0];
    out.push({ id: "leader", text: `${lead.name} alone is ${pct(lead.share)} of ${focusLabel} here.` });
  }

  const nativeCount = projects.filter((p) => p.chain === "NEAR native").length;
  const nativeFees = nativeShare(projects, "fees");
  const nativeTvl = nativeShare(projects, "tvl");
  if (nativeCount > 0 && nativeCount < n && (nativeFees !== null || nativeTvl !== null)) {
    const parts: string[] = [];
    if (nativeTvl !== null) parts.push(`hold ${pct(nativeTvl)} of TVL`);
    if (nativeFees !== null) parts.push(`earn ${pct(nativeFees)} of fees`);
    out.push({ id: "native", text: `NEAR-native projects are ${pct(nativeCount / n)} of the selection but ${parts.join(" and ")}.` });
  } else if (nativeCount === n) {
    out.push({ id: "native", text: `Every project in this selection is NEAR-native.` });
  } else if (nativeCount === 0) {
    out.push({ id: "native", text: `No NEAR-native projects in this selection.` });
  }

  const live = projects.filter((p) => p.hasTraction).length;
  out.push({ id: "live", text: `${live} of ${n} projects (${pct(live / n)}) show any measurable TVL, volume, fees or revenue.` });

  const legacy = projects.filter((p) => p.statusGroup === "Legacy listing").length;
  if (legacy > 0 && legacy / n > 0.2) {
    out.push({ id: "legacy", text: `${legacy} listings (${pct(legacy / n)}) come only from the 2021 to 2023 AwesomeNEAR directory, with unknown current status.` });
  }

  const sectors = new Map<string, { total: number; live: number }>();
  for (const p of projects) {
    const s = sectors.get(p.sector) ?? { total: 0, live: 0 };
    s.total += 1;
    if (p.hasTraction) s.live += 1;
    sectors.set(p.sector, s);
  }
  if (sectors.size > 1) {
    const [name, s] = Array.from(sectors.entries()).sort((a, b) => b[1].total - a[1].total)[0];
    out.push({ id: "sector", text: `${name} is the largest sector with ${s.total} projects, ${s.live} of them with any traction.` });
  }

  const withCapture = projects.filter((p) => p.revenueCapture !== null && (p.fees ?? 0) >= 10_000);
  if (withCapture.length >= 3) {
    const sorted = [...withCapture].sort((a, b) => (b.revenueCapture as number) - (a.revenueCapture as number));
    const hi = sorted[0];
    const lo = sorted[sorted.length - 1];
    out.push({ id: "capture", text: `Revenue capture ranges from ${pct(lo.revenueCapture)} (${lo.name}) to ${pct(hi.revenueCapture)} (${hi.name}) of fees.` });
  }

  const researched = projects.filter((p) => p.fundingType !== "Not researched").length;
  const checked = projects.filter((p) => p.risk !== "Not researched");
  const withIncident = checked.filter((p) => p.incidents).length;
  const noAudit = checked.filter((p) => !p.audits).length;
  if (researched > 0) {
    out.push({ id: "coverage", text: `${researched} of ${n} were researched for funding and ${checked.length} for security; ${withIncident} record a past incident and ${noAudit} have no published audit found.` });
  }

  const t1 = projects.filter((p) => p.tier === "Tier 1 - Leader").length;
  if (t1 > 0 && out.length < 7) out.push({ id: "tier1", text: `${t1} Tier 1 leader${t1 === 1 ? "" : "s"} in this selection.` });

  return out.slice(0, 7);
}
