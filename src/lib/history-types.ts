/**
 * Shapes of the committed history store under data/history/** and data/raw/**.
 * Written by scripts/refresh.ts, read by scripts/build-data.ts and the tests.
 */
import type { DateStr } from "./dates";

export type DailyPoint = [date: DateStr, value: number];
/** Sorted ascending by date, one point per date. */
export type Series = DailyPoint[];
export type SeriesMap = Record<string, Series>;

export const SOURCE_IDS = ["defillama", "nearblocks", "catalog", "price", "intents", "bigquery", "blockscout", "stablecoins", "yields", "hacks", "geckoterminal", "holders"] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

export interface SourceStatus {
  lastAttempt: string | null;
  lastSuccess: string | null;
  rows: number;
  calls: number;
  ms: number;
  /** Bytes processed by BigQuery in this run (0 for other sources). */
  bytes: number;
  error: string | null;
  /** Reason the source was skipped on purpose, e.g. "NEAR_INTENTS_JWT not set". */
  skipped: string | null;
  notes: string[];
}

export interface NewlyDetected {
  source: "defillama" | "catalog";
  slug: string;
  name: string;
  category: string;
  chain: string;
  tvl: number | null;
  firstSeen: DateStr;
  url: string;
}

export interface IntentsCursor {
  /** Oldest row reached so far (ISO); the backfill continues from here with direction=next. */
  oldestCreatedAt: string | null;
  lastDepositAddress: string | null;
  lastDepositMemo: string | null;
  /** Backfill target reached. */
  backfillDone: boolean;
  /** Newest row seen, used to pull newer rows on the next run. */
  newestCreatedAt: string | null;
}

export interface HistoryMeta {
  version: 1;
  lastRun: string | null;
  lastRunDate: DateStr | null;
  mode: "daily" | "backfill" | null;
  perSource: Record<SourceId, SourceStatus>;
  cursors: {
    intents: IntentsCursor;
    /** metric id -> last block_date fetched from BigQuery */
    bigquery: Record<string, DateStr>;
    /** "file/name" -> date DefiLlama last said that data type does not exist for the protocol. */
    llamaMissing: Record<string, string>;
  };
  newlyDetected: NewlyDetected[];
  unmatchedCsv: string[];
  unmatchedMap: string[];
  /** Outcome of the last onchain anchor write (scripts/anchor/write.ts). Never blocks the refresh. */
  anchor?: AnchorStatus;
}

export interface AnchorStatus {
  date: DateStr;
  status: "written" | "exists" | "skipped" | "failed";
  /** Why it was skipped or failed. */
  reason: string | null;
  txHash: string | null;
  /** SocialDB storage left for the signer, in NEAR. */
  storageNear: string | null;
  /** What is left of the function-call key's gas allowance, in NEAR. */
  allowanceNear: string | null;
  /** Set when storage or allowance is under 0.05 NEAR. */
  warning: string | null;
}

/** One line of data/anchors/index.json. */
export interface AnchorIndexEntry {
  commit: string;
  inputs: string;
  outputs: string;
  verdict: string;
  account: string;
  txHash: string;
  /** Block height SocialDB reports for the record; a later rewrite would change it. */
  blockHeight: number;
}

export const LLAMA_CHAINS = ["near", "aurora"] as const;
export type LlamaChain = (typeof LLAMA_CHAINS)[number];

export interface LlamaProtocolSnap {
  slug: string;
  name: string;
  parentProtocol: string | null;
  category: string;
  /** Lowercase account id when the listing gives one (e.g. "near:token.rhealab.near"). */
  address: string | null;
  tvlNear: number | null;
  tvlAurora: number | null;
  mcap: number | null;
  geckoId: string | null;
  url: string | null;
  kinds: Array<"tvl" | "dexs" | "fees" | "aggregators">;
  /** DefiLlama's other TVL views on NEAR plus Aurora (the "Near-borrowed", "Aurora-staking" keys and so on). None of them is part of TVL. */
  otherTvl?: Partial<Record<"borrowed" | "staking" | "vesting" | "pool2", number>>;
}

export interface ChainOverview {
  tvl: Series;
  volume: Series;
  fees: Series;
  revenue: Series;
  holdersRevenue: Series;
  supplySideRevenue: Series;
  /** The chain's own gas fees (DefiLlama /summary/fees/{chain}, dataType dailyFees). */
  gasFees: Series;
  /** Daily transactions, where the chain's own explorer provides them (Aurora Blockscout). */
  txns: Series;
}

export interface ChainHistory {
  near: ChainOverview;
  aurora: ChainOverview;
  /** NearBlocks daily chart series keyed by NearblocksKey. */
  nearblocks: SeriesMap;
  /** BigQuery daily series keyed by metric id. */
  bigquery: SeriesMap;
  /** NEAR price cross-checks keyed by source: llama, coingecko, coingeckoMcap. */
  price: SeriesMap;
}

/** One committed day of NEAR Intents 1Click swaps (data/raw/intents/daily/YYYY-MM-DD.json). */
export interface IntentsDay {
  date: DateStr;
  rows: number;
  /** sha256 of the trimmed rows file, so the aggregate can be verified against a re-fetch. */
  sha256: string;
  statuses: Record<string, number>;
  volumeUsd: number;
  volumeOutUsd: number;
  successCount: number;
  uniqueRecipients: number;
  medianUsd: number | null;
  p90Usd: number | null;
  maxUsd: number | null;
  /** "originChain>destinationChain" -> {count, usd} */
  routes: Record<string, { count: number; usd: number }>;
  originChains: Record<string, { count: number; usd: number }>;
  destinationChains: Record<string, { count: number; usd: number }>;
  originAssets: Record<string, { count: number; usd: number }>;
  destinationAssets: Record<string, { count: number; usd: number }>;
  referrals: Record<string, { count: number; usd: number }>;
  appFeeRecipients: Record<string, { count: number; usd: number }>;
  /**
   * App fees in USD per referral tag: amountInUsd × the swap's summed app fee (basis points) / 10,000, over
   * successful swaps. Present only when every row of the day carries its fee rate (rows trimmed before Nov 13,
   * 2026 kept only the fee recipients), so a day without it is not a day of zero fees.
   */
  referralFees?: Record<string, number>;
  /** True when the day may be incomplete (backfill cursor stopped inside it). */
  partial: boolean;
}

export function emptySourceStatus(): SourceStatus {
  return { lastAttempt: null, lastSuccess: null, rows: 0, calls: 0, ms: 0, bytes: 0, error: null, skipped: null, notes: [] };
}

export function emptyMeta(): HistoryMeta {
  const perSource = {} as Record<SourceId, SourceStatus>;
  for (const id of SOURCE_IDS) perSource[id] = emptySourceStatus();
  return {
    version: 1,
    lastRun: null,
    lastRunDate: null,
    mode: null,
    perSource,
    cursors: {
      intents: { oldestCreatedAt: null, lastDepositAddress: null, lastDepositMemo: null, backfillDone: false, newestCreatedAt: null },
      bigquery: {},
      llamaMissing: {},
    },
    newlyDetected: [],
    unmatchedCsv: [],
    unmatchedMap: [],
  };
}

export function emptyOverview(): ChainOverview {
  return { tvl: [], volume: [], fees: [], revenue: [], holdersRevenue: [], supplySideRevenue: [], gasFees: [], txns: [] };
}
