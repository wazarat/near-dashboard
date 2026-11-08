/**
 * NEAR daily price from DefiLlama coins (coins.llama.fi), at most 500 points per call, as a
 * cross-check of the NearBlocks price series. CoinGecko Demo is the optional fallback.
 */
import path from "node:path";
import { addDays, dateOfUnix, toUnixDay } from "../../src/lib/dates";
import type { Series } from "../../src/lib/history-types";
import { RAW } from "../lib/paths";
import { upsertSeries, writeJsonStable } from "../lib/store";
import type { Ctx, RunResult } from "./context";
import { readChain, writeChain } from "./defillama";
import { createClient, type HttpClient } from "./http";

const COIN = "coingecko:near";
export const PRICE_START = "2020-10-13"; // NEAR mainnet transfers enabled

export function parseLlamaChart(json: { coins?: Record<string, { prices?: Array<{ timestamp: number; price: number }> }> }): Series {
  const pts = json.coins?.[COIN]?.prices ?? [];
  const m = new Map<string, number>();
  for (const p of pts) if (Number.isFinite(p.price)) m.set(dateOfUnix(p.timestamp), Math.round(p.price * 10_000) / 10_000);
  return Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

export function parseCoinGecko(json: { prices?: Array<[number, number]>; market_caps?: Array<[number, number]> }): { price: Series; marketCap: Series } {
  const day = (arr: Array<[number, number]> | undefined, scale: number) => {
    const m = new Map<string, number>();
    for (const [ms, v] of arr ?? []) if (Number.isFinite(v)) m.set(dateOfUnix(ms / 1000), Math.round(v * scale) / scale);
    return Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1)) as Series;
  };
  return { price: day(json.prices, 10_000), marketCap: day(json.market_caps, 1) };
}

export async function fetchLlamaPrices(client: HttpClient, start: string, end: string): Promise<Series> {
  let out: Series = [];
  for (let from = start; from <= end; from = addDays(from, 500)) {
    const span = Math.min(500, Math.max(1, Math.round((toUnixDay(end) - toUnixDay(from)) / 86_400) + 1));
    const json = await client.getJson<Parameters<typeof parseLlamaChart>[0]>(`https://coins.llama.fi/chart/${COIN}?start=${toUnixDay(from)}&span=${span}&period=1d`);
    out = upsertSeries(out, parseLlamaChart(json), { today: end, allowToday: true, revisionDays: 10_000 });
  }
  return out;
}

export async function run(ctx: Ctx): Promise<RunResult> {
  const client = createClient({ name: "llama-coins", minIntervalMs: 1000, timeoutMs: 60_000 });
  const chain = readChain();
  const existing = chain.price.llama ?? [];
  const start = ctx.mode === "backfill" || existing.length < 7 ? PRICE_START : addDays(ctx.today, -10);
  const series = await fetchLlamaPrices(client, start, ctx.today);
  chain.price.llama = upsertSeries(existing, series, { today: ctx.today, allowToday: true });
  const notes = [`${series.length} daily prices from ${series[0]?.[0] ?? "-"} (DefiLlama coins)`];
  const key = ctx.env.COINGECKO_DEMO_KEY;
  if (key) {
    try {
      const cg = createClient({ name: "coingecko", minIntervalMs: 2500, timeoutMs: 60_000, headers: { "x-cg-demo-api-key": key } });
      const json = await cg.getJson<Parameters<typeof parseCoinGecko>[0]>(`https://api.coingecko.com/api/v3/coins/near/market_chart?vs_currency=usd&days=365&interval=daily`);
      const parsed = parseCoinGecko(json);
      chain.price.coingecko = upsertSeries(chain.price.coingecko ?? [], parsed.price, { today: ctx.today, allowToday: true });
      chain.price.coingeckoMcap = upsertSeries(chain.price.coingeckoMcap ?? [], parsed.marketCap, { today: ctx.today, allowToday: true });
      notes.push(`CoinGecko fallback: ${parsed.price.length} days`);
    } catch (e) {
      notes.push(`CoinGecko fallback failed: ${(e as Error).message}`);
    }
  }
  if (!ctx.dryRun) {
    writeChain(chain);
    writeJsonStable(path.join(RAW, "llama", "price.json"), { source: `https://coins.llama.fi/chart/${COIN}`, fetchedAt: ctx.today, series: chain.price.llama });
  }
  return { rows: series.length, calls: client.stats().calls, notes };
}
