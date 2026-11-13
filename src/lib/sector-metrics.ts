/**
 * Which metrics each sector carries, and the state of each value (docs/LIVE-DATA.md, sections 2 and 4).
 * The project pop-up, the sector cards and the "where it applies" coverage lines all read from here, so a
 * metric that means nothing for a sector (DEX volume for a lender) is hidden rather than shown blank, and a
 * metric that applies but has no source yet says so.
 *
 * Measured sectors have a headline metric that drives tiers and leaders. Unmeasured sectors (wallets,
 * infrastructure, exchanges and the like) show facts with no tier; their tier reads "Not applicable".
 */
import { fmtCompact, fmtInt, fmtPct, fmtUsd, fmtUsdFull } from "./format";
import type { Project, StatusGroup } from "./types";

export const METRIC_IDS = [
  "tvl",
  "volume",
  "fees",
  "revenue",
  "holdersRevenue",
  "supplySideRevenue",
  "borrowed",
  "totalDeposited",
  "ownStaking",
  "aggregatorVolume",
  "bridgeAggregatorVolume",
  "stablecoinSupply",
  "tokenHolders",
  "tokenHoldersAurora",
  "tokenSupplyValue",
  "utilization",
  "borrowApy",
  "stakingApy",
  "bestPoolApy",
  "poolCount",
  "dexVolume24h",
  "dexLiquidity",
  "referralVolume",
  "referralSwaps",
  "intentsAppFees",
  "gasGenerated",
  "gasPaid",
  "calls30d",
  "signers7d",
  "tokensLaunched",
  "cexAssets",
  "validatorStake",
  "auditedProjects",
  "fundingDisclosed",
] as const;
export type MetricId = (typeof METRIC_IDS)[number];

export interface MetricDef {
  id: MetricId;
  label: string;
  /** What the number counts and what it leaves out (accuracy rule 2). Sources are named here, never on the page. */
  info: string;
  source: string;
  /** pct values are stored as fractions (0.85 is 85%); near values are whole NEAR. */
  unit: "usd" | "count" | "pct" | "near";
}

