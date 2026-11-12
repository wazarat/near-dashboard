/**
 * Data accuracy checks (src/lib/data-checks.ts) over the committed history. Prints a review list of every
 * finding and exits 1 when any check fails. Runs in CI and in the daily refresh before it commits.
 *
 *   npm run check:data
 */
import path from "node:path";
import { crossCheck, gasFeeOutage, type Finding } from "../src/lib/data-checks";
import { readChain } from "./fetch/defillama";
import { HISTORY } from "./lib/paths";

function main() {
  const chain = readChain();
  const findings: Array<Finding | null> = [
    // NEAR daily transactions from two independent sources.
    crossCheck("NEAR daily transactions", { label: "NearBlocks", series: chain.nearblocks.txns ?? [] }, { label: "BigQuery", series: chain.bigquery.transactions ?? [] }),
    gasFeeOutage("Aurora", chain.aurora.gasFees ?? [], chain.aurora.txns ?? []),
    gasFeeOutage("NEAR", chain.near.gasFees ?? [], chain.nearblocks.txns ?? []),
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
