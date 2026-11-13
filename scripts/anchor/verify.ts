/**
 * Checks the working tree against an anchor record on NEAR mainnet. Needs no key and no NEAR account:
 * it reads the record with a free view call, recomputes both fingerprints and says whether they match.
 *
 *   npm run verify:anchor -- <YYYY-MM-DD> [--rebuild] [--account <id>]
 *
 * --rebuild  runs `npm run rebuild` first, so the outputs are regenerated from the committed inputs
 *
 * For a full check, check out the commit the record names first (the record and the card on /thesis show it).
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { AnchorIndexEntry } from "../../src/lib/history-types";
import { ROOT } from "../lib/paths";
import { ANCHOR_DIR, argValue, computeFingerprints, diffEntries, gitHead, manifestPath, parseManifest, parseRecord, type Entry } from "./fingerprint";
import { loadEnvLocal, nearblocksTxUrl, readAnchor, recordFromTx, socialPath } from "./near";

export const DEFAULT_ACCOUNT = "canhav.near";

/** A file from the working tree, or else from the newest commit on any branch that has it (the manifest and index are committed after the anchored commit). */
function readCommitted(rel: string): string | null {
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs)) return fs.readFileSync(abs, "utf8");
  try {
    const rev = execFileSync("git", ["rev-list", "-1", "--all", "--", rel], { cwd: ROOT, encoding: "utf8" }).trim();
    if (!rev) return null;
    return execFileSync("git", ["show", `${rev}:${rel}`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

function printDiff(label: string, anchored: Entry[], current: Entry[]) {
  const d = diffEntries(anchored, current);
  const lines = [...d.changed.map((p) => `  changed  ${p}`), ...d.removed.map((p) => `  missing  ${p}`), ...d.added.map((p) => `  extra    ${p}`)];
  console.log(`${label} files that differ from the anchored manifest, ${lines.length}`);
  for (const l of lines.slice(0, 40)) console.log(l);
  if (lines.length > 40) console.log(`  and ${lines.length - 40} more`);
}

async function main() {
  const argv = process.argv.slice(2);
  const date = argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  if (!date) {
    console.error("usage, npm run verify:anchor -- <YYYY-MM-DD> [--rebuild]");
    process.exit(2);
  }
  loadEnvLocal(ROOT);
  const idx = JSON.parse(readCommitted(`${ANCHOR_DIR}/index.json`) ?? "{}") as Record<string, AnchorIndexEntry>;
  const entry = idx[date];
  const account = argValue(argv, "--account") ?? entry?.account ?? process.env.NEAR_ANCHOR_ACCOUNT_ID ?? DEFAULT_ACCOUNT;

  if (argv.includes("--rebuild")) {
    console.log("rebuilding outputs from the committed inputs");
    const r = spawnSync("npm", ["run", "rebuild", "--silent"], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }

  const onchain = await readAnchor(account, date);
  if (!onchain) {
    console.error(`no anchor onchain at ${socialPath(account, date)}`);
    process.exit(1);
  }
  const record = parseRecord(onchain.value);
  console.log(`onchain record  ${socialPath(account, date)} at block ${onchain.blockHeight}`);
  console.log(`                ${onchain.value}`);

  const head = gitHead(ROOT);
  if (head !== record.commit) console.log(`note, HEAD is ${head.slice(0, 12)} but the record is for ${record.commit.slice(0, 12)}, run git checkout ${record.commit} for a full check`);

  const fp = computeFingerprints(ROOT);
  const inputsOk = fp.inputsHash === record.inputs;
  const outputsOk = fp.outputsHash === record.outputs;
  console.log(`inputs   ${inputsOk ? "match" : "MISMATCH"}  ${fp.inputsHash}  (${fp.inputs.length} files)`);
  console.log(`outputs  ${outputsOk ? "match" : "MISMATCH"}  ${fp.outputsHash}  (${fp.outputs.length} files)`);

  if (!inputsOk || !outputsOk) {
    const text = readCommitted(manifestPath(date));
    if (!text) console.log(`no manifest for ${date} found in ${ANCHOR_DIR}, cannot name the files`);
    else {
      const m = parseManifest(text);
      if (!inputsOk) printDiff("inputs", m.inputs, fp.inputs);
      if (!outputsOk) printDiff("outputs", m.outputs, fp.outputs);
      if (!outputsOk && !argv.includes("--rebuild")) console.log("outputs come from npm run rebuild, try again with --rebuild");
    }
  }

  if (entry) {
    const unchanged = entry.blockHeight === onchain.blockHeight;
    console.log(`written  ${unchanged ? "once" : "REWRITTEN"}, index says block ${entry.blockHeight}, SocialDB says ${onchain.blockHeight}`);
    console.log(`tx       ${nearblocksTxUrl(entry.txHash)}`);
    const fromTx = await recordFromTx(entry.txHash, account, account, date).catch(() => undefined);
    if (fromTx === undefined) console.log("tx args  not checked, the RPC node no longer has this transaction");
    else console.log(`tx args  ${fromTx === onchain.value ? "carry the same record" : "DIFFER from the stored record"}`);
  }

  process.exit(inputsOk && outputsOk ? 0 : 1);
}

if (require.main === module) main();
