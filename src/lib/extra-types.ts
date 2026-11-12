/**
 * Dated snapshots from the step M and L sources (docs/LIVE-DATA.md, sections 3 and 5), stored under
 * data/history/extra/ by their fetchers and joined to projects by scripts/build-data.ts. Each file carries
 * the day it was taken, so a value shown on the site always has its own date.
 */
export interface StablecoinSnap {
  id: string;
  name: string;
  symbol: string;
  /** USD-pegged circulating supply on each chain; null when the coin is not on that chain. */
  near: number | null;
  aurora: number | null;
}

export interface StablecoinsFile {
  asOf: string;
  coins: StablecoinSnap[];
}

export interface YieldPoolSnap {
  pool: string;
  project: string;
  chain: "Near" | "Aurora";
  symbol: string;
  tvlUsd: number;
  apy: number | null;
  /** From /lendBorrow, when the pool is a lending market. */
  totalSupplyUsd: number | null;
  totalBorrowUsd: number | null;
  apyBaseBorrow: number | null;
}

export interface YieldsFile {
  asOf: string;
  pools: YieldPoolSnap[];
}

export interface HackSnap {
  name: string;
  date: string;
  amount: number | null;
  classification: string | null;
  technique: string | null;
  defillamaId: string | null;
}

export interface HacksFile {
  asOf: string;
  hacks: HackSnap[];
}

export interface DexSnap {
  network: "near" | "aurora";
  dex: string;
  name: string;
  /** Sums over the DEX's top pools as GeckoTerminal returns them (up to 20). */
  volume24h: number;
  liquidity: number;
  pools: number;
  topPairs: string[];
}

export interface GeckoFile {
  asOf: string;
  dexes: DexSnap[];
}

export interface TokenSnap {
  contract: string;
  symbol: string;
  price: number | null;
  /** NearBlocks onchain_market_cap: supply on NEAR times price, not a market cap (accuracy rule 5). */
  supplyValue: number | null;
}

export interface TokensFile {
  asOf: string;
  tokens: TokenSnap[];
}

export interface ChainStatsFile {
  asOf: string;
  near: { nodesOnline: number | null; totalTxns: number | null; tps: number | null } | null;
  aurora: { totalTxns: number | null; totalAddresses: number | null; totalBlocks: number | null } | null;
}

/** Holder counts per token contract, one dated point per run. */
export interface HoldersFile {
  near: Record<string, Array<[string, number]>>;
  aurora: Record<string, Array<[string, number]>>;
}