export const METRIC_DEFS: Record<MetricId, MetricDef> = {
  tvl: { id: "tvl", label: "TVL", unit: "usd", source: "DefiLlama", info: "Value locked in the protocol on NEAR and Aurora per DefiLlama. Excludes borrowed funds, the protocol's own-token staking and CEX reserves." },
  volume: { id: "volume", label: "30d DEX volume", unit: "usd", source: "DefiLlama", info: "Trading volume over the last 30 complete days per DefiLlama's DEX overview for NEAR and Aurora." },
  fees: { id: "fees", label: "30d fees", unit: "usd", source: "DefiLlama", info: "Fees users paid to the protocol over the last 30 complete days per DefiLlama. For a lender this is the interest paid by borrowers." },
  revenue: { id: "revenue", label: "30d revenue", unit: "usd", source: "DefiLlama", info: "The part of fees the protocol or its token keeps, over the last 30 complete days per DefiLlama." },
  holdersRevenue: { id: "holdersRevenue", label: "30d holders revenue", unit: "usd", source: "DefiLlama", info: "The part of revenue that goes to token holders (buybacks, burns, distributions) over the last 30 days per DefiLlama." },
  supplySideRevenue: { id: "supplySideRevenue", label: "30d supply-side revenue", unit: "usd", source: "DefiLlama", info: "Fees paid out to liquidity providers, lenders or solvers rather than kept by the protocol, over the last 30 days per DefiLlama." },
  borrowed: { id: "borrowed", label: "Borrowed", unit: "usd", source: "DefiLlama", info: "Outstanding loans on NEAR and Aurora per DefiLlama's borrowed view. Not part of TVL." },
  totalDeposited: { id: "totalDeposited", label: "Total deposited", unit: "usd", source: "DefiLlama", info: "TVL plus borrowed, the total supplied to the lender before loans went out. DefiLlama's TVL alone leaves borrowed funds out." },
  ownStaking: { id: "ownStaking", label: "Own-token staking", unit: "usd", source: "DefiLlama", info: "The protocol's own token staked in the protocol, per DefiLlama's staking view. Kept out of TVL." },
  aggregatorVolume: { id: "aggregatorVolume", label: "30d aggregator volume", unit: "usd", source: "DefiLlama", info: "Swaps routed through the aggregator over the last 30 days per DefiLlama. Counted again by the DEXes it routes to." },
  bridgeAggregatorVolume: { id: "bridgeAggregatorVolume", label: "30d bridge aggregator volume", unit: "usd", source: "DefiLlama", info: "Transfers routed through the bridge aggregator over the last 30 days per DefiLlama." },
  stablecoinSupply: { id: "stablecoinSupply", label: "Supply on NEAR and Aurora", unit: "usd", source: "DefiLlama stablecoins", info: "Circulating supply on NEAR plus Aurora per DefiLlama's stablecoin dashboard. A stablecoin listed under two names is counted once." },
  tokenHolders: { id: "tokenHolders", label: "Token holders on NEAR", unit: "count", source: "NearBlocks", info: "Accounts holding the project's token on NEAR per NearBlocks. An estimate, since one person can hold many accounts, and app-created accounts count. Holders never set a tier on their own." },
  tokenHoldersAurora: { id: "tokenHoldersAurora", label: "Token holders on Aurora", unit: "count", source: "Aurora Blockscout", info: "Addresses holding the project's token on Aurora per Aurora Blockscout, matched by contract address, never by symbol. An estimate, since one person can hold many addresses." },
  utilization: { id: "utilization", label: "Utilization", unit: "pct", source: "DefiLlama yields", info: "Borrowed divided by supplied across the lender's markets that DefiLlama's lendBorrow view lists. Those markets can be a subset of the whole protocol." },
  borrowApy: { id: "borrowApy", label: "Borrow APY", unit: "pct", source: "DefiLlama yields", info: "Base borrow rate across the lender's markets, weighted by the amount borrowed in each, per DefiLlama's lendBorrow view. Rewards are left out." },
  stakingApy: { id: "stakingApy", label: "Staking APY", unit: "pct", source: "DefiLlama yields", info: "APY of the protocol's largest pool on NEAR or Aurora per DefiLlama yields. Rates move daily." },
  bestPoolApy: { id: "bestPoolApy", label: "Largest pool APY", unit: "pct", source: "DefiLlama yields", info: "APY of the protocol's largest pool by TVL on NEAR or Aurora per DefiLlama yields." },
  poolCount: { id: "poolCount", label: "Yield pools", unit: "count", source: "DefiLlama yields", info: "Pools DefiLlama yields lists for the protocol on NEAR and Aurora." },
  dexVolume24h: { id: "dexVolume24h", label: "24h volume, top pools", unit: "usd", source: "GeckoTerminal", info: "Trading volume over the last 24 hours across the DEX's top pools (up to 20) per GeckoTerminal. A short window, so it moves a lot day to day." },
  dexLiquidity: { id: "dexLiquidity", label: "Liquidity, top pools", unit: "usd", source: "GeckoTerminal", info: "Liquidity in the DEX's top pools (up to 20) per GeckoTerminal. Not shown for NEAR Intents, whose pools there are a model, not DEX liquidity." },
  referralVolume: { id: "referralVolume", label: "30d NEAR Intents volume routed", unit: "usd", source: "NEAR Intents Explorer", info: "1Click swap volume over the last 30 days that carried this app's referral tag, per the NEAR Intents Explorer API. Already counted inside NEAR Intents' own volume, so it is never added to the app's DEX volume." },
  referralSwaps: { id: "referralSwaps", label: "30d NEAR Intents swaps routed", unit: "count", source: "NEAR Intents Explorer", info: "1Click swaps over the last 30 days that carried this app's referral tag, per the NEAR Intents Explorer API." },
  intentsAppFees: { id: "intentsAppFees", label: "30d NEAR Intents app fees", unit: "usd", source: "NEAR Intents Explorer", info: "App fees this app set on its 1Click swaps over the last 30 days, each successful swap's amountInUsd times its app fee in basis points, per the NEAR Intents Explorer API. The protocol's own buyback fee is left out. It is every app fee on swaps carrying this app's referral tag, so for a platform such as SwapKit it can include fees set for its own partners (Ledger, Trust Wallet and others), not only its own take. Counted as the project's revenue, marked as from NEAR Intents, only where DefiLlama reports no revenue for it, so it is never counted twice." },
  gasGenerated: { id: "gasGenerated", label: "30d gas fees generated", unit: "usd", source: "NEAR BigQuery", info: "The protocol pays a contract 30% of the gas burnt when receipts execute on it. This is that 30% share over the last 30 days, summed over the project's mapped accounts from execution outcomes in the NEAR BigQuery public dataset and priced at each day's NEAR price. It measures usage of the contracts, not protocol income, so it is kept out of every fee and revenue total." },
  gasPaid: { id: "gasPaid", label: "30d gas paid by users", unit: "usd", source: "NEAR BigQuery", info: "All the gas burnt executing receipts on the project's mapped accounts over the last 30 days, priced at each day's NEAR price, from execution outcomes in the NEAR BigQuery public dataset. 30% of it goes to the contracts, the rest is burnt. Usage, not income." },
  tokenSupplyValue: { id: "tokenSupplyValue", label: "Supply on NEAR × price", unit: "usd", source: "NearBlocks", info: "Token supply on NEAR multiplied by price, per NearBlocks. Not a market cap, since it counts minted supply, treasury included. Never shown for stablecoins." },
  calls30d: { id: "calls30d", label: "30d function calls", unit: "count", source: "NEAR BigQuery", info: "FUNCTION_CALL receipts to the project's tracked accounts over 30 days, from the NEAR BigQuery public dataset." },
  signers7d: { id: "signers7d", label: "7d signers", unit: "count", source: "NEAR BigQuery", info: "Distinct signer accounts calling the project's tracked accounts, summed per day over 7 days from the NEAR BigQuery public dataset. An estimate, since one person can use many accounts, and relayers or intents hide the end user." },
  tokensLaunched: { id: "tokensLaunched", label: "Tokens launched (30d)", unit: "count", source: "NEAR BigQuery", info: "New accounts created under the launchpad's factory account over 30 days. Needs the factory account mapped first." },
  cexAssets: { id: "cexAssets", label: "Assets held on NEAR", unit: "usd", source: "DefiLlama", info: "Exchange reserves held on NEAR per DefiLlama's CEX adapters. Kept out of chain TVL, since they are customer deposits." },
  validatorStake: { id: "validatorStake", label: "NEAR staked", unit: "near", source: "NEAR RPC", info: "NEAR staked with the operator's validator pools in the current epoch, summed over its pools, per the NEAR RPC validators method. Pools are matched by account id in data/validator-pools.csv." },
  auditedProjects: { id: "auditedProjects", label: "NEAR projects it audits or hosts bounties for", unit: "count", source: "Research CSV", info: "NEAR and Aurora projects in the atlas whose audits column names the firm as auditor or bug bounty host. A count of mentions in the research, not of every engagement the firm has had." },
  fundingDisclosed: { id: "fundingDisclosed", label: "Disclosed rounds joined", unit: "usd", source: "Research CSV", info: "Total size of the disclosed funding rounds the organisation joined as an investor, per the research funding rounds file. Its own share of each round is rarely disclosed, so this is the size of the rounds, not money it put in." },
};

