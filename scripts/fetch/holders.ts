/**
 * Token holders (docs/LIVE-DATA.md, step L). For every verified token contract in data/contracts.csv: holder
 * count on NEAR from NearBlocks (/v1/fts/{contract}/holders/count) and on Aurora from Aurora Blockscout
 * (/api/v2/tokens/{address}). Tokens are matched by contract only, never by symbol (accuracy rule 8), so the
 * spam tokens on Aurora's top-holder list can never attach to a project. NearBlocks allows about 6 calls a
 * minute without a key; NEARBLOCKS_API_KEY lifts that. One dated point per token per run.
 */
import path from "node:path";
import type { HoldersFile } from "../../src/lib/extra-types";
import { isContractId } from "../../src/lib/extra-join";
import { tokenRows } from "../lib/extras";
import { HISTORY } from "../lib/paths";
import { readJson, upsertSeries, writeJsonStable } from "../lib/store";
import { BLOCKSCOUT } from "./blockscout";
import type { Ctx, RunResult } from "./context";
import { createClient, HttpError } from "./http";
import { nearblocksHeaders } from "./nearblocks";

export const FILE = path.join(HISTORY, "extra", "holders.json");

export function parseNearHolders(json: { holders?: Array<{ count?: string | number }> }): number | null {
  const v = Number(json.holders?.[0]?.count);
  return Number.isFinite(v) ? v : null;
}

export function parseAuroraHolders(json: { holders_count?: string | number | null; holders?: string | number | null }): number | null {
  const v = Number(json.holders_count ?? json.holders);
  return Number.isFinite(v) ? v : null;
}

export async function run(ctx: Ctx): Promise<RunResult> {
  const rows = tokenRows().filter((r) => isContractId(r.contract));
  const hasKey = Boolean((ctx.env.NEARBLOCKS_API_KEY ?? "").trim());
  const nb = createClient({ name: "nearblocks-holders", minIntervalMs: hasKey ? 1500 : 10_500, timeoutMs: 60_000, headers: nearblocksHeaders(ctx.env) });
  const bs = createClient({ name: "blockscout-holders", minIntervalMs: 1000, timeoutMs: 60_000 });
  const file = readJson<HoldersFile>(FILE, { near: {}, aurora: {} });
  const notes: string[] = [];
  let got = 0;
  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.chain}|${r.contract.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const count =
        r.chain === "near"
          ? parseNearHolders(await nb.getJson(`https://api.nearblocks.io/v1/fts/${encodeURIComponent(r.contract)}/holders/count`))
          : parseAuroraHolders(await bs.getJson(`${BLOCKSCOUT}/tokens/${r.contract}`));
      if (count === null) continue;
      const k = r.contract.toLowerCase();
      file[r.chain][k] = upsertSeries(file[r.chain][k] ?? [], [[ctx.today, count]], { today: ctx.today, allowToday: true });
      got += 1;
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) notes.push(`${r.contract}: not a token on ${r.chain}`);
      else notes.push(`${r.contract}: ${(e as Error).message}`);
    }
  }
  if (!ctx.dryRun) writeJsonStable(FILE, file);
  return { rows: got, calls: nb.stats().calls + bs.stats().calls, notes: [`${got} of ${seen.size} token contracts counted`, ...notes.slice(0, 10)] };
}
