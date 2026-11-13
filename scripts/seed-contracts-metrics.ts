/**
 * Extends data/contracts.csv from the dated live-metrics snapshot (docs/LIVE-DATA.md, step L): each project's
 * token contract on NEAR and on Aurora (Role token) and its known contracts (Role core), plus the launchpad
 * factories whose sub-accounts are the tokens they launch (Role factory). Then marks every row Verified only
 * when the account exists, on NearBlocks for NEAR and on Aurora Blockscout for a 0x address.
 *
 * Two guards (accuracy rule 8):
 * - Only real account ids or addresses are accepted; a bare symbol never becomes a contract.
 * - One account belongs to one project. The snapshot's token column decides who owns a token; any other
 *   project's token row for that account is dropped. A known contract already owned by another project is
 *   not added, and every such conflict is printed for review.
 *
 *   npm run seed:contracts:metrics            # add rows and verify (about 6 NearBlocks calls a minute without a key)
 *   npm run seed:contracts:metrics -- --dry   # report only
 */
import path from "node:path";
import { isContractId } from "../src/lib/extra-join";
import fs from "node:fs";
import { BLOCKSCOUT } from "./fetch/blockscout";
import { createClient, HttpError } from "./fetch/http";
import { nearblocksHeaders } from "./fetch/nearblocks";
import { findFile, readCsv, readCsvOrEmpty, writeCsv } from "./lib/csv";
import { DATA } from "./lib/paths";

type Row = { Project: string; "Account ID": string; Role: string; Source: string; Verified: string };

/**
 * Roles in data/contracts.csv. token, core, factory, game and treasury come from this script; staking, bridge and
 * catalog are older rows from scripts/seed-contracts.ts and the hand-kept list.
 * - token: the project's own token contract (the snapshot's token columns decide the owner).
 * - core: a known contract of the project.
 * - game: a known contract of a project in NFTs, Gaming & Collectibles (its game or collection contract).
 * - factory: a launchpad factory whose sub-accounts are launched tokens (FACTORIES, with evidence).
 * - treasury: a treasury or fee account, only from TREASURIES with evidence; never guessed from a name
 *   (sputnik-dao.near, for one, is AstroDAO's DAO factory, not a treasury).
 */
export const CONTRACT_ROLES = ["token", "core", "game", "factory", "treasury", "staking", "bridge", "catalog"] as const;

/** Treasury or fee accounts confirmed by the owner, with evidence. Candidates wait in docs/FEE-ACCOUNTS-REVIEW.md until confirmed. */
const TREASURIES: Array<[project: string, account: string, evidence: string]> = [];

const GAMING = "NFTs, Gaming & Collectibles";

/** Launchpad factories, each with the evidence that its sub-accounts are launched tokens. */
const FACTORIES: Array<[project: string, account: string, evidence: string]> = [["Meme Cooking", "meme-cooking.near", "JAMBO is jambo-1679.meme-cooking.near"]];

/** Reads .env.local for an optional NEARBLOCKS_API_KEY, as scripts/refresh.ts does. */
function loadEnvLocal(): void {
  const file = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined && m[2] !== "") process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const isAurora = (a: string) => /^0x[0-9a-f]{40}$/i.test(a);
const norm = (a: string) => (isAurora(a) ? a.toLowerCase() : a.trim().toLowerCase());

