/**
 * Seeds data/defillama-map.csv: one row per DefiLlama slug mapped to a CSV project.
 * Matching order: the slug in the row's Traction Source URL, the ALIASES table, exact normalized
 * name, parent-protocol name. Existing rows are kept (hand edits win); new rows are appended.
 *
 *   npm run seed:map            # prints the mapping report and writes the file
 *   npm run seed:map -- --dry   # report only
 */
import path from "node:path";
import type { LlamaProtocolSnap } from "../src/lib/history-types";
import { normalizeName, parseMapRows, type MapRole, type MapRow } from "../src/lib/mapping";
import { toProject } from "../src/lib/parse";
import { fetchAllProtocols, readProtocols } from "./fetch/defillama";
import { createClient } from "./fetch/http";
import { findFile, readCsv, readCsvOrEmpty, writeCsv } from "./lib/csv";
import { DATA, HISTORY } from "./lib/paths";
import { writeJsonStable } from "./lib/store";

/** CSV project name -> DefiLlama slugs ("parent#…" maps every child). Cases the brief calls out plus renames seen in the listing. */
const ALIASES: Record<string, string[]> = {
  "Rhea Finance": ["rhea-dex", "rhea-cross-chain"],
  "Rhea Lend (formerly Burrow)": ["rhea-lend"],
  "Rhea LST (rNEAR)": ["rhea-lst"],
  "Meta Pool": ["meta-pool-near"],
  "NEAR Omni Bridge": ["near-bridge"],
  "Orderly Network": ["orderly-bridge"],
  "Templar Protocol": ["templar-lending"],
  TruFin: ["trustake"],
  Spin: ["spin-spot", "spin-dov", "spin-perps"],
  "Aurora+": ["aurora-plus"],
  "Pad.fi (ex-NearPad)": ["nearpad"],
  "Celer cBridge": ["cbridge"],
  "KAIO (Libre Capital)": ["kaio"],
  "NEAR Protocol": ["near"],
  Aurora: ["aurora"],
  "NEAR Intents": ["near-intents"],
  "Delta Trade": ["deltatrade"],
  Veax: ["veax-clmm"],
  "Meme Cooking": ["meme-cooking"],
  "HERE Wallet": ["here-wallet-staking"],
  Allbridge: ["allbridge-classic"],
  "Synapse Protocol": ["synapse-cross-chain-bridge"],
  Stargate: ["stargate-v2", "stargate-v1"],
  "Axelar Network": ["axelar"],
  "Curve Finance": ["curve-dex"],
  DODO: ["dodo-amm"],
  KyberSwap: ["kyberswap-classic"],
  "Impossible Finance": ["impossible"],
  Saddle: ["saddle-finance"],
  "Magik Finance": ["magik-farm"],
  "Beefy Finance": ["beefy"],
  "BlueBit Finance": ["bluebit"],
  "KillSwitch Finance": ["killswitch"],
  "MoonFlower Farmers": ["moon-flower-farmers"],
  "MoreMarkets.xyz": ["moremarkets"],
  "Pickle Finance": ["pickle"],
  "Stader (NEAR)": ["stader"],
  "PAPR Ecosystem": ["paprprintr"],
  LeoDex: ["leodex"],
  "Pyth Network": ["pyth-core"],
};

/** CEX reserve adapters: mapped to their exchange row but counted as reserves, never TVL. */
const CEX_SLUGS = new Set(["binance-cex", "bitget", "kucoin", "gate", "gate-us", "bitfinex", "bitstamp", "swissborg", "backpack", "mexc", "flipster", "bitlo"]);
const CHAIN_FEE_SLUGS = new Set(["near", "aurora"]);

function roleFor(slug: string, category: string): MapRole {
  if (CEX_SLUGS.has(slug) || category === "CEX") return "cex-reserves";
  if (CHAIN_FEE_SLUGS.has(slug) || category === "Chain") return "chain-fees";
  return "tvl";
}

function chainFor(p: LlamaProtocolSnap): MapRow["chain"] {
  if (p.tvlNear !== null && p.tvlAurora === null) return "near";
  if (p.tvlAurora !== null && p.tvlNear === null) return "aurora";
  return "both";
}

