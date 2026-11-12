/**
 * DefiLlama yields (yields.llama.fi), free and keyless. Pools on NEAR and Aurora from /pools, with the lending
 * markets' supplied, borrowed and borrow APY from /lendBorrow. Pools join projects through their DefiLlama
 * slug in data/defillama-map.csv.
 */
import path from "node:path";
import type { YieldPoolSnap, YieldsFile } from "../../src/lib/extra-types";
import { HISTORY } from "../lib/paths";
import { writeJsonStable } from "../lib/store";
import type { Ctx, RunResult } from "./context";
import { createClient } from "./http";

export const FILE = path.join(HISTORY, "extra", "yields.json");

interface RawPool {
  pool?: string;
  project?: string;
  chain?: string;
  symbol?: string;
  tvlUsd?: number;
  apy?: number | null;
}
interface RawLend {
  pool?: string;
  totalSupplyUsd?: number | null;
  totalBorrowUsd?: number | null;
  apyBaseBorrow?: number | null;
}

const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseYields(pools: { data?: RawPool[] }, lend: RawLend[]): YieldPoolSnap[] {
  const byPool = new Map((Array.isArray(lend) ? lend : []).map((l) => [l.pool, l]));
  return (pools.data ?? [])
    .filter((p) => (p.chain === "Near" || p.chain === "Aurora") && p.pool && p.project)
    .map((p) => {
      const l = byPool.get(p.pool);
      return {
        pool: String(p.pool),
        project: String(p.project),
        chain: p.chain as "Near" | "Aurora",
        symbol: String(p.symbol ?? ""),
        tvlUsd: Math.round(n(p.tvlUsd) ?? 0),
        apy: n(p.apy) === null ? null : Math.round((n(p.apy) as number) * 100) / 100,
        totalSupplyUsd: l ? n(l.totalSupplyUsd) : null,
        totalBorrowUsd: l ? n(l.totalBorrowUsd) : null,
        apyBaseBorrow: l ? n(l.apyBaseBorrow) : null,
      };
    })
    .sort((a, b) => a.pool.localeCompare(b.pool));
}

export async function run(ctx: Ctx): Promise<RunResult> {
  const client = createClient({ name: "yields", minIntervalMs: 1000, timeoutMs: 180_000 });
  const pools = await client.getJson<{ data?: RawPool[] }>("https://yields.llama.fi/pools");
  const lend = await client.getJson<RawLend[]>("https://yields.llama.fi/lendBorrow");
  const parsed = parseYields(pools, lend);
  const file: YieldsFile = { asOf: ctx.today, pools: parsed };
  if (!ctx.dryRun) writeJsonStable(FILE, file);
  return { rows: parsed.length, calls: client.stats().calls, notes: [`${parsed.length} pools on NEAR and Aurora, ${parsed.filter((p) => p.totalSupplyUsd !== null).length} lending markets`] };
}
