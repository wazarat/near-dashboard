/**
 * GeckoTerminal (api.geckoterminal.com/api/v2), free and keyless, about 30 calls a minute. Per DEX on NEAR and
 * Aurora: 24h volume, liquidity and pool count over its top pools, and the top pairs. A 429 comes back with no
 * CORS header, so the client retries it server-side with backoff. NEAR Intents is modelled as pools there, so
 * its liquidity is not DEX liquidity and the site hides it (accuracy rule 6).
 */
import path from "node:path";
import type { DexSnap, GeckoFile } from "../../src/lib/extra-types";
import { HISTORY } from "../lib/paths";
import { writeJsonStable } from "../lib/store";
import type { Ctx, RunResult } from "./context";
import { createClient } from "./http";

export const BASE = "https://api.geckoterminal.com/api/v2";
export const FILE = path.join(HISTORY, "extra", "geckoterminal.json");

interface RawPool {
  attributes?: { name?: string; reserve_in_usd?: string | null; volume_usd?: { h24?: string | null } };
}

const num = (v: string | null | undefined): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** One DEX's top pools → its summary. */
export function summariseDex(network: DexSnap["network"], dex: string, name: string, pools: { data?: RawPool[] }): DexSnap {
  const list = pools.data ?? [];
  const sorted = [...list].sort((a, b) => num(b.attributes?.volume_usd?.h24) - num(a.attributes?.volume_usd?.h24));
  return {
    network,
    dex,
    name,
    volume24h: Math.round(list.reduce((s, p) => s + num(p.attributes?.volume_usd?.h24), 0)),
    liquidity: Math.round(list.reduce((s, p) => s + num(p.attributes?.reserve_in_usd), 0)),
    pools: list.length,
    topPairs: sorted.slice(0, 3).map((p) => String(p.attributes?.name ?? "")).filter(Boolean),
  };
}

export async function run(ctx: Ctx): Promise<RunResult> {
  const client = createClient({ name: "geckoterminal", minIntervalMs: 2500, timeoutMs: 60_000, headers: { accept: "application/json" } });
  const dexes: DexSnap[] = [];
  const notes: string[] = [];
  for (const network of ["near", "aurora"] as const) {
    const list = await client.getJson<{ data?: Array<{ id?: string; attributes?: { name?: string } }> }>(`${BASE}/networks/${network}/dexes`);
    for (const d of list.data ?? []) {
      if (!d.id) continue;
      try {
        const pools = await client.getJson<{ data?: RawPool[] }>(`${BASE}/networks/${network}/dexes/${encodeURIComponent(d.id)}/pools?page=1`);
        dexes.push(summariseDex(network, d.id, d.attributes?.name ?? d.id, pools));
      } catch (e) {
        notes.push(`${network}/${d.id} failed: ${(e as Error).message}`);
      }
    }
  }
  dexes.sort((a, b) => a.network.localeCompare(b.network) || a.dex.localeCompare(b.dex));
  const file: GeckoFile = { asOf: ctx.today, dexes };
  if (!ctx.dryRun) writeJsonStable(FILE, file);
  return { rows: dexes.length, calls: client.stats().calls, notes: [`${dexes.length} DEXes on NEAR and Aurora`, ...notes] };
}
