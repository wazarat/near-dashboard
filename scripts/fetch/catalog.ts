/**
 * NEAR Catalog API (api.nearcatalog.xyz). No key. The project list feeds the "Newly detected" review
 * list; per-project `contracts` are only pulled by scripts/seed-contracts.ts.
 */
import path from "node:path";
import { normalizeName, toProject } from "../../src/lib/parse";
import type { NewlyDetected } from "../../src/lib/history-types";
import { findFile, readCsv } from "../lib/csv";
import { RAW } from "../lib/paths";
import { writeJsonStable } from "../lib/store";
import type { Ctx, RunResult } from "./context";
import { createClient, type HttpClient } from "./http";

const BASE = "https://api.nearcatalog.xyz";

export interface CatalogProject {
  slug: string;
  name: string;
  tagline: string | null;
  tags: string[];
  phase: string | null;
  status: string | null;
  lncScore: number | null;
  publishedDate: string | null;
  updatedAt: string | null;
}

type RawList = Record<string, { slug: string; profile: { name: string; tagline?: string; tags?: Record<string, string>; phase?: string; status?: string; lnc?: { score?: number }; published_date?: number; updated_at?: string } }>;

export function parseCatalogList(json: RawList): CatalogProject[] {
  return Object.values(json)
    .filter((p) => p && p.slug && p.profile?.name)
    .map((p) => ({
      slug: p.slug,
      name: p.profile.name.trim(),
      tagline: p.profile.tagline?.trim() || null,
      tags: Object.values(p.profile.tags ?? {}),
      phase: p.profile.phase ?? null,
      status: p.profile.status ?? null,
      lncScore: typeof p.profile.lnc?.score === "number" ? p.profile.lnc.score : null,
      publishedDate: p.profile.published_date ? new Date(p.profile.published_date * 1000).toISOString().slice(0, 10) : null,
      updatedAt: p.profile.updated_at ?? null,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export interface CatalogDetail {
  slug: string;
  contracts: string[];
  website: string | null;
  twitter: string | null;
  github: string | null;
  dapp: string | null;
}

/**
 * Detail payload: `contracts` is an object keyed by account id (blank keys appear when the catalog
 * entry is empty) and `tokens` carries per-chain token addresses. Both feed data/contracts.csv.
 */
export function parseCatalogDetail(
  json: { slug?: string; profile?: { contracts?: Record<string, unknown> | string | string[] | null; tokens?: Record<string, { address?: { near?: string } }> | null; linktree?: Record<string, string>; dapp?: string } } | false,
): CatalogDetail | null {
  if (!json || !json.slug) return null;
  const raw = json.profile?.contracts;
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[\s,;]+/) : raw && typeof raw === "object" ? Object.keys(raw) : [];
  const tokens = Object.values(json.profile?.tokens ?? {}).map((t) => t?.address?.near ?? "");
  const ok = (s: string) => /^[a-z0-9._-]+\.(near|tg|aurora)$|^[a-f0-9]{64}$|^aurora$/.test(s);
  const contracts = Array.from(new Set([...list, ...tokens].map((s) => s.trim().toLowerCase()).filter(ok)));
  const lt = json.profile?.linktree ?? {};
  return { slug: json.slug, contracts, website: lt.website || null, twitter: lt.twitter || null, github: lt.github || null, dapp: json.profile?.dapp || null };
}

export async function fetchCatalogList(client: HttpClient): Promise<CatalogProject[]> {
  return parseCatalogList(await client.getJson<RawList>(`${BASE}/projects`));
}

export async function fetchCatalogDetail(client: HttpClient, slug: string): Promise<CatalogDetail | null> {
  return parseCatalogDetail(await client.getJson(`${BASE}/project?pid=${encodeURIComponent(slug)}`));
}

/** Catalog projects whose name or catalog URL does not match any CSV row. */
export function detectNewCatalog(list: CatalogProject[], csvNames: string[], csvSourceUrls: string[], previous: NewlyDetected[], today: string): NewlyDetected[] {
  const names = new Set(csvNames.map(normalizeName));
  const urls = new Set(csvSourceUrls);
  const firstSeen = new Map(previous.filter((n) => n.source === "catalog").map((n) => [n.slug, n.firstSeen]));
  return list
    .filter((p) => !names.has(normalizeName(p.name)) && !urls.has(`https://nearcatalog.xyz/project/${p.slug}`))
    .map((p) => ({
      source: "catalog" as const,
      slug: p.slug,
      name: p.name,
      category: p.tags.slice(0, 3).join(", ") || "Unknown",
      chain: "NEAR",
      tvl: null,
      firstSeen: firstSeen.get(p.slug) ?? today,
      url: `https://nearcatalog.xyz/project/${p.slug}`,
    }));
}

export async function run(ctx: Ctx): Promise<RunResult> {
  const client = createClient({ name: "catalog", minIntervalMs: 1000, timeoutMs: 60_000 });
  const list = await fetchCatalogList(client);
  const projects = readCsv(findFile("near-ecosystem-", ".csv")).map(toProject);
  const detected = detectNewCatalog(
    list,
    projects.map((p) => p.name),
    projects.map((p) => p.sourceUrl ?? ""),
    ctx.meta.newlyDetected,
    ctx.today,
  );
  ctx.meta.newlyDetected = [...ctx.meta.newlyDetected.filter((n) => n.source !== "catalog"), ...detected];
  if (!ctx.dryRun) writeJsonStable(path.join(RAW, "catalog", "projects.json"), { source: `${BASE}/projects`, fetchedAt: ctx.today, projects: list });
  const intents = list.filter((p) => p.tags.includes("NEAR Intents")).length;
  return { rows: list.length, calls: client.stats().calls, notes: [`${list.length} catalog projects, ${intents} tagged NEAR Intents, ${detected.length} not in the CSV`] };
}
