/**
 * DefiLlama stablecoins (stablecoins.llama.fi), free and keyless. Circulating supply of every USD-pegged coin
 * on NEAR and Aurora. Projects are joined through data/stablecoin-map.csv, where one row per coin is marked
 * primary so a coin listed under two names is counted once (accuracy rule 9).
 */
import path from "node:path";
import type { StablecoinSnap, StablecoinsFile } from "../../src/lib/extra-types";
import { HISTORY } from "../lib/paths";
import { writeJsonStable } from "../lib/store";
import type { Ctx, RunResult } from "./context";
import { createClient } from "./http";

export const URL = "https://stablecoins.llama.fi/stablecoins?includePrices=true";
export const FILE = path.join(HISTORY, "extra", "stablecoins.json");

interface RawAsset {
  id?: string | number;
  name?: string;
  symbol?: string;
  pegType?: string;
  chainCirculating?: Record<string, { current?: Record<string, number> }>;
}

const usd = (c: { current?: Record<string, number> } | undefined): number | null => {
  const v = c?.current?.peggedUSD;
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
};

/** USD-pegged coins with any supply on NEAR or Aurora. Other pegs (EUR) are left out of a USD total. */
export function parseStablecoins(json: { peggedAssets?: RawAsset[] }): StablecoinSnap[] {
  return (json.peggedAssets ?? [])
    .filter((a) => a.pegType === undefined || a.pegType === "peggedUSD")
    .map((a) => ({ id: String(a.id ?? ""), name: String(a.name ?? ""), symbol: String(a.symbol ?? ""), near: usd(a.chainCirculating?.Near), aurora: usd(a.chainCirculating?.Aurora) }))
    .filter((a) => a.id && ((a.near ?? 0) > 0 || (a.aurora ?? 0) > 0))
    .sort((a, b) => Number(a.id) - Number(b.id));
}

export async function run(ctx: Ctx): Promise<RunResult> {
  const client = createClient({ name: "stablecoins", minIntervalMs: 1000, timeoutMs: 120_000 });
  const coins = parseStablecoins(await client.getJson(URL));
  const file: StablecoinsFile = { asOf: ctx.today, coins };
  if (!ctx.dryRun) writeJsonStable(FILE, file);
  const total = (k: "near" | "aurora") => coins.reduce((s, c) => s + (c[k] ?? 0), 0);
  return { rows: coins.length, calls: client.stats().calls, notes: [`${coins.length} coins, NEAR $${Math.round(total("near") / 1e6)}M, Aurora $${(total("aurora") / 1e6).toFixed(1)}M`] };
}
