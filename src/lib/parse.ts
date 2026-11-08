/**
 * Pure parsing helpers shared by the build script and the unit tests.
 * No Node or browser APIs here.
 */
import {
  CHAIN_PRESENCE,
  CONFIDENCE,
  EVENT_TYPES,
  NATIVE_CHAINS,
  RISK_LEVELS,
  TIERS,
  type ChainPresence,
  type Confidence,
  type EcosystemEvent,
  type EventType,
  type Investor,
  type Leader,
  type MemoInsight,
  type MetricSource,
  type NativeChain,
  type Project,
  type RiskLevel,
  type Round,
  type StatusGroup,
  type Tier,
} from "./types";

export type RawRow = Record<string, string | undefined>;

export function clean(v: string | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/** Blank means "no data", never zero. Accepts "1,234", "$1,234", "1234.5". */
export function parseNumber(v: string | undefined | null): number | null {
  const t = clean(v);
  if (t === null) return null;
  const n = Number(t.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n)) throw new Error(`Not a number: "${v}"`);
  return n;
}

export function splitList(v: string | undefined | null, sep: string | RegExp = ";"): string[] {
  const t = clean(v);
  if (t === null) return [];
  return t
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Lower-cased, punctuation-free key used to match names across files. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function statusGroup(status: string): StatusGroup {
  const s = status.toLowerCase();
  if (s.startsWith("mainnet")) return "Mainnet";
  if (s.startsWith("testnet")) return "Testnet";
  if (s.startsWith("building")) return "Building";
  if (s.startsWith("inactive")) return "Inactive";
  if (s.startsWith("defunct")) return "Defunct";
  if (s.includes("legacy")) return "Legacy listing";
  return "Unknown";
}

const UNDISCLOSED = new Set(["unknown", "none disclosed", "undisclosed", "n/a", "na", "not disclosed", "none", "not researched"]);

/** True when the Amount Raised cell carries an actual figure. */
export function isAmountDisclosed(v: string | null): boolean {
  if (v === null) return false;
  const s = v.trim().toLowerCase();
  if (UNDISCLOSED.has(s)) return false;
  if (/^(undisclosed|n\/a|unknown|none disclosed|not disclosed)\b/.test(s)) return false;
  return /\d/.test(s);
}

const NO_TOKEN = new Set(["none", "unknown", "none confirmed", "n/a", "-", "no token", "not researched"]);

export function normalizeToken(v: string | null): string | null {
  if (v === null) return null;
  return NO_TOKEN.has(v.trim().toLowerCase()) ? null : v.trim();
}

function oneOf<T extends readonly string[]>(list: T, v: string | null, field: string, name: string): T[number] {
  if (v !== null && (list as readonly string[]).includes(v)) return v as T[number];
  throw new Error(`Row "${name}": unexpected ${field} value "${v}"`);
}

export function parsePresence(v: string | undefined | null): ChainPresence[] {
  return splitList(v, ",").filter((p): p is ChainPresence => (CHAIN_PRESENCE as readonly string[]).includes(p));
}

/** Accepts YYYY-MM-DD or YYYY-MM. Month-only values land on the first of the month. */
export function parseDate(v: string | undefined | null): { date: string; monthOnly: boolean } | null {
  const t = clean(v);
  if (t === null) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return { date: t, monthOnly: false };
  if (/^\d{4}-\d{2}$/.test(t)) return { date: `${t}-01`, monthOnly: true };
  throw new Error(`Bad date "${v}"`);
}

export function toProject(row: RawRow): Project {
  const name = clean(row["Project/Company Name"]);
  if (!name) throw new Error("Row without a project name");

  const tvl = parseNumber(row["TVL on NEAR + Aurora (USD)"]);
  const tvlNear = parseNumber(row["TVL on NEAR (USD)"]);
  const tvlAurora = parseNumber(row["TVL on Aurora (USD)"]);
  const volume = parseNumber(row["30d DEX Volume (USD)"]);
  const fees = parseNumber(row["30d Fees (USD)"]);
  const revenue = parseNumber(row["30d Revenue (USD)"]);

  const tier = oneOf(TIERS, clean(row["Traction Tier"]), "Traction Tier", name) as Tier;
  const src = (v: number | null): MetricSource => (v === null ? "none" : "snapshot");
  const fundingType = clean(row["Funding Type"]) ?? "Not researched";
  const amountRaised = clean(row["Amount Raised"]);
  const tokenRaw = clean(row["Token"]);
  const status = clean(row["Status"]) ?? "Unknown";
  const discoveredVia = clean(row["Discovered Via"]) ?? "Unknown";

  return {
    id: slugify(name),
    name,
    website: clean(row["Website"]),
    sector: clean(row["Sector/Category"]) ?? "Other",
    subcategory: clean(row["Subcategory"]),
    chain: oneOf(NATIVE_CHAINS, clean(row["Native Chain"]), "Native Chain", name) as NativeChain,
    chainDetail: clean(row["Native Chain Detail"]),
    chainConfidence: oneOf(CONFIDENCE, clean(row["Native Chain Confidence"]), "Native Chain Confidence", name) as Confidence,
    presence: parsePresence(row["Chain Presence"]),
    tier,
    tvl,
    tvlNear,
    tvlAurora,
    volume,
    fees,
    revenue,
    otherTraction: clean(row["Other Traction Signal"]),
    tractionSources: splitList(row["Traction Source"]),
    fundingType,
    fundingTypes: splitList(fundingType),
    investors: clean(row["Investors / Backers"]),
    amountRaised,
    amountDisclosed: isAmountDisclosed(amountRaised),
    token: normalizeToken(tokenRaw),
    tokenRaw,
    fundingSourceUrl: clean(row["Funding Source URL"]),
    risk: oneOf(RISK_LEVELS, clean(row["Security Risk Level"]), "Security Risk Level", name) as RiskLevel,
    audits: clean(row["Audits"]),
    incidents: clean(row["Incidents"]),
    redFlags: clean(row["Red Flags"]),
    securitySourceUrl: clean(row["Security Source URL"]),
    description: clean(row["Description"]) ?? "",
    status,
    statusGroup: statusGroup(status),
    xHandle: clean(row["X Handle"]),
    discoveredVia,
    discoveredViaList: splitList(discoveredVia),
    sourceUrl: clean(row["Source URL"]),
    hasTraction: [tvl, volume, fees, revenue].some((v) => v !== null),
    revenueCapture: fees !== null && revenue !== null && fees > 0 ? revenue / fees : null,
    leaderRank: null,
    snapshot: { tvl, tvlNear, tvlAurora, volume, fees, revenue, tier, asOf: "" },
    live: null,
    metricSource: { tvl: src(tvl), volume: src(volume), fees: src(fees), revenue: src(revenue) },
    contracts: [],
  };
}

/** Resolves a free-text project reference to a project id: exact → alias table → normalized name. */
export class NameResolver {
  private byExact = new Map<string, string>();
  private byNorm = new Map<string, string>();
  private aliases = new Map<string, string>();
  constructor(projects: Array<{ id: string; name: string }>, aliasRows: Array<{ alias: string; project: string }> = []) {
    for (const p of projects) {
      this.byExact.set(p.name.toLowerCase(), p.id);
      const n = normalizeName(p.name);
      if (!this.byNorm.has(n)) this.byNorm.set(n, p.id);
    }
    for (const a of aliasRows) {
      const id = this.byExact.get(a.project.toLowerCase());
      if (id) this.aliases.set(a.alias.toLowerCase(), id);
    }
  }
  resolve(name: string): string | null {
    const k = name.trim().toLowerCase();
    return this.byExact.get(k) ?? this.aliases.get(k) ?? this.byNorm.get(normalizeName(name)) ?? null;
  }
}

export function toLeader(row: RawRow, resolver: NameResolver): Leader {
  const name = clean(row["Project/Company Name"]) ?? "";
  const rank = parseNumber(row["Rank in Sector"]);
  if (rank === null) throw new Error(`Leader "${name}" has no rank`);
  return {
    sector: clean(row["Sector/Category"]) ?? "Other",
    rank,
    name,
    projectId: resolver.resolve(name),
    website: clean(row["Website"]),
    why: clean(row["Why It Leads"]) ?? "",
    status: clean(row["Status"]) ?? "Unknown",
    xHandle: clean(row["X Handle"]),
    evidenceUrl: clean(row["Evidence Source"]),
  };
}

export function toEvent(row: RawRow, index: number, resolver: NameResolver): EcosystemEvent {
  const projects = splitList(row["Projects"]);
  const type = clean(row["Event Type"]);
  if (!type || !(EVENT_TYPES as readonly string[]).includes(type)) {
    throw new Error(`Event ${index}: unexpected Event Type "${type}"`);
  }
  const parsed = parseDate(row["Date"]);
  if (!parsed) throw new Error(`Event ${index}: missing date`);
  const title = clean(row["Title"]) ?? "";
  return {
    id: `${parsed.date}-${slugify(title || String(index))}`,
    date: parsed.date,
    monthOnly: parsed.monthOnly,
    type: type as EventType,
    title,
    projects,
    projectIds: Array.from(new Set(projects.map((p) => resolver.resolve(p)).filter((p): p is string => Boolean(p)))),
    amount: parseNumber(row["Amount (USD)"]),
    amountNote: clean(row["Amount Note"]),
    detail: clean(row["Detail"]),
    sourceUrl: clean(row["Source URL"]),
  };
}

export const ROUND_BUCKETS = ["Seed / pre-seed", "Series A+", "Strategic / private", "Token sale", "Grant", "Public market", "Acquisition", "Other"] as const;

export function roundBucket(roundType: string): (typeof ROUND_BUCKETS)[number] {
  const s = roundType.toLowerCase();
  if (s.includes("pre-seed") || s.includes("seed")) return "Seed / pre-seed";
  if (/series\s+[a-z]/.test(s)) return "Series A+";
  if (s.includes("grant")) return "Grant";
  if (s.includes("acqui")) return "Acquisition";
  if (s.includes("pipe") || s.includes("protocol raise") || s.includes("ipo")) return "Public market";
  if (s.includes("token") || s.includes("nft sale") || s.includes("community raise") || s.includes("ido")) return "Token sale";
  if (s.includes("strategic") || s.includes("private")) return "Strategic / private";
  return "Other";
}

export function toRound(row: RawRow, index: number, resolver: NameResolver): Round {
  const project = clean(row["Project"]);
  if (!project) throw new Error(`Round ${index}: missing project`);
  const parsed = parseDate(row["Date"]);
  const roundType = clean(row["Round Type"]) ?? "Unknown";
  const leadInvestors = splitList(row["Lead Investors"]);
  const otherInvestors = splitList(row["Other Investors"]);
  const confidence = clean(row["Confidence"]) ?? "Unknown";
  return {
    id: `${parsed?.date ?? "undated"}-${slugify(project)}-${slugify(roundType)}-${index}`,
    project,
    projectId: resolver.resolve(project),
    roundType,
    roundBucket: roundBucket(roundType),
    date: parsed?.date ?? null,
    monthOnly: parsed?.monthOnly ?? false,
    amount: parseNumber(row["Amount (USD)"]),
    amountNote: clean(row["Amount Note"]),
    leadInvestors,
    otherInvestors,
    investors: Array.from(new Set([...leadInvestors, ...otherInvestors])),
    nearRelated: clean(row["NEAR Related"]) ?? "Unknown",
    confidence,
    sourced: confidence === "Sourced",
    sourceUrl: clean(row["Source URL"]),
  };
}

const NOT_AN_INVESTOR = /^(investors not named|developed with|\d+ backers|.*institutional investors\)?$)/i;