/** A value as text, compact by default (cards, leader rows) or in full (the project pop-up). */
export function fmtMetricValue(id: MetricId, v: number | null, full = false): string {
  if (v === null) return "Not tracked";
  switch (METRIC_DEFS[id].unit) {
    case "usd":
      return full ? fmtUsdFull(v) : fmtUsd(v);
    case "pct":
      return fmtPct(v, 1);
    case "near":
      return `${full ? fmtInt(v) : fmtCompact(v)} NEAR`;
    default:
      return fmtInt(v);
  }
}

export interface SectorDef {
  measured: boolean;
  /** The metric that drives tiers and leaders. Null for an unmeasured sector. */
  headline: MetricId | null;
  /** Every metric shown for the sector, headline first. */
  metrics: readonly MetricId[];
  /** A note for the headline, e.g. a double count to flag. */
  note?: string;
  /** Labels this sector reads differently, e.g. a bridge's volume is not DEX volume. */
  labels?: Partial<Record<MetricId, string>>;
  /** Unmeasured sectors only: the facts that rank leaders, in order. A project with no value on the first falls to the next. */
  rankBy?: readonly MetricId[];
}

const M = (headline: MetricId, rest: MetricId[], extra: Pick<SectorDef, "note" | "labels"> = {}): SectorDef => ({ measured: true, headline, metrics: [headline, ...rest], ...extra });
/** An unmeasured sector: facts with no tier. Facts rank leaders unless `rankBy` says otherwise. */
const U = (facts: MetricId[] = [], rankBy: MetricId[] = facts): SectorDef => ({ measured: false, headline: null, metrics: facts, rankBy });

