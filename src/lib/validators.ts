/**
 * NEAR staked with each validator operator (docs/SECTOR-METRICS.md, section 3, Validators). The NEAR RPC
 * `validators` method lists every pool in the current epoch with its stake in yoctoNEAR; data/validator-pools.csv
 * maps pools to atlas projects, and only rows marked Verified count.
 */
export interface ValidatorPool {
  pool: string;
  /** Whole NEAR, rounded down. */
  stake: number;
}

export interface ValidatorsFile {
  asOf: string;
  epochHeight: number | null;
  endpoint: string;
  pools: ValidatorPool[];
}

export interface ValidatorMapRow {
  project: string;
  pool: string;
  verified: boolean;
}

interface RpcValidator {
  account_id?: string;
  stake?: string;
}

/** The current epoch's pools from a `validators` RPC result, largest stake first. */
export function parseValidators(result: { current_validators?: RpcValidator[]; epoch_height?: number } | undefined): { epochHeight: number | null; pools: ValidatorPool[] } {
  const pools: ValidatorPool[] = [];
  for (const v of result?.current_validators ?? []) {
    if (!v.account_id || !v.stake || !/^\d+$/.test(v.stake)) continue;
    pools.push({ pool: v.account_id, stake: Number(BigInt(v.stake) / BigInt("1000000000000000000000000")) });
  }
  pools.sort((a, b) => b.stake - a.stake || a.pool.localeCompare(b.pool));
  return { epochHeight: typeof result?.epoch_height === "number" ? result.epoch_height : null, pools };
}

/** Stake per project over its verified pools. A pool missing from the current set adds nothing, so a dropped pool never counts a stale stake. */
export function stakeByProject(pools: readonly ValidatorPool[], map: readonly ValidatorMapRow[]): Map<string, number> {
  const byPool = new Map(pools.map((p) => [p.pool, p.stake]));
  const out = new Map<string, number>();
  for (const r of map) {
    if (!r.verified) continue;
    const s = byPool.get(r.pool);
    if (s === undefined) continue;
    out.set(r.project, (out.get(r.project) ?? 0) + s);
  }
  return out;
}
