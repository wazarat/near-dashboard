/**
 * Data accuracy checks (src/lib/data-checks.ts) over the committed history. Prints a review list of every
 * finding and exits 1 when any check fails. Runs in CI and in the daily refresh before it commits.
 *
 *   npm run check:data
 */
import path from "node:path";
import { crossCheck, gasFeeOutage, hacksWithoutIncident, sharedAccounts, type Finding } from "../src/lib/data-checks";
import { readCsvOrEmpty } from "./lib/csv";
import { DATA, OUT } from "./lib/paths";
import { readJson } from "./lib/store";
import { readChain } from "./fetch/defillama";
import { HISTORY } from "./lib/paths";

/** Exploits from the build's projects against the build's incident events (needs `npm run rebuild` first; skipped without it). */
function hackReview(): Finding[] {
  const projects = readJson<Array<{ id: string; name: string; hacks?: { list: Array<{ date: string }> } }>>(path.join(OUT, "projects.json"), []);
  const events = readJson<Array<{ type: string; projectIds: string[]; date: string }>>(path.join(OUT, "events.json"), []);
  const hacks = projects.flatMap((p) => (p.hacks?.list ?? []).map((h) => ({ project: p.id, name: p.name, date: h.date })));
  return hacksWithoutIncident(hacks, events.filter((e) => e.type === "Incident"));
}

function main() {
  const chain = readChain();
  const findings: Array<Finding | null> = [
    // NEAR daily transactions from two independent sources.
    crossCheck("NEAR daily transactions", { label: "NearBlocks", series: chain.nearblocks.txns ?? [] }, { label: "BigQuery", series: chain.bigquery.transactions ?? [] }),
    gasFeeOutage("Aurora", chain.aurora.gasFees ?? [], chain.aurora.txns ?? []),
    gasFeeOutage("NEAR", chain.near.gasFees ?? [], chain.nearblocks.txns ?? []),
    ...hackReview(),
    ...sharedAccounts(readCsvOrEmpty(path.join(DATA, "contracts.csv")).map((r) => ({ project: (r["Project"] ?? "").trim(), account: (r["Account ID"] ?? "").trim().toLowerCase() }))),
  ];
  const list = findings.filter((f): f is Finding => f !== null);
  console.log(`\nData checks over ${path.relative(process.cwd(), HISTORY)}\n`);
  if (list.length === 0) console.log("  no conflicts\n");
  for (const f of list) console.log(`  ${f.severity === "fail" ? "FAIL  " : "review"}  [${f.rule}] ${f.message}`);
  const failed = list.filter((f) => f.severity === "fail").length;
  if (failed) {
    console.log(`\n  ${failed} check${failed === 1 ? "" : "s"} failed.\n`);
    process.exit(1);
  }
}

main();