/** Section 4 of docs/LIVE-DATA.md. Keys are the sector names in the research CSV. */
export const SECTOR_METRICS: Record<string, SectorDef> = {
  "DEXs & Liquidity": M("volume", ["tvl", "fees", "revenue", "supplySideRevenue", "dexVolume24h", "dexLiquidity", "aggregatorVolume", "bestPoolApy", "poolCount", "tokenHolders", "tokenHoldersAurora", "calls30d"]),
  // NEAR Intents' volume is swaps across chains, not DEX trading, so the bridges sector reads it as plain volume.
  "Bridges & Interoperability": M("volume", ["tvl", "fees", "revenue", "holdersRevenue", "supplySideRevenue", "dexVolume24h", "bridgeAggregatorVolume", "calls30d", "signers7d"], { labels: { volume: "30d volume" } }),
  "Lending & Credit": M("totalDeposited", ["borrowed", "tvl", "utilization", "borrowApy", "fees", "revenue", "tokenHolders", "tokenHoldersAurora"]),
  "Liquid Staking & Restaking": M("tvl", ["stakingApy", "tokenHolders", "ownStaking", "fees", "revenue"]),
  Launchpads: M("tokensLaunched", ["volume", "tokenHolders", "fees", "revenue"]),
  "Memecoins & Community": M("tokenHolders", ["tokenHoldersAurora", "tokenSupplyValue"]),
  // Signers rather than holders: most AI projects have no token, and holders never set a tier (accuracy rule 10).
  "AI Agents": M("signers7d", ["calls30d", "tokenHolders"]),
  // Signers rather than holders: app-created accounts inflate game token holders (SWEAT), accuracy rule 10.
  "NFTs, Gaming & Collectibles": M("signers7d", ["calls30d", "tokenHolders"]),
  "Stablecoins & Payments": M("stablecoinSupply", ["tokenHolders", "tokenHoldersAurora", "signers7d"]),
  "Yield & Asset Management": M("tvl", ["bestPoolApy", "poolCount", "fees", "revenue"]),
  "RWA & Tokenized Assets": M("tvl", ["tokenHolders", "tokenSupplyValue"]),
  "Perps, Options & Derivatives": M("tvl", ["fees", "revenue", "calls30d"]),
  "Prediction Markets": M("signers7d", ["tvl", "fees", "revenue"]),
  "Trading Tools & Bots": M("volume", ["fees", "revenue", "signers7d"], { note: "Volume routed through a trading bot is counted again by the DEX it trades on.", labels: { volume: "30d volume routed" } }),
  "Social & Identity": M("signers7d", ["calls30d"]),
  "DAOs, Governance & Public Goods": M("signers7d", ["calls30d"]),
  "Infrastructure & Dev Tools": U(),
  // Wallets rank by NEAR Intents volume their referral tag routed, then by signers to their own contracts.
  "Wallets & Custody": U(["signers7d"], ["referralVolume", "signers7d"]),
  "Exchanges & On/Off-Ramps": U(["cexAssets"]),
  "Data & Analytics": U(),
  "Security, Risk & Compliance": U(["auditedProjects"]),
  "Ecosystem, Funding & Education": U(["fundingDisclosed"]),
  "Validators & Node Operators": U(["validatorStake"]),
  Other: U(),
};

