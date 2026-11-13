/**
 * Used by .github/workflows/intents-backfill.yml so a backfill run can never lose to another commit on main.
 *
 *   tsx scripts/ci/keep-intents-backfill.ts save <dir>     copies the per-day files this run changed and its
 *                                                          Intents cursor and status into <dir>
 *   tsx scripts/ci/keep-intents-backfill.ts restore <dir>  after `git reset --hard origin/main`: puts those day
 *                                                          files back and writes only the Intents cursor and
 *                                                          status into the current data/history/_meta.json
 *
 * Every other file and every other field is taken from main as it is.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { HistoryMeta } from "../../src/lib/history-types";
import { HISTORY, ROOT } from "../lib/paths";
import { readJson, writeJsonStable } from "../lib/store";

const DAILY = "data/raw/intents/daily";
const META = path.join(HISTORY, "_meta.json");

/** The saved Intents state laid over the meta file that is on main now. Pure, so it is tested. */
export function mergeIntentsState(current: HistoryMeta, saved: Pick<HistoryMeta, "cursors" | "perSource">): HistoryMeta {
  return {
    ...current,
    cursors: { ...current.cursors, intents: { ...saved.cursors.intents, newestCreatedAt: current.cursors.intents?.newestCreatedAt ?? saved.cursors.intents.newestCreatedAt } },
    perSource: { ...current.perSource, intents: saved.perSource.intents },
  };
}

function git(...args: string[]): string[] {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).split("\n").map((l) => l.trim()).filter(Boolean);
}

function main() {
  const [mode, dir] = process.argv.slice(2);
  if ((mode !== "save" && mode !== "restore") || !dir) throw new Error("usage: keep-intents-backfill.ts save|restore <dir>");
  const keep = path.resolve(dir);
  if (mode === "save") {
    fs.mkdirSync(path.join(keep, "daily"), { recursive: true });
    const changed = [...git("diff", "--name-only", "HEAD", "--", DAILY), ...git("ls-files", "--others", "--exclude-standard", "--", DAILY)];
    for (const f of changed) fs.copyFileSync(path.join(ROOT, f), path.join(keep, "daily", path.basename(f)));
    const meta = readJson<HistoryMeta | null>(META, null);
    if (!meta) throw new Error("data/history/_meta.json is missing");
    fs.writeFileSync(path.join(keep, "state.json"), JSON.stringify({ cursors: { intents: meta.cursors.intents }, perSource: { intents: meta.perSource.intents } }));
    console.log(`saved ${changed.length} day files and the Intents cursor (oldest ${meta.cursors.intents.oldestCreatedAt ?? "-"}, done ${meta.cursors.intents.backfillDone})`);
    return;
  }
  const files = fs.existsSync(path.join(keep, "daily")) ? fs.readdirSync(path.join(keep, "daily")) : [];
  for (const f of files) fs.copyFileSync(path.join(keep, "daily", f), path.join(ROOT, DAILY, f));
  const saved = JSON.parse(fs.readFileSync(path.join(keep, "state.json"), "utf8")) as Pick<HistoryMeta, "cursors" | "perSource">;
  const current = readJson<HistoryMeta | null>(META, null);
  if (!current) throw new Error("data/history/_meta.json is missing");
  writeJsonStable(META, mergeIntentsState(current, saved));
  console.log(`restored ${files.length} day files and the Intents cursor`);
}

if (require.main === module) main();
