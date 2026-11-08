/**
 * Seeds data/contracts.csv (Project, Account ID, Role, Source, Verified) from NEAR Catalog project
 * details, DefiLlama `address` fields and a short list of well-known accounts. Existing rows are
 * kept (hand edits win); new rows are appended with Verified=No unless they come from the known list.
 *
 *   npm run seed:contracts            # fetches Catalog details for CSV projects that have a catalog slug
 *   npm run seed:contracts -- --dry   # report only
 */
import path from "node:path";
import { normalizeName, toProject } from "../src/lib/parse";
import { fetchCatalogDetail, fetchCatalogList } from "./fetch/catalog";
import { readProtocols } from "./fetch/defillama";
import { createClient } from "./fetch/http";
import { findFile, readCsv, readCsvOrEmpty, writeCsv } from "./lib/csv";
import { DATA } from "./lib/paths";

/** Accounts confirmed from public docs and explorers. Role: core | token | staking | bridge | aggregator. */
const KNOWN: Array<[project: string, account: string, role: string]> = [
  ["NEAR Intents", "intents.near", "core"],
  ["Aurora", "aurora", "core"],
  ["Rhea Finance", "v2.ref-finance.near", "core"],
  ["Rhea Finance", "dclv2.ref-labs.near", "core"],
  ["Rhea Lend (formerly Burrow)", "contract.main.burrow.near", "core"],
  ["Rhea LST (rNEAR)", "rnear.rhealab.near", "staking"],
  ["Meta Pool", "meta-pool.near", "staking"],
  ["Meta Pool", "meta-token.near", "token"],
  ["LiNEAR Protocol", "linear-protocol.near", "staking"],
  ["SWEAT (Sweat Economy)", "token.sweat", "token"],
  ["HOT Wallet (HOT Protocol)", "game.hot.tg", "core"],
  ["HOT Wallet (HOT Protocol)", "v2_1.omni.hot.tg", "bridge"],
  ["Near Social", "social.near", "core"],
  ["USDT", "usdt.tether-token.near", "token"],
  ["USDC", "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", "token"],
  ["NEAR Omni Bridge", "omni.bridge.near", "bridge"],
  ["Rainbow Bridge", "factory.bridge.near", "bridge"],
  ["Jumbo Exchange", "v1.jumbo_exchange.near", "core"],
  ["Veax", "veax.near", "core"],
  ["Delta Trade", "deltabot.near", "core"],
  ["Meme Cooking", "meme-cooking.near", "core"],
  ["Templar Protocol", "templar.near", "core"],
  ["Orderly Network", "asset-manager.orderly-network.near", "core"],
  ["Allstake", "allstake.near", "staking"],
  ["Shitzu", "token.0xshitzu.near", "token"],
  ["Black Dragon", "blackdragon.tkn.near", "token"],
  ["POTLOCK", "donate.potlock.near", "core"],
  ["AstroDAO", "sputnik-dao.near", "core"],
  ["NEAR House of Stake", "venear.houseofstake.near", "core"],
];

async function main() {
  const dry = process.argv.includes("--dry");
  const projects = readCsv(findFile("near-ecosystem-", ".csv")).map(toProject);
  const names = new Set(projects.map((p) => p.name));
  const byNorm = new Map(projects.map((p) => [normalizeName(p.name), p.name]));
  const file = path.join(DATA, "contracts.csv");
  const existing = readCsvOrEmpty(file).map((r) => ({ Project: r["Project"] ?? "", "Account ID": (r["Account ID"] ?? "").toLowerCase(), Role: r["Role"] ?? "", Source: r["Source"] ?? "", Verified: r["Verified"] ?? "" }));
  const have = new Set(existing.map((r) => `${r.Project}|${r["Account ID"]}`));
  const rows = [...existing];
  const add = (project: string, account: string, role: string, source: string, verified: string) => {
    const acct = account.toLowerCase();
    if (!names.has(project) || !acct || have.has(`${project}|${acct}`)) return;
    rows.push({ Project: project, "Account ID": acct, Role: role, Source: source, Verified: verified });
    have.add(`${project}|${acct}`);
  };
  for (const [project, account, role] of KNOWN) add(project, account, role, "known account", "Yes");

  // DefiLlama `address` fields ("near:token.x.near").
  for (const p of readProtocols()) {
    const m = (p.address ?? "").match(/^near:([a-z0-9._-]+)$/);
    if (!m) continue;
    const project = byNorm.get(normalizeName(p.name));
    if (project) add(project, m[1], "token", `defillama ${p.slug}`, "No");
  }

  // NEAR Catalog details for CSV projects with a catalog source URL or a name match.
  const client = createClient({ name: "catalog", minIntervalMs: 1000, timeoutMs: 60_000 });
  const list = await fetchCatalogList(client);
  const slugByProject = new Map<string, string>();
  for (const p of projects) {
    const m = (p.sourceUrl ?? "").match(/nearcatalog\.xyz\/project\/([a-z0-9-]+)/);
    if (m) slugByProject.set(p.name, m[1]);
  }
  for (const c of list) {
    const project = byNorm.get(normalizeName(c.name));
    if (project && !slugByProject.has(project)) slugByProject.set(project, c.slug);
  }
  let withContracts = 0;
  let i = 0;
  for (const [project, slug] of slugByProject) {
    i += 1;
    try {
      const d = await fetchCatalogDetail(client, slug);
      if (d?.contracts.length) {
        withContracts += 1;
        for (const a of d.contracts) add(project, a, "catalog", `nearcatalog ${slug}`, "No");
      }
    } catch (e) {
      console.log(`  ${slug}: ${(e as Error).message}`);
    }
    if (i % 50 === 0) console.log(`  ${i}/${slugByProject.size} catalog details fetched`);
  }
  console.log(`\ncontracts: ${rows.length} rows across ${new Set(rows.map((r) => r.Project)).size} projects; ${withContracts} of ${slugByProject.size} catalog projects list contracts\n`);
  if (!dry) {
    const changed = writeCsv(file, rows, ["Project", "Account ID", "Role", "Source", "Verified"]);
    console.log(`${changed ? "wrote" : "unchanged"} ${path.relative(process.cwd(), file)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