async function main() {
  loadEnvLocal();
  const dry = process.argv.includes("--dry");
  const file = path.join(DATA, "contracts.csv");
  let rows: Row[] = readCsvOrEmpty(file).map((r) => ({ Project: r["Project"] ?? "", "Account ID": norm(r["Account ID"] ?? ""), Role: r["Role"] ?? "", Source: r["Source"] ?? "", Verified: r["Verified"] ?? "" }));
  const metrics = readCsv(findFile("near-live-metrics-", ".csv"));
  const conflicts: string[] = [];
  const rejected: string[] = [];

  // 1. Token ownership from the snapshot's token columns.
  const tokenOwner = new Map<string, string>();
  for (const r of metrics) {
    for (const col of ["Token Contract (NEAR)", "Token Contract (Aurora)"]) {
      const a = norm(r[col] ?? "");
      if (!a) continue;
      if (!isContractId(a)) {
        rejected.push(`${r["Project/Company Name"]}: "${a}" in ${col} is not an account id or address`);
        continue;
      }
      tokenOwner.set(a, r["Project/Company Name"] ?? "");
    }
  }
  rows = rows.filter((r) => {
    const owner = tokenOwner.get(r["Account ID"]);
    if (r.Role === "token" && owner && owner !== r.Project) {
      conflicts.push(`dropped ${r.Project} token row ${r["Account ID"]}: the snapshot gives that token to ${owner}`);
      return false;
    }
    return true;
  });

  const ownerOf = new Map<string, string>();
  for (const r of rows) if (!ownerOf.has(r["Account ID"])) ownerOf.set(r["Account ID"], r.Project);
  const have = new Set(rows.map((r) => `${r.Project}|${r["Account ID"]}`));
  const add = (project: string, account: string, role: string, source: string) => {
    const a = norm(account);
    if (!a || !project) return;
    if (!isContractId(a)) {
      rejected.push(`${project}: "${a}" is not an account id or address`);
      return;
    }
    const owner = ownerOf.get(a);
    if (owner && owner !== project) {
      conflicts.push(`skipped ${a} for ${project}: already mapped to ${owner}`);
      return;
    }
    const key = `${project}|${a}`;
    if (have.has(key)) return;
    rows.push({ Project: project, "Account ID": a, Role: role, Source: source, Verified: "" });
    have.add(key);
    ownerOf.set(a, project);
  };

  // 2. New rows from the snapshot and the factory list.
  for (const r of metrics) {
    const project = (r["Project/Company Name"] ?? "").trim();
    for (const col of ["Token Contract (NEAR)", "Token Contract (Aurora)"]) if ((r[col] ?? "").trim()) add(project, r[col] as string, "token", "live-metrics snapshot 2026-11-12");
    const knownRole = (r["Sector/Category"] ?? "").trim() === GAMING ? "game" : "core";
    for (const a of (r["Known Contracts"] ?? "").split(/[\s,;]+/).filter(Boolean)) add(project, a, tokenOwner.get(norm(a)) === project ? "token" : knownRole, "live-metrics snapshot 2026-11-12");
  }
  for (const [project, account, evidence] of FACTORIES) add(project, account, "factory", `factory, ${evidence}`);
  for (const [project, account, evidence] of TREASURIES) add(project, account, "treasury", `treasury, ${evidence}`);
  // Known contracts seeded as core before the game role existed take it when their project is a gaming project.
  const gamingProjects = new Set(metrics.filter((r) => (r["Sector/Category"] ?? "").trim() === GAMING).map((r) => (r["Project/Company Name"] ?? "").trim()));
  for (const r of rows) if (r.Role === "core" && gamingProjects.has(r.Project) && r.Source.startsWith("live-metrics snapshot")) r.Role = "game";
  const unknownRoles = rows.filter((r) => !(CONTRACT_ROLES as readonly string[]).includes(r.Role));
  if (unknownRoles.length) console.log(`\nrows with a role outside ${CONTRACT_ROLES.join(", ")}:\n${unknownRoles.map((r) => `  ${r.Project} ${r["Account ID"]} ${r.Role}`).join("\n")}`);

  // 3. Verify every row not yet verified: the account must exist on NearBlocks or Aurora Blockscout.
  const nb = createClient({ name: "nearblocks", minIntervalMs: (process.env.NEARBLOCKS_API_KEY ?? "").trim() ? 1500 : 10_500, timeoutMs: 60_000, headers: nearblocksHeaders(process.env) });
  const bs = createClient({ name: "blockscout", minIntervalMs: 1000, timeoutMs: 60_000 });
  const cache = new Map<string, boolean>();
  const exists = async (a: string): Promise<boolean> => {
    if (cache.has(a)) return cache.get(a) as boolean;
    let ok = false;
    try {
      if (isAurora(a)) {
        const j = await bs.getJson<{ hash?: string }>(`${BLOCKSCOUT}/addresses/${a}`);
        ok = typeof j.hash === "string";
      } else {
        const j = await nb.getJson<{ account?: Array<{ account_id?: string; deleted?: { transaction_hash?: string | null } }> }>(`https://api.nearblocks.io/v1/account/${encodeURIComponent(a)}`);
        const acc = j.account?.[0];
        ok = Boolean(acc?.account_id) && !acc?.deleted?.transaction_hash;
      }
    } catch (e) {
      if (!(e instanceof HttpError && (e.status === 404 || e.status === 422))) throw e;
    }
    cache.set(a, ok);
    return ok;
  };
  const todo = rows.filter((r) => r.Verified !== "Yes");
  console.log(`checking ${todo.length} unverified accounts`);
  let i = 0;
  for (const r of todo) {
    i += 1;
    if (dry) continue;
    r.Verified = (await exists(r["Account ID"])) ? "Yes" : "No";
    if (i % 10 === 0) console.log(`  ${i}/${todo.length}`);
  }

  rows.sort((a, b) => a.Project.localeCompare(b.Project) || a.Role.localeCompare(b.Role) || a["Account ID"].localeCompare(b["Account ID"]));
  console.log(`\ncontracts: ${rows.length} rows across ${new Set(rows.map((r) => r.Project)).size} projects, ${rows.filter((r) => r.Verified === "Yes").length} verified, ${rows.filter((r) => r.Role === "token").length} token rows, ${rows.filter((r) => r.Role === "factory").length} factories`);
  if (conflicts.length) console.log(`\nownership conflicts for review:\n${conflicts.map((c) => `  ${c}`).join("\n")}`);
  if (rejected.length) console.log(`\nrejected, not an account id or address:\n${rejected.map((c) => `  ${c}`).join("\n")}`);
  if (!dry) console.log(`\n${writeCsv(file, rows, ["Project", "Account ID", "Role", "Source", "Verified"]) ? "wrote" : "unchanged"} ${path.relative(process.cwd(), file)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
