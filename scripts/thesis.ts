/**
 * Computes every number behind the /thesis page and renders THESIS.md from the committed raw
 * files. The statistical tests arrive with the Intents and thesis milestone; until then this writes
 * an "unavailable" marker so `npm run rebuild` and the static build keep working.
 */
import fs from "node:fs";
import path from "node:path";
import { OUT } from "./lib/paths";

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, "thesis.json");
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ available: false, reason: "thesis computations not yet implemented" }));
  console.log("  thesis: no computations yet (pending the Intents and thesis milestone)\n");
}

main();