const UNKNOWN_SECTOR: SectorDef = U();

export function sectorDef(sector: string): SectorDef {
  return SECTOR_METRICS[sector] ?? UNKNOWN_SECTOR;
}

export function isMeasured(sector: string): boolean {
  return sectorDef(sector).measured;
}

/** A metric's label as the sector reads it (a bridge's volume is "30d volume", not DEX volume). */
export function metricLabel(sector: string, id: MetricId): string {
  return sectorDef(sector).labels?.[id] ?? METRIC_DEFS[id].label;
}

/** Projects whose token holders are mostly accounts the app created for its users, so holders say little about use. */
export const INFLATED_HOLDERS = new Set(["sweat-sweat-economy"]);
export const INFLATED_HOLDERS_NOTE = "Most of these accounts were created by the app for its users, so the count says little about how many people use it.";

/** Defunct and Inactive projects keep their last value with its date and stay out of leaderboards. */
export const INACTIVE_GROUPS: readonly StatusGroup[] = ["Defunct", "Inactive"];

export function isInactive(p: Pick<Project, "statusGroup">): boolean {
  return INACTIVE_GROUPS.includes(p.statusGroup);
}

/** A metric's value for a project, or null when no source has one. */
export function metricOf(p: Project, id: MetricId): number | null {
  const x: Partial<Record<string, number>> = p.extra?.values ?? {};
  switch (id) {
    case "tvl":
    case "volume":
    case "fees":
      return p[id];
    case "revenue":
      // NEAR Intents app fees count as revenue only where DefiLlama has none, so nothing is counted twice.
      return p.revenue ?? x.intentsAppFees ?? null;
    case "holdersRevenue":
      return p.live?.holdersRevenue ?? x.holdersRevenue ?? null;
    case "supplySideRevenue":
      return p.live?.supplySideRevenue ?? x.supplySideRevenue ?? null;
    case "calls30d":
      return p.live?.calls30d ?? null;
    case "signers7d":
      return p.live?.signers7d ?? null;
    case "cexAssets":
      return p.live?.cexReserves ?? null;
    case "tokenSupplyValue":
      // Rule 5: never for a stablecoin, where NearBlocks multiplies the full minted supply by price.
      return p.sector === "Stablecoins & Payments" ? null : (x.tokenSupplyValue ?? null);
    default:
      return x[id] ?? null;
  }
}

export type ValueState = "value" | "zero-by-design" | "not-applicable" | "not-tracked" | "inactive";

export interface MetricValue {
  id: MetricId;
  state: ValueState;
  value: number | null;
  /** Why the value is in this state, for its info tip. */
  reason: string;
}

const TOKEN_METRICS = new Set<MetricId>(["tokenHolders", "tokenHoldersAurora", "tokenSupplyValue"]);
/** Projects whose liquidity on GeckoTerminal is a model of how they work, not DEX liquidity (accuracy rule 6). */
const NO_LIQUIDITY = new Set(["near-intents"]);

/**
 * Does the metric belong on this project at all? It must be one its sector uses; a token metric needs a
 * token; a figure counted on another row (a stablecoin listed under two names) belongs to that row.
 */