/** Aggregates rounds into investors. Parenthetical notes like "(28 institutional investors)" are stripped. */
export function aggregateInvestors(rounds: Round[]): Investor[] {
  const m = new Map<string, Investor>();
  for (const r of rounds) {
    const seen = new Set<string>();
    const add = (raw: string, lead: boolean) => {
      const name = raw.replace(/\s*\(.*?\)\s*$/, "").trim();
      if (!name || NOT_AN_INVESTOR.test(name)) return;
      const id = slugify(name);
      if (seen.has(id)) return;
      seen.add(id);
      const inv = m.get(id) ?? { id, name, deals: 0, leads: 0, totalDisclosed: 0, disclosedDeals: 0, nearRelatedDeals: 0, projectIds: [], projects: [], roundIds: [] };
      inv.deals += 1;
      if (lead) inv.leads += 1;
      if (r.amount !== null) {
        inv.totalDisclosed += r.amount;
        inv.disclosedDeals += 1;
      }
      if (r.nearRelated.startsWith("Yes")) inv.nearRelatedDeals += 1;
      if (r.projectId && !inv.projectIds.includes(r.projectId)) inv.projectIds.push(r.projectId);
      if (!inv.projects.includes(r.project)) inv.projects.push(r.project);
      inv.roundIds.push(r.id);
      m.set(id, inv);
    };
    for (const i of r.leadInvestors) add(i, true);
    for (const i of r.otherInvestors) add(i, false);
  }
  return Array.from(m.values()).sort((a, b) => b.deals - a.deals || b.totalDisclosed - a.totalDisclosed || a.name.localeCompare(b.name));
}

/** Pulls the numbered list under "## Ecosystem insights" out of the memo. */
export function parseMemoInsights(markdown: string): MemoInsight[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+Ecosystem insights/i.test(l));
  if (start === -1) return [];
  const out: MemoInsight[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    const m = line.match(/^(\d+)\.\s+(.*)$/);
    if (!m) continue;
    const text = m[2].trim();
    const dot = text.indexOf(". ");
    const title = dot > 0 && dot < 70 ? text.slice(0, dot) : text.split(" ").slice(0, 5).join(" ");
    out.push({ n: Number(m[1]), title, text });
  }
  return out;
}

export function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
