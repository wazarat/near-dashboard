/**
 * Fetch the latest day (or full history with --backfill) from every free source into
 * data/history and data/raw. Each source is isolated: a failure is recorded in _meta.json and
 * the others still run. Exit code is 0 unless every source failed (or --strict).
 *
 *   npm run refresh
 *   npm run refresh -- --backfill
 *   npm run refresh -- --only defillama,nearblocks --verbose --dry-run --max-calls 200
 */
import fs from "node:fs";
import path from "node:path";
import { isoNow, utcToday } from "../src/lib/dates";
import { emptyMeta, emptySourceStatus, SOURCE_IDS, type HistoryMeta, type SourceId } from "../src/lib/history-types";
import type { Ctx, Source } from "./fetch/context";
import * as bigquery from "./fetch/bigquery";
import * as blockscout from "./fetch/blockscout";
import * as geckoterminal from "./fetch/geckoterminal";
import * as hacks from "./fetch/hacks";
import * as holders from "./fetch/holders";
import * as stablecoins from "./fetch/stablecoins";
import * as yields from "./fetch/yields";
import * as catalog from "./fetch/catalog";
import * as defillama from "./fetch/defillama";
import * as intents from "./fetch/intents";
import * as nearblocks from "./fetch/nearblocks";
import * as price from "./fetch/price";
import { log, setVerbose } from "./lib/log";
import { runSource } from "./lib/run-source";
import { HISTORY } from "./lib/paths";
import { readJson, writeJsonStable } from "./lib/store";

const SOURCES: Source[] = [
  { id: "defillama", run: defillama.run },
  { id: "nearblocks", run: nearblocks.run },
  { id: "blockscout", run: blockscout.run },
  { id: "stablecoins", run: stablecoins.run },
  { id: "yields", run: yields.run },
  { id: "hacks", run: hacks.run },
  { id: "geckoterminal", run: geckoterminal.run },
  { id: "holders", run: holders.run },
  { id: "catalog", run: catalog.run },
  { id: "price", run: price.run },
  { id: "bigquery", run: bigquery.run },
  { id: "intents", run: intents.run },
];

export function loadEnvLocal(): void {
  const file = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined && m[2] !== "") process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function parseArgs(argv: string[]) {
  const only = new Set<SourceId>();
  const flags = { backfill: false, strict: false, dryRun: false, verbose: false, maxCalls: 500 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--backfill") flags.backfill = true;
    else if (a === "--strict") flags.strict = true;
    else if (a === "--dry-run") flags.dryRun = true;
    else if (a === "--verbose") flags.verbose = true;
    else if (a === "--max-calls") flags.maxCalls = Math.max(1, Number(argv[++i]) || 500);
    else if (a.startsWith("--max-calls=")) flags.maxCalls = Math.max(1, Number(a.slice(12)) || 500);
    else if (a === "--only" || a.startsWith("--only=")) {
      const list = a === "--only" ? (argv[++i] ?? "") : a.slice(7);
      for (const s of list.split(",")) {
        if ((SOURCE_IDS as readonly string[]).includes(s)) only.add(s as SourceId);
        else throw new Error(`Unknown source "${s}". Known: ${SOURCE_IDS.join(", ")}`);
      }
    } else throw new Error(`Unknown flag ${a}`);
  }
  return { only, ...flags };
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));
  setVerbose(args.verbose);
  const metaFile = path.join(HISTORY, "_meta.json");
  const meta: HistoryMeta = { ...emptyMeta(), ...readJson<Partial<HistoryMeta>>(metaFile, {}) };
  meta.cursors = { ...emptyMeta().cursors, ...(meta.cursors ?? {}) };
  for (const id of SOURCE_IDS) meta.perSource[id] = { ...emptySourceStatus(), ...(meta.perSource[id] ?? {}) };
  const nowMs = Date.now();
  const ctx: Ctx = { mode: args.backfill ? "backfill" : "daily", today: utcToday(), nowMs, meta, env: process.env, dryRun: args.dryRun, maxCalls: args.maxCalls };
  const ran = new Set<SourceId>();

  /** Merge only what this process changed, so a long backfill and the daily run never clobber each other. */
  const save = () => {
    if (args.dryRun) return;
    const disk: HistoryMeta = { ...emptyMeta(), ...readJson<Partial<HistoryMeta>>(metaFile, {}) };
    disk.cursors = { ...emptyMeta().cursors, ...(disk.cursors ?? {}) };
    for (const id of SOURCE_IDS) disk.perSource[id] = { ...emptySourceStatus(), ...(disk.perSource[id] ?? {}) };
    for (const id of ran) disk.perSource[id] = meta.perSource[id];
    if (ran.has("intents")) {
      // A daily run only refreshes the recent window; it must not clobber the backfill cursor a long local run is advancing.
      const continuing = args.backfill || process.env.INTENTS_CONTINUE_BACKFILL === "1";
      disk.cursors.intents = continuing ? meta.cursors.intents : { ...disk.cursors.intents, newestCreatedAt: meta.cursors.intents.newestCreatedAt };
    }
    if (ran.has("bigquery")) disk.cursors.bigquery = meta.cursors.bigquery;
    if (ran.has("defillama")) {
      disk.cursors.llamaMissing = meta.cursors.llamaMissing;
      disk.unmatchedMap = meta.unmatchedMap;
      disk.unmatchedCsv = meta.unmatchedCsv;
    }
    if (ran.has("defillama") || ran.has("catalog")) disk.newlyDetected = meta.newlyDetected;
    if (meta.lastRun) {
      disk.lastRun = meta.lastRun;
      disk.lastRunDate = meta.lastRunDate;
      disk.mode = meta.mode;
    }
    writeJsonStable(metaFile, disk);
  };
  process.on("SIGINT", () => {
    save();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    save();
    process.exit(143);
  });
  intents.onProgress(save);

  log(`\nNEAR Ecosystem Atlas refresh — ${ctx.mode} — ${ctx.today}${args.dryRun ? " (dry run)" : ""} — max ${args.maxCalls} paged calls per source\n`);
  let ok = 0;
  let failed = 0;
  for (const s of SOURCES) {
    if (args.only.size && !args.only.has(s.id)) continue;
    const st = meta.perSource[s.id];
    ran.add(s.id);
    process.stdout.write(`  ${s.id.padEnd(12)} `);
    const out = await runSource(s, ctx, st);
    if (out.kind === "ok") ok += 1;
    if (out.kind === "failed") failed += 1;
    log(out.line);
    for (const n of st.notes) if (!n.startsWith("skipped:")) log(`${"".padEnd(15)}· ${n}`);
    save();
  }
  // Only a run of every source moves the as-of date: a run limited with --only (a backfill of one source, say)
  // must not tell the rebuild that the whole store is a day newer than it is.
  if (!args.dryRun && args.only.size === 0) {
    meta.lastRun = isoNow();
    meta.lastRunDate = ctx.today;
    meta.mode = ctx.mode;
    save();
  }
  log(`\n  ${ok} sources ok, ${failed} failed. ${meta.newlyDetected.length} newly detected protocols, ${meta.unmatchedMap.length} stale map slugs.\n`);
  if (failed && (args.strict || ok === 0)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