export function applies(p: Pick<Project, "sector" | "token" | "id" | "extra"> & Partial<Pick<Project, "volume" | "fees">>, id: MetricId): boolean {
  if (!sectorDef(p.sector).metrics.includes(id)) return false;
  // A bridge carries DEX volume only when it swaps, which a DefiLlama volume listing shows.
  if (id === "volume" && p.sector === "Bridges & Interoperability" && (p.volume ?? null) === null) return false;
  // Revenue exists only where the protocol keeps a share of fees. A DefiLlama fee listing comes with its methodology,
  // which says whether it does, so revenue applies to projects with a fee figure (or Intents app fees, counted as revenue).
  if (id === "revenue" && (p.fees ?? null) === null && p.extra?.values.intentsAppFees === undefined) return false;
  if (TOKEN_METRICS.has(id) && !p.token) return false;
  if (id === "dexLiquidity" && NO_LIQUIDITY.has(p.id)) return false;
  if (p.extra?.countedOn?.[id]) return false;
  return true;
}

/**
 * The state of one metric for one project (section 2, "The four value states" and the inactive case).
 * - not-applicable: the sector does not use the metric. The row is hidden.
 * - inactive: the project is Defunct or Inactive. The last value shows with its date, out of leaderboards.
 * - value: a current number.
 * - zero-by-design: the source lists the project and reports exactly zero. Shown as $0 with the reason.
 * - not-tracked: the metric applies but no source covers the project yet.
 */
export function valueState(p: Project, id: MetricId): MetricValue {
  if (!applies(p, id)) {
    const on = p.extra?.countedOn?.[id];
    return { id, state: "not-applicable", value: null, reason: on ? `Counted once, on ${on}.` : `${METRIC_DEFS[id].label} does not apply to ${p.sector}.` };
  }
  const value = metricOf(p, id);
  if (isInactive(p)) return { id, state: "inactive", value, reason: `The project is ${p.statusGroup.toLowerCase()}, so this is its last value, not a current one.` };
  if (value === null) return { id, state: "not-tracked", value, reason: `${METRIC_DEFS[id].label} applies to ${p.sector}, but no source covers this project yet.` };
  if (value === 0) return { id, state: "zero-by-design", value, reason: `${METRIC_DEFS[id].source} lists the project and reports zero.` };
  return { id, state: "value", value, reason: METRIC_DEFS[id].info };
}

/**
 * Facts any project can carry whatever its sector, shown only when a value exists and never listed as Not
 * tracked: NEAR Intents volume routed by the app's referral tag reaches wallets, aggregators, exchanges and
 * bridges alike.
 */
export const CROSS_SECTOR_FACTS: readonly MetricId[] = ["referralVolume", "referralSwaps", "intentsAppFees", "gasGenerated", "gasPaid"];

/** True when a project's revenue figure is its NEAR Intents app fees rather than DefiLlama's revenue. */
export function revenueFromIntents(p: Project): boolean {
  return p.revenue === null && p.extra?.values.intentsAppFees !== undefined;
}

/** Every metric row the project shows, in the sector's order. not-applicable rows are left out. */
export function projectMetrics(p: Project): MetricValue[] {
  return sectorDef(p.sector).metrics.map((id) => valueState(p, id));
}

/**
 * The denominator for "Tracked for X of Y where it applies": projects whose sector uses the metric and that
 * are not Defunct or Inactive. X counts those with a value (zero included, since the source tracks them).
 */
export function coverageWhereApplies(projects: readonly Project[], id: MetricId): { tracked: number; applies: number } {
  let tracked = 0;
  let total = 0;
  for (const p of projects) {
    if (!applies(p, id) || isInactive(p)) continue;
    total += 1;
    if (metricOf(p, id) !== null) tracked += 1;
  }
  return { tracked, applies: total };
}

/** A value counts toward a leader's rank only if it is at least this share of the sector's top value; smaller ones keep curated order. */
export const LEADER_FLOOR = 0.01;

/** The metrics that rank a sector's leaders: the headline for a measured sector, its ranking facts otherwise. */
export function rankKeys(sector: string): MetricId[] {
  const d = sectorDef(sector);
  return d.headline ? [d.headline] : [...(d.rankBy ?? [])];
}

/** A ranking metric's value for a project. Sector metrics go through `applies` (a stablecoin counted on another row has none); cross-sector facts do not. */
function rankValue(p: Project, id: MetricId): number | null {
  if (sectorDef(p.sector).metrics.includes(id) && !applies(p, id)) return null;
  return metricOf(p, id);
}

