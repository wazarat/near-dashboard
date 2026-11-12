/**
 * NearBlocks public charts API (api.nearblocks.io/v1/charts): one call returns every day since
 * genesis with transactions, active accounts, new accounts, contracts, price and market cap. No key.
 */
import path from "node:path";
import type { Series } from "../../src/lib/history-types";
import { NEARBLOCKS_SERIES, type NearblocksKey } from "../../src/lib/types";
import { RAW } from "../lib/paths";
import { upsertSeries, writeJsonStable } from "../lib/store";
import type { Ctx, RunResult } from "./context";
import type { TokenSnap, TokensFile } from "../../src/lib/extra-types";
import { HISTORY } from "../lib/paths";
import { parseNearStats, writeChainStats } from "./chain-stats";
import { readChain, writeChain } from "./defillama";
import { createClient } from "./http";

const URL = "https://api.nearblocks.io/v1/charts";

export interface NbRow {
  date: string;
  near_price?: string | null;
  market_cap?: string | null;
  txns?: string | null;
  new_accounts?: string | null;
  active_accounts?: string | null;
  new_contracts?: string | null;
  active_contracts?: string | null;
  txn_fee_usd?: string | null;
  txn_volume_usd?: string | null;
  multichain_txns?: string | null;
}

const FIELD: Record<NearblocksKey, keyof NbRow> = {
  txns: "txns",
  activeAccounts: "active_accounts",
  newAccounts: "new_accounts",
  activeContracts: "active_contracts",
  newContracts: "new_contracts",
  price: "near_price",
  marketCap: "market_cap",
  txnFeeUsd: "txn_fee_usd",
  txnVolumeUsd: "txn_volume_usd",
  multichainTxns: "multichain_txns",
};

/** Rows -> one series per metric. Prices keep 4 decimals; counts and USD are rounded. */
export function parseCharts(json: { charts?: NbRow[] }): Record<NearblocksKey, Series> {
  const out = {} as Record<NearblocksKey, Series>;
  for (const k of NEARBLOCKS_SERIES) out[k] = [];
  for (const r of json.charts ?? []) {
    const d = String(r.date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    for (const k of NEARBLOCKS_SERIES) {
      const raw = r[FIELD[k]];
      if (raw === null || raw === undefined || raw === "") continue;
      const v = Number(raw);
      if (!Number.isFinite(v)) continue;
      out[k].push([d, k === "price" ? Math.round(v * 10_000) / 10_000 : Math.round(v)]);
    }
  }
  for (const k of NEARBLOCKS_SERIES) out[k].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return out;
}

export const TOKENS_FILE = path.join(HISTORY, "extra", "nearblocks-tokens.json");
const API = "https://api.nearblocks.io/v1";

/** NearBlocks /fts rows → price and supply × price. `onchain_market_cap` is minted supply on NEAR times price, never a market cap (rule 5). */
export function parseFts(json: { tokens?: Array<Record<string, unknown>> }): TokenSnap[] {
  const n = (v: unknown) => {
    const x = typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(x) ? x : null;
  };
  return (json.tokens ?? [])
    .filter((t) => typeof t.contract === "string" && t.contract)
    .map((t) => ({ contract: String(t.contract).toLowerCase(), symbol: String(t.symbol ?? ""), price: n(t.price), supplyValue: n(t.onchain_market_cap) === null ? null : Math.round(n(t.onchain_market_cap) as number) }));
}

/** Headers for the optional NearBlocks key; without one the free tier allows about 6 calls a minute. */
export function nearblocksHeaders(env: Record<string, string | undefined>): Record<string, string> {
  const key = (env.NEARBLOCKS_API_KEY ?? "").trim();
  return key ? { Authorization: `Bearer ${key}` } : {};
}

export async function run(ctx: Ctx): Promise<RunResult> {
  const client = createClient({ name: "nearblocks", minIntervalMs: (ctx.env.NEARBLOCKS_API_KEY ?? "").trim() ? 1500 : 10_500, timeoutMs: 120_000, headers: nearblocksHeaders(ctx.env) });
  const json = await client.getJson<{ charts?: NbRow[] }>(URL);
  const parsed = parseCharts(json);
  const chain = readChain();
  for (const k of NEARBLOCKS_SERIES) {
    // Price and market cap are end-of-day snapshots; the rest are daily flows whose current day is partial.
    const stock = k === "price" || k === "marketCap";
    chain.nearblocks[k] = upsertSeries(chain.nearblocks[k] ?? [], parsed[k], { today: ctx.today, allowToday: stock, revisionDays: 3 });
  }
  if (!ctx.dryRun) {
    writeChain(chain);
    writeJsonStable(path.join(RAW, "nearblocks", "charts.json"), {
      source: URL,
      fetchedAt: ctx.today,
      columns: ["date", ...NEARBLOCKS_SERIES],
      rows: (json.charts ?? []).map((r) => [String(r.date).slice(0, 10), ...NEARBLOCKS_SERIES.map((k) => (r[FIELD[k]] === null || r[FIELD[k]] === undefined ? null : Number(r[FIELD[k]])))]),
    });
  }
  const days = parsed.txns.length;
  const notes = [`${days} days from ${parsed.txns[0]?.[0] ?? "-"} to ${parsed.txns.at(-1)?.[0] ?? "-"}`];
  // Chain stats and the token list. Each is optional: a failure is noted and the charts above still count.
  try {
    const stats = parseNearStats(await client.getJson(`${API}/stats`));
    if (!ctx.dryRun && stats) writeChainStats(ctx.today, { near: stats });
    notes.push(`${stats?.nodesOnline ?? "-"} nodes online`);
  } catch (e) {
    notes.push(`stats failed: ${(e as Error).message}`);
  }
  try {
    const tokens: TokenSnap[] = [];
    for (let page = 1; page <= 4; page++) {
      const rows = parseFts(await client.getJson(`${API}/fts?page=${page}&per_page=50&order=desc&sort=onchain_market_cap`));
      tokens.push(...rows);
      if (rows.length < 50) break;
    }
    const file: TokensFile = { asOf: ctx.today, tokens: tokens.sort((a, b) => a.contract.localeCompare(b.contract)) };
    if (!ctx.dryRun) writeJsonStable(TOKENS_FILE, file);
    notes.push(`${tokens.length} tokens priced`);
  } catch (e) {
    notes.push(`token list failed: ${(e as Error).message}`);
  }
  return { rows: days, calls: client.stats().calls, notes };
}
