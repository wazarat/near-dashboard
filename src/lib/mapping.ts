/**
 * Project <-> DefiLlama mapping helpers (pure).
 * data/defillama-map.csv has one row per slug: Project, DefiLlama slug, Chain, Role, Notes.
 * Role: tvl (default) | cex-reserves (feeds the CEX signal, never TVL) | chain-fees (chain-level fee row) | ignore.
 */
import type { DateStr } from "./dates";
import type { LlamaProtocolSnap, NewlyDetected, Series } from "./history-types";
import type { RawRow } from "./parse";

export type MapRole = "tvl" | "cex-reserves" | "chain-fees" | "ignore";

export interface MapRow {
  project: string | null;
  slug: string;
  chain: "near" | "aurora" | "both";
  role: MapRole;
  notes: string;
}

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\b(protocol|finance|labs|network|exchange|dao|dex|classic|v[0-9])\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function parseMapRows(rows: RawRow[]): MapRow[] {
  const out: MapRow[] = [];
  for (const r of rows) {
    const slug = (r["DefiLlama slug"] ?? "").trim();
    if (!slug) continue;
    const project = (r["Project"] ?? "").trim();
    const chainRaw = (r["Chain"] ?? "both").trim().toLowerCase();
    const roleRaw = (r["Role"] ?? "tvl").trim().toLowerCase();
    const chain = chainRaw === "near" || chainRaw === "aurora" ? chainRaw : "both";
    const role: MapRole = roleRaw === "cex-reserves" || roleRaw === "chain-fees" || roleRaw === "ignore" ? roleRaw : "tvl";
    out.push({ project: project && role !== "ignore" ? project : null, slug, chain, role, notes: (r["Notes"] ?? "").trim() });
  }
  return out;
}

/** Project name -> map rows (exact CSV project names). */
export function rowsByProject(map: MapRow[]): Map<string, MapRow[]> {
  const m = new Map<string, MapRow[]>();
  for (const r of map) {
    if (!r.project) continue;
    const arr = m.get(r.project) ?? [];
    if (!arr.some((x) => x.slug === r.slug)) arr.push(r);
    m.set(r.project, arr);
  }
  return m;
}

export function mappedSlugs(map: MapRow[]): Set<string> {
  return new Set(map.filter((r) => r.project).map((r) => r.slug));
}

/** Protocols on NEAR or Aurora that no map row covers (mapped or ignored). */
export function newlyDetected(protocols: LlamaProtocolSnap[], map: MapRow[], previous: NewlyDetected[], today: DateStr): NewlyDetected[] {
  const covered = new Set(map.map((r) => r.slug));
  const firstSeen = new Map(previous.filter((n) => n.source === "defillama").map((n) => [n.slug, n.firstSeen]));
  return protocols
    .filter((p) => !covered.has(p.slug))
    .map((p) => ({
      source: "defillama" as const,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chain: [p.tvlNear !== null ? "NEAR" : null, p.tvlAurora !== null ? "Aurora" : null].filter(Boolean).join(", ") || "NEAR",
      tvl: Math.round((p.tvlNear ?? 0) + (p.tvlAurora ?? 0)),
      firstSeen: firstSeen.get(p.slug) ?? today,
      url: `https://defillama.com/protocol/${p.slug}`,
    }))
    .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0) || a.name.localeCompare(b.name));
}

/** Map slugs that no longer appear in any DefiLlama listing. */
export function unmatchedMapSlugs(map: MapRow[], protocols: LlamaProtocolSnap[]): string[] {
  const have = new Set(protocols.map((p) => p.slug));
  return Array.from(new Set(map.map((r) => r.slug).filter((s) => !have.has(s)))).sort();
}

/** Sum several daily series by date (dates present in any series). */
export function sumSeries(list: Series[]): Series {
  const m = new Map<string, number>();
  for (const s of list) for (const [d, v] of s) m.set(d, (m.get(d) ?? 0) + v);
  return Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}
