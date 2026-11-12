/**
 * Joins the step M and L snapshots (src/lib/extra-types.ts) to projects. Pure, so every rule is tested.
 * Each join returns metric values keyed by project name; scripts/build-data.ts merges them with the
 * DefiLlama live values and the dated snapshot CSV (src/lib/extra-metrics.ts).
 */
import type { DexSnap, HackSnap, StablecoinSnap, TokenSnap, YieldPoolSnap } from "./extra-types";
import type { MetricId } from "./sector-metrics";

export type Values = Partial<Record<MetricId, number>>;

export interface StablecoinMapRow {
  project: string;
  id: string;
  primary: boolean;
}

/**
 * Supply on NEAR plus Aurora for each stablecoin project. Only the row marked primary carries the value; any
 * other row for the same coin is told where it is counted (accuracy rule 9), so no total counts it twice.
 */
export function joinStablecoins(coins: StablecoinSnap[], map: StablecoinMapRow[]): { values: Map<string, Values>; countedOn: Map<string, string> } {
  const byId = new Map(coins.map((c) => [c.id, c]));
  const values = new Map<string, Values>();
  const countedOn = new Map<string, string>();
  const primaryOf = new Map(map.filter((r) => r.primary).map((r) => [r.id, r.project]));
  for (const r of map) {
    const coin = byId.get(r.id);
    if (!coin) continue;
    if (!r.primary) {
      const on = primaryOf.get(r.id);
      if (on) countedOn.set(r.project, on);
      continue;
    }
    values.set(r.project, { stablecoinSupply: (coin.near ?? 0) + (coin.aurora ?? 0) });
  }
  return { values, countedOn };
}

/** Total USD-pegged supply on each chain, every coin once. */
export function stablecoinTotals(coins: StablecoinSnap[]): { near: number; aurora: number } {
  return { near: coins.reduce((s, c) => s + (c.near ?? 0), 0), aurora: coins.reduce((s, c) => s + (c.aurora ?? 0), 0) };
}

/**
 * Yield pools per project (matched by DefiLlama slug). The largest pool gives the staking APY for a liquid
 * staking protocol and the largest-pool APY for anything else; lending markets give supplied, borrowed,
 * utilization and a borrow-weighted borrow APY. APYs and utilization are stored as fractions.
 */
export function joinYields(pools: YieldPoolSnap[], slugsOf: Map<string, string[]>, sectorOf: Map<string, string>): Map<string, Values> {
  const bySlug = new Map<string, YieldPoolSnap[]>();
  for (const p of pools) (bySlug.get(p.project) ?? bySlug.set(p.project, []).get(p.project)!).push(p);
  const out = new Map<string, Values>();
  for (const [project, slugs] of slugsOf) {
    const mine = slugs.flatMap((s) => bySlug.get(s) ?? []);
    if (!mine.length) continue;
    const v: Values = { poolCount: mine.length };
    const largest = [...mine].sort((a, b) => b.tvlUsd - a.tvlUsd)[0];
    if (largest.apy !== null) v[sectorOf.get(project) === "Liquid Staking & Restaking" ? "stakingApy" : "bestPoolApy"] = largest.apy / 100;
    const markets = mine.filter((p) => p.totalSupplyUsd !== null && p.totalBorrowUsd !== null);
    if (markets.length) {
      const supplied = markets.reduce((s, p) => s + (p.totalSupplyUsd as number), 0);
      const borrowed = markets.reduce((s, p) => s + (p.totalBorrowUsd as number), 0);
      if (supplied > 0) v.utilization = borrowed / supplied;
      const rated = markets.filter((p) => p.apyBaseBorrow !== null && (p.totalBorrowUsd as number) > 0);
      const weight = rated.reduce((s, p) => s + (p.totalBorrowUsd as number), 0);
      if (weight > 0) v.borrowApy = rated.reduce((s, p) => s + (p.apyBaseBorrow as number) * (p.totalBorrowUsd as number), 0) / weight / 100;
    }
    out.set(project, v);
  }
  return out;
}

export interface GeckoMapRow {
  network: "near" | "aurora";
  dex: string;
  project: string;
  showLiquidity: boolean;
}

/** 24h volume and liquidity per DEX project. Liquidity is left out where the map says so (accuracy rule 6). */
export function joinGecko(dexes: DexSnap[], map: GeckoMapRow[]): Map<string, Values> {
  const out = new Map<string, Values>();
  for (const r of map) {
    const d = dexes.find((x) => x.network === r.network && x.dex === r.dex);
    if (!d) continue;
    const v = out.get(r.project) ?? {};
    v.dexVolume24h = (v.dexVolume24h ?? 0) + d.volume24h;
    if (r.showLiquidity) v.dexLiquidity = (v.dexLiquidity ?? 0) + d.liquidity;
    out.set(r.project, v);
  }
  return out;
}

export interface TokenRow {
  project: string;
  /** NEAR account id or Aurora 0x address. Never a bare symbol (accuracy rule 8). */
  contract: string;
  chain: "near" | "aurora";
}

/**
 * A NEAR account id with at least one dot (token.burrow.near, earn.kaiching), a 64-character implicit account,
 * or an Aurora (EVM) 0x address. A bare symbol such as "RHEA" or "neko" is none of these, so it can never
 * attach a token to a project (accuracy rule 8).
 */
export function isContractId(v: string): boolean {
  const s = v.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return true;
  if (/^[0-9a-f]{64}$/.test(s)) return true;
  if (s !== s.toLowerCase() || s.length < 2 || s.length > 64) return false;
  return /^[a-z0-9]+([_-][a-z0-9]+)*(\.[a-z0-9]+([_-][a-z0-9]+)*)+$/.test(s);
}

/**
 * Token facts per project, matched only by contract (accuracy rule 8): the token list gives supply on NEAR
 * times price. A row whose contract is a bare symbol is ignored, never matched by name or symbol.
 */
export function joinTokens(tokens: TokenSnap[], rows: TokenRow[]): Map<string, Values> {
  const byContract = new Map(tokens.map((t) => [t.contract.toLowerCase(), t]));
  const out = new Map<string, Values>();
  for (const r of rows) {
    if (r.chain !== "near" || !isContractId(r.contract)) continue;
    const t = byContract.get(r.contract.toLowerCase());
    if (!t || t.supplyValue === null) continue;
    const v = out.get(r.project) ?? {};
    v.tokenSupplyValue = (v.tokenSupplyValue ?? 0) + t.supplyValue;
    out.set(r.project, v);
  }
  return out;
}

/** Hacks per project, matched through the name resolver (DefiLlama names such as "Ref Finance" resolve through aliases). */
export function joinHacks(hacks: HackSnap[], resolve: (name: string) => string | null): { byProject: Map<string, HackSnap[]>; unmatched: string[] } {
  const byProject = new Map<string, HackSnap[]>();
  const unmatched: string[] = [];
  for (const h of hacks) {
    const id = resolve(h.name);
    if (!id) {
      unmatched.push(h.name);
      continue;
    }
    (byProject.get(id) ?? byProject.set(id, []).get(id)!).push(h);
  }
  return { byProject, unmatched };
}

/** The last value of a dated series, with its date. */
export function lastPoint(s: Array<[string, number]> | undefined): { date: string; value: number } | null {
  if (!s || !s.length) return null;
  const [date, value] = s[s.length - 1];
  return { date, value };
}
