/**
 * NEAR RPC `validators` (free, keyless): the stake of every validator pool in the current epoch. Tries the
 * FastNEAR free endpoint first and falls back to rpc.mainnet.near.org. When both fail the last good file is kept
 * and the run reports a skip, so the site keeps its last stake with its date.
 */
import path from "node:path";
import { parseValidators, type ValidatorsFile } from "../../src/lib/validators";
import { HISTORY } from "../lib/paths";
import { writeJsonStable } from "../lib/store";
import { skipped, type Ctx, type RunResult } from "./context";
import { UA } from "./http";

export const ENDPOINTS = ["https://free.rpc.fastnear.com", "https://rpc.mainnet.near.org"];
export const FILE = path.join(HISTORY, "extra", "validators.json");

async function call(endpoint: string, fetchImpl: typeof fetch): Promise<Parameters<typeof parseValidators>[0]> {
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": UA },
    body: JSON.stringify({ jsonrpc: "2.0", id: "atlas", method: "validators", params: [null] }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${endpoint}`);
  const json = (await res.json()) as { result?: Parameters<typeof parseValidators>[0]; error?: unknown };
  if (json.error || !json.result) throw new Error(`RPC error from ${endpoint}: ${JSON.stringify(json.error ?? "no result").slice(0, 200)}`);
  return json.result;
}

export async function run(ctx: Ctx, fetchImpl: typeof fetch = fetch): Promise<RunResult> {
  const errors: string[] = [];
  let calls = 0;
  for (const endpoint of ENDPOINTS) {
    // One retry per endpoint before falling back, since a single RPC call can time out under load.
    for (let attempt = 0; attempt < 2; attempt++) {
      calls += 1;
      try {
        const { epochHeight, pools } = parseValidators(await call(endpoint, fetchImpl));
        if (!pools.length) throw new Error(`${endpoint} returned no validators`);
        const file: ValidatorsFile = { asOf: ctx.today, epochHeight, endpoint, pools };
        if (!ctx.dryRun) writeJsonStable(FILE, file);
        const total = pools.reduce((a, p) => a + p.stake, 0);
        return { rows: pools.length, calls, notes: [`${pools.length} validators in epoch ${epochHeight ?? "?"}, ${Math.round(total / 1e6)}M NEAR staked, from ${new URL(endpoint).host}`] };
      } catch (e) {
        errors.push((e as Error).message.slice(0, 160));
      }
    }
  }
  return { ...skipped(`every RPC endpoint failed, kept the last file (${errors[errors.length - 1] ?? "unknown error"})`), calls };
}
