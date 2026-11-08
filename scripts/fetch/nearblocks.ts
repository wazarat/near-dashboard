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

export async function run(ctx: Ctx): Promise<RunResult> {
  const client = createClient({ name: "nearblocks", minIntervalMs: 1500, timeoutMs: 120_000 });
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
  return { rows: days, calls: client.stats().calls, notes: [`${days} days from ${parsed.txns[0]?.[0] ?? "-"} to ${parsed.txns.at(-1)?.[0] ?? "-"}`] };
}
