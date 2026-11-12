/**
 * Chain-level facts shown on the NEAR Protocol and Aurora pop-ups (docs/LIVE-DATA.md, unmeasured sectors):
 * NearBlocks /v1/stats (nodes online, lifetime transactions, TPS) and Aurora Blockscout /api/v2/stats
 * (lifetime transactions, addresses, blocks). Each fetcher writes its own half of the same file.
 */
import path from "node:path";
import type { ChainStatsFile } from "../../src/lib/extra-types";
import { HISTORY } from "../lib/paths";
import { readJson, writeJsonStable } from "../lib/store";

export const FILE = path.join(HISTORY, "extra", "chain-stats.json");

const int = (v: unknown): number | null => {
  const x = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(x) ? Math.round(x) : null;
};

export function parseNearStats(json: { stats?: Array<Record<string, unknown>> }): ChainStatsFile["near"] {
  const s = json.stats?.[0];
  if (!s) return null;
  return { nodesOnline: int(s.nodes_online), totalTxns: int(s.total_txns), tps: int(s.tps) };
}

export function parseAuroraStats(json: Record<string, unknown>): ChainStatsFile["aurora"] {
  if (!json || typeof json !== "object") return null;
  return { totalTxns: int(json.total_transactions), totalAddresses: int(json.total_addresses), totalBlocks: int(json.total_blocks) };
}

export function writeChainStats(today: string, part: Partial<Pick<ChainStatsFile, "near" | "aurora">>): void {
  const prev = readJson<ChainStatsFile>(FILE, { asOf: today, near: null, aurora: null });
  writeJsonStable(FILE, { ...prev, ...part, asOf: today });
}
