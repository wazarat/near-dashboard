/**
 * Loads the step M and L snapshots from data/history/extra/ and their mapping files, and hands each project its
 * live values, each part dated by the day its source was read. Missing files are simply empty: a source that
 * has not run yet leaves its metrics to the dated snapshot CSV, or Not tracked.
 */
import path from "node:path";
import { joinGecko, joinHacks, joinStablecoins, joinTokens, joinYields, lastPoint, stablecoinTotals, type GeckoMapRow, type StablecoinMapRow, type TokenRow, type Values } from "../../src/lib/extra-join";
import type { ChainStatsFile, GeckoFile, HacksFile, HoldersFile, StablecoinsFile, TokensFile, YieldsFile } from "../../src/lib/extra-types";
import type { LivePart } from "../../src/lib/extra-metrics";
import type { MapRow } from "../../src/lib/mapping";
import type { NameResolver } from "../../src/lib/parse";
import type { Project } from "../../src/lib/types";
import { readCsvOrEmpty } from "./csv";
import { DATA, HISTORY } from "./paths";
import { readJson } from "./store";

const EXTRA = path.join(HISTORY, "extra");
const yes = (v: string | undefined) => /^(yes|true|1)$/i.test((v ?? "").trim());

/** Token contracts per project from data/contracts.csv (Role token). A 0x address is an Aurora token. */
export function tokenRows(): TokenRow[] {
  return readCsvOrEmpty(path.join(DATA, "contracts.csv"))
    .filter((r) => (r["Role"] ?? "").trim() === "token" && (r["Project"] ?? "").trim() && (r["Account ID"] ?? "").trim())
    .map((r) => {
      const contract = (r["Account ID"] ?? "").trim();
      return { project: (r["Project"] ?? "").trim(), contract, chain: /^0x/i.test(contract) ? "aurora" : "near" } as TokenRow;
    });
}

export function loadExtras(projects: Project[], mapRowsOf: Map<string, MapRow[]>, resolver: NameResolver) {
  const stable = readJson<StablecoinsFile | null>(path.join(EXTRA, "stablecoins.json"), null);
  const yields = readJson<YieldsFile | null>(path.join(EXTRA, "yields.json"), null);
  const gecko = readJson<GeckoFile | null>(path.join(EXTRA, "geckoterminal.json"), null);
  const tokens = readJson<TokensFile | null>(path.join(EXTRA, "nearblocks-tokens.json"), null);
  const hacks = readJson<HacksFile | null>(path.join(EXTRA, "hacks.json"), null);
  const holders = readJson<HoldersFile | null>(path.join(EXTRA, "holders.json"), null);
  const chainStats = readJson<ChainStatsFile | null>(path.join(EXTRA, "chain-stats.json"), null);

  const stableMap: StablecoinMapRow[] = readCsvOrEmpty(path.join(DATA, "stablecoin-map.csv")).map((r) => ({ project: (r["Project"] ?? "").trim(), id: (r["Stablecoin ID"] ?? "").trim(), primary: yes(r["Primary"]) }));
  const geckoMap: GeckoMapRow[] = readCsvOrEmpty(path.join(DATA, "geckoterminal-map.csv")).map((r) => ({ network: (r["Network"] ?? "").trim() as GeckoMapRow["network"], dex: (r["DEX ID"] ?? "").trim(), project: (r["Project"] ?? "").trim(), showLiquidity: yes(r["Show liquidity"]) }));
  const tokRows = tokenRows();

  const st: ReturnType<typeof joinStablecoins> = stable ? joinStablecoins(stable.coins, stableMap) : { values: new Map(), countedOn: new Map() };
  const slugsOf = new Map(Array.from(mapRowsOf.entries()).map(([name, rows]) => [name, rows.filter((r) => r.role !== "ignore").map((r) => r.slug)]));
  const sectorOf = new Map(projects.map((p) => [p.name, p.sector]));
  const none = new Map<string, Values>();
  const yv = yields ? joinYields(yields.pools, slugsOf, sectorOf) : none;
  const gv = gecko ? joinGecko(gecko.dexes, geckoMap) : none;
  const tv = tokens ? joinTokens(tokens.tokens, tokRows) : none;
  const hk: ReturnType<typeof joinHacks> = hacks ? joinHacks(hacks.hacks, (n) => resolver.resolve(n)) : { byProject: new Map(), unmatched: [] };

  /** Holder counts per project: the latest point for each of its token contracts, dated. */
  const holderParts = new Map<string, LivePart[]>();
  if (holders) {
    for (const r of tokRows) {
      const pt = lastPoint(holders[r.chain]?.[r.contract.toLowerCase()]);
      if (!pt) continue;
      const parts = holderParts.get(r.project) ?? [];
      parts.push({ values: { [r.chain === "aurora" ? "tokenHoldersAurora" : "tokenHolders"]: pt.value }, asOf: pt.date });
      holderParts.set(r.project, parts);
    }
  }

  const part = (asOf: string | undefined, values: LivePart["values"] | undefined): LivePart[] => (asOf && values && Object.keys(values).length ? [{ values, asOf }] : []);

  return {
    countedOn: st.countedOn,
    hacks: hk.byProject,
    hacksAsOf: hacks?.asOf ?? null,
    unmatchedHacks: hk.unmatched,
    stablecoinTotals: stable ? { ...stablecoinTotals(stable.coins), asOf: stable.asOf } : null,
    chainStats,
    gecko,
    partsFor(p: Project): LivePart[] {
      return [
        ...part(stable?.asOf, st.values.get(p.name)),
        ...part(yields?.asOf, yv.get(p.name)),
        ...part(gecko?.asOf, gv.get(p.name)),
        ...part(tokens?.asOf, tv.get(p.name)),
        ...(holderParts.get(p.name) ?? []),
      ];
    },
  };
}