async function main() {
  const dry = process.argv.includes("--dry");
  let protocols = readProtocols();
  if (!protocols.length) {
    const client = createClient({ name: "defillama", minIntervalMs: 1000, timeoutMs: 120_000 });
    protocols = await fetchAllProtocols(client);
    writeJsonStable(path.join(HISTORY, "defillama", "protocols.json"), protocols);
  }
  const projects = readCsv(findFile("near-ecosystem-", ".csv")).map(toProject);
  const mapFile = path.join(DATA, "defillama-map.csv");
  const existing = parseMapRows(readCsvOrEmpty(mapFile));
  const have = new Set(existing.map((r) => r.slug));
  const bySlug = new Map(protocols.map((p) => [p.slug, p]));
  const byNorm = new Map<string, LlamaProtocolSnap[]>();
  const byParent = new Map<string, LlamaProtocolSnap[]>();
  const parentNorm = new Map<string, string>();
  for (const p of protocols) {
    const n = normalizeName(p.name);
    byNorm.set(n, [...(byNorm.get(n) ?? []), p]);
    if (p.parentProtocol) {
      byParent.set(p.parentProtocol, [...(byParent.get(p.parentProtocol) ?? []), p]);
      parentNorm.set(normalizeName(p.parentProtocol.replace(/^parent#/, "").split("-").join(" ")), p.parentProtocol);
    }
  }

  const rows: MapRow[] = [...existing];
  const claimed = new Map<string, string>(existing.filter((r) => r.project).map((r) => [r.slug, r.project as string]));
  const report: string[] = [];
  const add = (project: string, p: LlamaProtocolSnap, note: string) => {
    if (have.has(p.slug)) return;
    if (claimed.has(p.slug) && claimed.get(p.slug) !== project) {
      report.push(`  conflict: ${p.slug} already mapped to ${claimed.get(p.slug)}, wanted by ${project}`);
      return;
    }
    rows.push({ project, slug: p.slug, chain: chainFor(p), role: roleFor(p.slug, p.category), notes: note });
    have.add(p.slug);
    claimed.set(p.slug, project);
  };

  for (const pr of projects) {
    // 1. The slug in the research row's Traction Source URL is the strongest signal.
    for (const u of pr.tractionSources) {
      const m = u.match(/defillama\.com\/protocol\/([a-z0-9.\-]+)/i);
      if (m && bySlug.has(m[1])) add(pr.name, bySlug.get(m[1])!, "traction source url");
    }
    // 2. Hand aliases.
    for (const a of ALIASES[pr.name] ?? []) {
      if (a.startsWith("parent#")) for (const p of byParent.get(a) ?? []) add(pr.name, p, `alias ${a}`);
      else if (bySlug.has(a)) add(pr.name, bySlug.get(a)!, "alias slug");
      else report.push(`  alias slug not on DefiLlama: ${a} (${pr.name})`);
    }
    // 3. Exact normalized name, then parent name.
    const n = normalizeName(pr.name);
    for (const p of byNorm.get(n) ?? []) add(pr.name, p, "exact name");
    const par = parentNorm.get(n);
    if (par) for (const p of byParent.get(par) ?? []) add(pr.name, p, `parent name ${par}`);
  }

  const mappedProjects = new Set(rows.filter((r) => r.project).map((r) => r.project));
  const unmatched = projects.filter((p) => p.hasTraction && !mappedProjects.has(p.name));
  const covered = new Set(rows.map((r) => r.slug));
  const unmapped = protocols.filter((p) => !covered.has(p.slug)).sort((a, b) => (b.tvlNear ?? 0) + (b.tvlAurora ?? 0) - (a.tvlNear ?? 0) - (a.tvlAurora ?? 0));

  console.log(`\nDefiLlama mapping: ${rows.filter((r) => r.project).length} slug rows across ${mappedProjects.size} projects (${protocols.length} protocols on NEAR or Aurora)\n`);
  const byProject = new Map<string, MapRow[]>();
  for (const r of rows) if (r.project) byProject.set(r.project, [...(byProject.get(r.project) ?? []), r]);
  for (const [project, rs] of Array.from(byProject.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${project.padEnd(34)} ${rs.map((r) => `${r.slug}${r.role !== "tvl" ? ` [${r.role}]` : ""}`).join(", ")}`);
  }
  console.log(`\nCSV projects with metrics but no map row (${unmatched.length}):`);
  for (const p of unmatched) {
    const stem = normalizeName(p.name).slice(0, 5);
    const sugg = protocols.filter((x) => normalizeName(x.name).includes(stem) || (x.parentProtocol ?? "").includes(stem)).slice(0, 4);
    console.log(`  ${p.name.padEnd(34)} tvl=${p.tvl ?? "-"} vol=${p.volume ?? "-"} fees=${p.fees ?? "-"}   suggestions: ${sugg.map((s) => s.slug).join(", ") || "none"}`);
  }
  console.log(`\nUnmapped DefiLlama protocols (newly detected list), top 30 of ${unmapped.length} by TVL:`);
  for (const p of unmapped.slice(0, 30)) console.log(`  ${p.slug.padEnd(34)} ${p.category.padEnd(22)} ${(p.parentProtocol ?? "").padEnd(28)} near $${Math.round(p.tvlNear ?? 0).toLocaleString("en-US")} aurora $${Math.round(p.tvlAurora ?? 0).toLocaleString("en-US")} ${p.kinds.join("/")}`);
  if (report.length) console.log(`\nNotes:\n${report.join("\n")}`);

  if (!dry) {
    const changed = writeCsv(
      mapFile,
      rows.map((r) => ({ Project: r.project ?? "", "DefiLlama slug": r.slug, Chain: r.chain, Role: r.role, Notes: r.notes })),
      ["Project", "DefiLlama slug", "Chain", "Role", "Notes"],
    );
    console.log(`\n${changed ? "wrote" : "unchanged"} ${path.relative(process.cwd(), mapFile)} (${rows.length} rows)\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
