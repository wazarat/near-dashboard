/**
 * Aurora Blockscout (explorer.mainnet.aurora.dev/api/v2), free and keyless. Daily transactions for the
 * Aurora chain from /stats/charts/transactions, which returns about the last 31 days; each run re-takes
 * the trailing 7 so late corrections land. The client retries 429s with backoff on the server side,
 * since Blockscout sends no CORS header on a 429.
 */
import path from "node:path";
import type { Series } from "../../src/lib/history-types";
import { RAW } from "../lib/paths";
import { upsertSeries, writeJsonStable } from "../lib/store";
import type { Ctx, RunResult } from "./context";
import { parseAuroraStats, writeChainStats } from "./chain-stats";
import { readChain, writeChain } from "./defillama";
import { createClient } from "./http";

export const BLOCKSCOUT = "https://explorer.mainnet.aurora.dev/api/v2";

interface ChartRow {
  date?: string;
  transactions_count?: number | string | null;
}

/** chart_data rows -> a sorted daily series. A reported 0 is kept here; the gap rule (src/lib/chain-gaps.ts) decides how it is drawn. */
export function parseTransactionsChart(json: { chart_data?: ChartRow[] }): Series {
  const out: Series = [];
  for (const r of json.chart_data ?? []) {
    const d = String(r.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (r.transactions_count === null || r.transactions_count === undefined || r.transactions_count === "") continue;
    const v = Number(r.transactions_count);
    if (!Number.isFinite(v)) continue;
    out.push([d, Math.round(v)]);
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

export async function run(ctx: Ctx): Promise<RunResult> {
  const client = createClient({ name: "blockscout", minIntervalMs: 1000, timeoutMs: 60_000 });
  const url = `${BLOCKSCOUT}/stats/charts/transactions`;
  const json = await client.getJson<{ chart_data?: ChartRow[] }>(url);
  const parsed = parseTransactionsChart(json);
  const chain = readChain();
  chain.aurora.txns = upsertSeries(chain.aurora.txns ?? [], parsed, { today: ctx.today, revisionDays: 7 });
  const notes = [`${parsed.length} days from ${parsed[0]?.[0] ?? "-"} to ${parsed.at(-1)?.[0] ?? "-"}`];
  let stats: ReturnType<typeof parseAuroraStats> = null;
  try {
    stats = parseAuroraStats(await client.getJson<Record<string, unknown>>(`${BLOCKSCOUT}/stats`));
    notes.push(`lifetime ${stats?.totalTxns ?? "-"} transactions, ${stats?.totalAddresses ?? "-"} addresses`);
  } catch (e) {
    notes.push(`stats failed: ${(e as Error).message}`);
  }
  if (!ctx.dryRun) {
    writeChain(chain);
    writeJsonStable(path.join(RAW, "blockscout", "aurora-transactions.json"), { source: url, fetchedAt: ctx.today, rows: parsed });
    if (stats) writeChainStats(ctx.today, { aurora: stats });
  }
  return { rows: parsed.length, calls: client.stats().calls, notes };
}
