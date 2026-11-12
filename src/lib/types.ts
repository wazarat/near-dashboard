/**
 * Shared types for the NEAR Ecosystem Atlas. Snapshot values come from the
 * CSVs in ./data; live values are joined from ./data/history at build time.
 */
export const NATIVE_CHAINS = [
  "NEAR native",
  "Aurora native",
  "Other EVM",
  "Other non-EVM",
  "Centralized / off-chain",
  "Octopus appchain",
] as const;
export type NativeChain = (typeof NATIVE_CHAINS)[number];

export const TIERS = [
  "Tier 1 - Leader",
  "Tier 2 - Strong",
  "Tier 3 - Emerging",
  "Tracked, negligible",
  "Not tracked",
  /** A project in a sector with no traction headline (wallets, infrastructure, exchanges and so on); docs/LIVE-DATA.md, section 2. */
  "Not applicable",
] as const;
export type Tier = (typeof TIERS)[number];

export const RISK_LEVELS = ["High", "Medium", "Low", "Unknown", "Not researched"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/** Status groups keep the two "unknown" flavours and defunct listings apart. */
export const STATUS_GROUPS = [
  "Mainnet",
  "Testnet",
  "Building",
  "Inactive",
  "Legacy listing",
  "Defunct",
  "Unknown",
] as const;
export type StatusGroup = (typeof STATUS_GROUPS)[number];

export const CONFIDENCE = ["High", "Medium", "Low"] as const;
export type Confidence = (typeof CONFIDENCE)[number];

export const METRICS = ["count", "tvl", "volume", "fees", "revenue"] as const;
export type MetricKey = (typeof METRICS)[number];
export type NumericMetricKey = Exclude<MetricKey, "count">;

export const EVENT_TYPES = [
  "Funding",
  "Milestone",
  "Incident",
  "Program",
  "Integration",
  "Listing",
  "Governance",
  "Grant",
  "Acquisition",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const CHAIN_PRESENCE = ["NEAR", "Aurora", "Octopus"] as const;
export type ChainPresence = (typeof CHAIN_PRESENCE)[number];

export const ROUND_CONFIDENCE = ["Sourced", "Partly unverified (re-verify)", "Aggregator only (re-verify)"] as const;

export type MetricSource = "live" | "snapshot" | "none";

export interface Snapshot {
  tvl: number | null;
  tvlNear: number | null;
  tvlAurora: number | null;
  volume: number | null;
  fees: number | null;
  revenue: number | null;
  tier: Tier;
  asOf: string;
}

export interface MetricChange {
  d7: number | null;
  d30: number | null;
  d90: number | null;
}

export interface LiveMetrics {
  /** Last complete UTC day the numbers cover. */
  asOf: string;
  slugs: string[];
  tvl: number | null;
  tvlNear: number | null;
  tvlAurora: number | null;
  volume: number | null;
  fees: number | null;
  revenue: number | null;
  holdersRevenue: number | null;
  supplySideRevenue: number | null;
  feesDaily: number | null;
  change: Record<NumericMetricKey, MetricChange>;
  annualisedRevenue: number | null;
  tokenMarketCap: number | null;
  psRatio: number | null;
  /** CEX reserves held on NEAR (DefiLlama CEX adapters); never counted as TVL. */
  cexReserves: number | null;
  /** Onchain activity from BigQuery, when the project has tracked contracts. */
  calls7d: number | null;
  calls30d: number | null;
  signers7d: number | null;
  activityAsOf: string | null;
}

export interface ContractInfo {
  accountId: string;
  role: string;
  source: string;
  verified: string;
}

export interface Project {
  id: string;
  name: string;
  website: string | null;
  sector: string;
  subcategory: string | null;
  chain: NativeChain;
  chainDetail: string | null;
  chainConfidence: Confidence;
  /** Chains the project is present on (Chain Presence column), empty when unknown. */
  presence: ChainPresence[];
  tier: Tier;
  tvl: number | null;
  tvlNear: number | null;
  tvlAurora: number | null;
  volume: number | null;
  fees: number | null;
  revenue: number | null;
  otherTraction: string | null;
  tractionSources: string[];
  /** Raw Funding Type cell, e.g. "VC-backed; Token-funded". */
  fundingType: string;
  /** Split on ";" so compound values can be filtered individually. */
  fundingTypes: string[];
  investors: string | null;
  amountRaised: string | null;
  amountDisclosed: boolean;
  token: string | null;
  tokenRaw: string | null;
  fundingSourceUrl: string | null;
  risk: RiskLevel;
  audits: string | null;
  incidents: string | null;
  redFlags: string | null;
  securitySourceUrl: string | null;
  description: string;
  status: string;
  statusGroup: StatusGroup;
  xHandle: string | null;
  discoveredVia: string;
  discoveredViaList: string[];
  sourceUrl: string | null;
  hasTraction: boolean;
  revenueCapture: number | null;
  leaderRank: number | null;
  snapshot: Snapshot;
  live: LiveMetrics | null;
  metricSource: Record<NumericMetricKey, MetricSource>;
  contracts: ContractInfo[];
  /** Registry metrics beyond the four DefiLlama ones (src/lib/sector-metrics.ts), each with the day it was taken. */
  extra?: ProjectExtra;
}

export interface ProjectExtra {
  values: Partial<Record<string, number>>;
  /** YYYY-MM-DD per metric id. */
  asOf: Partial<Record<string, string>>;
  /** Where each value came from: "live" (this build's fetch) or "snapshot" (data/near-live-metrics-*.csv). */
  from: Partial<Record<string, "live" | "snapshot">>;
}

export interface Leader {
  sector: string;
  rank: number;
  name: string;
  projectId: string | null;
  website: string | null;
  why: string;
  status: string;
  xHandle: string | null;
  evidenceUrl: string | null;
}

export interface EcosystemEvent {
  id: string;
  /** YYYY-MM-DD; month-only source dates are placed on the first of the month. */
  date: string;
  monthOnly: boolean;
  type: EventType;
  title: string;
  projects: string[];
  projectIds: string[];
  amount: number | null;
  amountNote: string | null;
  detail: string | null;
  sourceUrl: string | null;
}

export interface Round {
  id: string;
  project: string;
  projectId: string | null;
  roundType: string;
  /** Bucket used for stacked charts. */
  roundBucket: string;
  date: string | null;
  monthOnly: boolean;
  amount: number | null;
  amountNote: string | null;
  leadInvestors: string[];
  otherInvestors: string[];
  investors: string[];
  nearRelated: string;
  confidence: string;
  sourced: boolean;
  sourceUrl: string | null;
}

export interface Investor {
  id: string;
  name: string;
  deals: number;
  leads: number;
  totalDisclosed: number;
  disclosedDeals: number;
  nearRelatedDeals: number;
  projectIds: string[];
  projects: string[];
  roundIds: string[];
}

export interface MemoInsight {
  n: number;
  title: string;
  text: string;
}

export interface SourceSummary {
  ok: boolean;
  lastSuccess: string | null;
  error: string | null;
  skipped: string | null;
}

export type SeriesKey = NumericMetricKey | "calls";

export interface SeriesFile {
  dates: string[];
  projects: Record<string, Record<SeriesKey, Array<number | null>>>;
}

export interface Meta {
  asOf: string;
  asOfLabel: string;
  snapshotAsOf: string;
  snapshotAsOfLabel: string;
  live: { lastRun: string; windowEnd: string; perSource: Record<string, SourceSummary> } | null;
  counts: {
    projects: number;
    sectors: number;
    leaders: number;
    events: number;
    rounds: number;
    investors: number;
    tier1: number;
    liveProjects: number;
    newlyDetected: number;
    mappedSlugs: number;
    withTvl: number;
    withFlows: number;
  };
  totals: { tvl: number; tvlNear: number; tvlAurora: number; volume: number; fees: number; revenue: number };
  snapshotTotals: { tvl: number; tvlNear: number; tvlAurora: number; volume: number; fees: number; revenue: number };
  /** DefiLlama chain-level TVL (default view, excludes liquid staking and bridges) when history exists. */
  chainTvl: { near: number | null; aurora: number | null; asOf: string | null };
  cexReserves: number;
  tierCounts: Record<Tier, number>;
  sectors: string[];
  chains: string[];
  presence: string[];
  tiers: string[];
  statuses: string[];
  statusGroups: string[];
  fundingTypes: string[];
  risks: string[];
  discoveredVia: string[];
}

/**
 * Chain-level daily series. `fees` and `revenue` sum the protocols DefiLlama lists on the chain; `gasFees` is the
 * chain's own gas (DefiLlama's chain fee summary), which that sum leaves out. `txns` is daily transactions
 * (NearBlocks for NEAR, Aurora Blockscout for Aurora).
 */
export const CHAIN_SERIES = ["tvl", "volume", "fees", "revenue", "holdersRevenue", "supplySideRevenue", "gasFees", "txns"] as const;
export type ChainSeriesKey = (typeof CHAIN_SERIES)[number];

/** NearBlocks daily chart fields kept in the store. */
export const NEARBLOCKS_SERIES = ["txns", "activeAccounts", "newAccounts", "activeContracts", "newContracts", "price", "marketCap", "txnFeeUsd", "txnVolumeUsd", "multichainTxns"] as const;
export type NearblocksKey = (typeof NEARBLOCKS_SERIES)[number];

export interface ChainLatest {
  asOf: string;
  tvl: number | null;
  volume30d: number | null;
  fees30d: number | null;
  revenue30d: number | null;
  /** Chain gas fees over the last 30 days, gap days left out. */
  gasFees30d: number | null;
  change: Partial<Record<ChainSeriesKey, MetricChange>>;
}

export interface ChainData {
  dates: string[];
  near: Record<ChainSeriesKey, Array<number | null>>;
  aurora: Record<ChainSeriesKey, Array<number | null>>;
  nearblocks: Record<NearblocksKey, Array<number | null>>;
  /** BigQuery daily series keyed by metric id (see queries/). */
  bigquery: Record<string, Array<number | null>>;
  /** Price cross-checks keyed by source (llama, coingecko). */
  price: Record<string, Array<number | null>>;
  latest: {
    near: ChainLatest;
    aurora: ChainLatest;
    activeAccounts: number | null;
    txns: number | null;
    newAccounts: number | null;
    price: number | null;
    marketCap: number | null;
    activityChange: Partial<Record<"activeAccounts" | "txns" | "newAccounts" | "price", MetricChange>>;
  };
}