/**
 * The projects a sector's totals and leaders are both drawn from: the given (already filtered) projects in the
 * sector that are not Defunct or Inactive. Totals and leaders read the same set, so they can never disagree.
 */
export function sectorProjects(sector: string, projects: readonly Project[]): Project[] {
  return projects.filter((p) => p.sector === sector && !isInactive(p));
}

export interface RankedLeader {
  project: Project;
  /** The metric that placed the project, or null when it sits by curated rank or by name. */
  key: MetricId | null;
  value: number | null;
  /** "value": ranked by a metric; "curated": by the research leaders CSV; "unranked": neither, listed by name. */
  basis: "value" | "curated" | "unranked";
}

/**
 * The one leader order used by the sector cards, the sector pop-up and the Traction tab (docs/SECTOR-METRICS.md, section 1).
 * 1. Active projects with a ranking value of at least 1% of the sector's top value, highest first. For an
 *    unmeasured sector with several ranking facts, each fact ranks the projects the previous one left.
 * 2. Then active projects by curated rank from the leaders CSV.
 * 3. Then the remaining active projects by name.
 * Defunct and Inactive projects never appear.
 */
export function rankLeaders(sector: string, projects: readonly Project[]): RankedLeader[] {
  let pool = sectorProjects(sector, projects);
  const out: RankedLeader[] = [];
  for (const key of rankKeys(sector)) {
    const withValue = pool.map((p) => ({ p, v: rankValue(p, key) })).filter((x): x is { p: Project; v: number } => x.v !== null && x.v > 0);
    const top = withValue.reduce((m, x) => Math.max(m, x.v), 0);
    const ranked = withValue.filter((x) => x.v >= top * LEADER_FLOOR).sort((a, b) => b.v - a.v || a.p.name.localeCompare(b.p.name));
    for (const x of ranked) out.push({ project: x.p, key, value: x.v, basis: "value" });
    const placed = new Set(ranked.map((x) => x.p.id));
    pool = pool.filter((p) => !placed.has(p.id));
  }
  const curated = pool.filter((p) => p.leaderRank !== null).sort((a, b) => (a.leaderRank as number) - (b.leaderRank as number) || a.name.localeCompare(b.name));
  for (const p of curated) out.push({ project: p, key: null, value: null, basis: "curated" });
  const rest = pool.filter((p) => p.leaderRank === null).sort((a, b) => a.name.localeCompare(b.name));
  for (const p of rest) out.push({ project: p, key: null, value: null, basis: "unranked" });
  return out;
}

/** The leaders a sector card names: the top `n` placed by a value or by curated rank, never filler listed by name. */
export function topLeaders(sector: string, projects: readonly Project[], n = 3): RankedLeader[] {
  return rankLeaders(sector, projects).filter((l) => l.basis !== "unranked").slice(0, n);
}

export interface SectorMetricTotal {
  id: MetricId;
  /** Sum over the sector's active projects for usd and NEAR metrics; null for counts and rates, which overlap or do not add. */
  total: number | null;
  /** The largest single value and its project, shown where a sum would mislead. */
  top: { project: Project; value: number } | null;
  tracked: number;
  applies: number;
}

/** A sector metric's total and coverage over the same set the leaders use. */
export function sectorMetricTotal(sector: string, projects: readonly Project[], id: MetricId): SectorMetricTotal {
  const set = sectorProjects(sector, projects);
  const cov = coverageWhereApplies(set, id);
  const unit = METRIC_DEFS[id].unit;
  let total: number | null = null;
  let top: SectorMetricTotal["top"] = null;
  for (const p of set) {
    const v = rankValue(p, id);
    if (v === null) continue;
    if (unit === "usd" || unit === "near") total = (total ?? 0) + v;
    if (!top || v > top.value) top = { project: p, value: v };
  }
  return { id, total, top, tracked: cov.tracked, applies: cov.applies };
}
