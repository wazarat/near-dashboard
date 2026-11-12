/**
 * Seeds data/intents-referrals.csv (Referral, Project, Verified, Notes) from the NEAR Intents Explorer data
 * (docs/LIVE-DATA.md, requirement 6): the top 50 referral tags by volume over the last 30 complete days,
 * matched to projects by name. Rows already in the file are kept (hand labels win).
 *
 * - An exact name match (the tag equals the project's name with spaces and punctuation removed) is Verified Yes
 *   and shows on the site.
 * - A looser match (the tag starts the project's name, or the reverse) is Verified No: listed for labelling,
 *   not shown until someone sets it to Yes.
 * - Tags with no match are printed for labelling.
 *
 *   npm run seed:referrals
 */
import fs from "node:fs";
import path from "node:path";
import { referralTotals } from "../src/lib/referrals";
import { normalizeName, toProject } from "../src/lib/parse";
import { findFile, readCsv, readCsvOrEmpty, writeCsv } from "./lib/csv";
import { DATA, RAW } from "./lib/paths";

const FILE = path.join(DATA, "intents-referrals.csv");
const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The part of a tag that names the app: "voltra.intents-referral.near" → "voltra", "ref.hevn.tg" → "ref.hevn". */
export function tagName(tag: string): string {
  return tag.replace(/\.intents-referral\.near$/, "").replace(/\.(near|tg)$/, "");
}

function main() {
  const dir = path.join(RAW, "intents", "daily");
  const days = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))) : [];
  const totals = referralTotals(days, 30);
  const top = totals.rows.slice(0, 50);

  const projects = readCsv(findFile("near-ecosystem-", ".csv")).map(toProject);
  // Names that flatten to the same key ("Aurora" and "Aurora+") are ambiguous and match nothing.
  const byFlat = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const p of projects) {
    for (const k of new Set([flat(p.name), flat(normalizeName(p.name))])) {
      if (byFlat.has(k) && byFlat.get(k) !== p.name) ambiguous.add(k);
      else byFlat.set(k, p.name);
    }
  }
  for (const k of ambiguous) byFlat.delete(k);

  const existing = readCsvOrEmpty(FILE).map((r) => ({ Referral: r["Referral"] ?? "", Project: r["Project"] ?? "", Verified: r["Verified"] ?? "", Notes: r["Notes"] ?? "" }));
  const have = new Set(existing.map((r) => r.Referral));
  const rows = [...existing];
  const unmatched: string[] = [];
  for (const t of top) {
    if (have.has(t.key)) continue;
    const name = flat(tagName(t.key));
    const exact = name.length >= 3 ? byFlat.get(name) : undefined;
    let loose: string | undefined;
    if (!exact && name.length >= 4) {
      for (const [f, project] of byFlat) {
        if (f.length >= 4 && (f.startsWith(name) || name.startsWith(f))) {
          loose = project;
          break;
        }
      }
    }
    const usd = `$${Math.round(t.usd).toLocaleString("en-US")} over ${totals.days} days`;
    if (exact) rows.push({ Referral: t.key, Project: exact, Verified: "Yes", Notes: `exact name match; ${usd}` });
    else if (loose) rows.push({ Referral: t.key, Project: loose, Verified: "No", Notes: `name prefix match, needs a label; ${usd}` });
    else {
      rows.push({ Referral: t.key, Project: "", Verified: "No", Notes: `no project matched; ${usd}` });
      unmatched.push(`${t.key} (${usd})`);
    }
  }
  writeCsv(FILE, rows, ["Referral", "Project", "Verified", "Notes"]);
  console.log(`intents-referrals: ${rows.length} rows, ${rows.filter((r) => r.Verified === "Yes").length} verified, ${rows.filter((r) => r.Project && r.Verified !== "Yes").length} to label, ${unmatched.length} unmatched`);
  if (unmatched.length) console.log(`\nunmatched referral tags, for labelling:\n${unmatched.map((u) => `  ${u}`).join("\n")}`);
}

main();
