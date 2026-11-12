/**
 * DefiLlama hacks (api.llama.fi/hacks), free and keyless. Every recorded exploit on NEAR or Aurora. Shown as a
 * sourced fact in a project's Security section and cross-checked against the incidents in the events file.
 */
import path from "node:path";
import { dateOfUnix } from "../../src/lib/dates";
import type { HackSnap, HacksFile } from "../../src/lib/extra-types";
import { HISTORY } from "../lib/paths";
import { writeJsonStable } from "../lib/store";
import type { Ctx, RunResult } from "./context";
import { createClient } from "./http";

export const FILE = path.join(HISTORY, "extra", "hacks.json");

interface RawHack {
  name?: string;
  date?: number;
  amount?: number | null;
  chain?: string[];
  classification?: string | null;
  technique?: string | null;
  defillamaId?: string | number | null;
}

export function parseHacks(json: RawHack[]): HackSnap[] {
  return (Array.isArray(json) ? json : [])
    .filter((h) => (h.chain ?? []).some((c) => /^(near|aurora)$/i.test(c)) && h.name && typeof h.date === "number")
    .map((h) => ({
      name: String(h.name),
      date: dateOfUnix(h.date as number),
      amount: typeof h.amount === "number" && Number.isFinite(h.amount) ? h.amount : null,
      classification: h.classification ?? null,
      technique: h.technique ?? null,
      defillamaId: h.defillamaId === null || h.defillamaId === undefined ? null : String(h.defillamaId),
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export async function run(ctx: Ctx): Promise<RunResult> {
  const client = createClient({ name: "hacks", minIntervalMs: 1000, timeoutMs: 120_000 });
  const hacks = parseHacks(await client.getJson<RawHack[]>("https://api.llama.fi/hacks"));
  const file: HacksFile = { asOf: ctx.today, hacks };
  if (!ctx.dryRun) writeJsonStable(FILE, file);
  return { rows: hacks.length, calls: client.stats().calls, notes: [`${hacks.length} exploits on NEAR or Aurora`] };
}
