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
import fs from "node:fs";
import { gasTotals, type GasFile } from "../../src/lib/gas";
import { stakeByProject, type ValidatorsFile } from "../../src/lib/validators";
import { referralsByProject, referralTotals, unmatchedReferrals, type ReferralDay, type ReferralMapRow } from "../../src/lib/referrals";
import { DATA, HISTORY, RAW } from "./paths";
import { readJson } from "./store";

const EXTRA = path.join(HISTORY, "extra");
const yes = (v: string | undefined) => /^(yes|true|1)$/i.test((v ?? "").trim());

/** Verified token contracts per project from data/contracts.csv (Role token, Verified Yes). A 0x address is an Aurora token. */
export function tokenRows(): TokenRow[] {
  return readCsvOrEmpty(path.join(DATA, "contracts.csv"))
    .filter((r) => (r["Role"] ?? "").trim() === "token" && (r["Verified"] ?? "").trim() === "Yes" && (r["Project"] ?? "").trim() && (r["Account ID"] ?? "").trim())
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
  const validators = readJson<ValidatorsFile | null>(path.join(EXTRA, "validators.json"), null);
  const stakeOf = validators
    ? stakeByProject(
        validators.pools,
        readCsvOrEmpty(path.join(DATA, "validator-pools.csv")).map((r) => ({ project: (r["Project"] ?? "").trim(), pool: (r["Pool"] ?? "").trim(), verified: yes(r["Verified"]) })),
      )
    : new Map<string, number>();
  const launches = readJson<Record<string, Array<[string, number]>>>(path.join(HISTORY, "bigquery", "factory-launches.json"), {});
  // NEAR Intents volume per app: the last 30 complete Explorer days, through the verified rows of data/intents-referrals.csv.
  const rawDir = path.join(RAW, "intents", "daily");
  const days = fs.existsSync(rawDir) ? fs.readdirSync(rawDir).filter((f) => f.endsWith(".json")).sort().map((f) => readJson<ReferralDay>(path.join(rawDir, f), { date: "" })) : [];
  const refTotals = referralTotals(days, 30);
  const refMap: ReferralMapRow[] = readCsvOrEmpty(path.join(DATA, "intents-referrals.csv")).map((r) => ({ referral: (r["Referral"] ?? "").trim(), project: (r["Project"] ?? "").trim(), verified: yes(r["Verified"]) }));
  const refByProject = referralsByProject(refTotals.rows, refMap);

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

  /** Tokens launched in the last 30 days per launchpad, from its factory's sub-accounts (BigQuery). */
  const launchParts = new Map<string, LivePart[]>();
  // The series only has days with a launch, so the window ends on the last day the receipts query covered, not on
  // the last launch; a factory with no launch in the window reads zero. Before the first run there is no window.
  const receiptsEnd = readJson<{ cursors?: { bigquery?: Record<string, string> } }>(path.join(HISTORY, "_meta.json"), {}).cursors?.bigquery?.daily_receipts;
  for (const r of readCsvOrEmpty(path.join(DATA, "contracts.csv"))) {
    if ((r["Role"] ?? "").trim() !== "factory" || !receiptsEnd) continue;
    const s = launches[(r["Account ID"] ?? "").trim().toLowerCase()] ?? [];
    const from = new Date(Date.parse(`${receiptsEnd}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10);
    const total = s.filter(([d]) => d >= from && d <= receiptsEnd).reduce((a, [, n]) => a + n, 0);
    const project = (r["Project"] ?? "").trim();
    launchParts.set(project, [...(launchParts.get(project) ?? []), { values: { tokensLaunched: total }, asOf: receiptsEnd }]);
  }

  /** Gas fees generated (the contracts' 30% share) and gas paid by users, per project over its mapped accounts. */
  const gasFile = readJson<GasFile>(path.join(HISTORY, "bigquery", "gas.json"), {});
  const prices = (readJson<{ nearblocks?: { price?: Array<[string, number]> } }>(path.join(HISTORY, "chain.json"), {}).nearblocks?.price ?? []).filter(([, v]) => Number.isFinite(v) && v > 0);
  const accountsOf = new Map<string, string[]>();
  for (const r of readCsvOrEmpty(path.join(DATA, "contracts.csv"))) {
    const a = (r["Account ID"] ?? "").trim().toLowerCase();
    const proj = (r["Project"] ?? "").trim();
    // An account listed under two roles (core and token, say) counts once; a suffix row has no gas of its own here.
    if (!a || !proj || (r["Role"] ?? "").trim() === "suffix" || (accountsOf.get(proj) ?? []).includes(a)) continue;
    accountsOf.set(proj, [...(accountsOf.get(proj) ?? []), a]);
  }
  const gasParts = new Map<string, LivePart[]>();
  if (Object.keys(gasFile).length && prices.length) {
    for (const [proj, accts] of accountsOf) {
      const t = gasTotals(gasFile, accts, prices);
      if (t) gasParts.set(proj, [{ values: { gasGenerated: Math.round(t.generatedUsd), gasPaid: Math.round(t.paidUsd) }, asOf: t.end }]);
    }
  }

  const part = (asOf: string | undefined, values: LivePart["values"] | undefined): LivePart[] => (asOf && values && Object.keys(values).length ? [{ values, asOf }] : []);
  /** Pool APYs are dated by the yields read; supplied, borrowed, utilization and borrow APY by the day /lendBorrow last answered. */
  const LEND_KEYS = new Set(["utilization", "borrowApy"]);
  const yieldParts = (values: LivePart["values"] | undefined): LivePart[] => {
    if (!values || !yields) return [];
    const lendAsOf = yields.lendAsOf ?? yields.asOf;
    const pool = Object.fromEntries(Object.entries(values).filter(([k]) => !LEND_KEYS.has(k))) as LivePart["values"];
    const lend = Object.fromEntries(Object.entries(values).filter(([k]) => LEND_KEYS.has(k))) as LivePart["values"];
    return [...part(yields.asOf, pool), ...part(lendAsOf, lend)];
  };

  return {
    countedOn: st.countedOn,
    hacks: hk.byProject,
    hacksAsOf: hacks?.asOf ?? null,
    unmatchedHacks: hk.unmatched,
    stablecoinTotals: stable ? { ...stablecoinTotals(stable.coins), asOf: stable.asOf } : null,
    chainStats,
    referrals: { days: refTotals.days, end: refTotals.end, feeDays: refTotals.feeDays, apps: Array.from(refByProject.entries()).map(([project, v]) => ({ project, usd: Math.round(v.usd), count: v.count, fees: v.fees === null ? null : Math.round(v.fees), tags: v.tags })).sort((a, b) => b.usd - a.usd) },
    unmatchedReferrals: unmatchedReferrals(refTotals.rows, refMap, 50),
    gecko,
    gasProjects: gasParts.size,
    partsFor(p: Project): LivePart[] {
      return [
        ...part(stable?.asOf, st.values.get(p.name)),
        ...yieldParts(yv.get(p.name)),
        ...part(gecko?.asOf, gv.get(p.name)),
        ...part(tokens?.asOf, tv.get(p.name)),
        ...(holderParts.get(p.name) ?? []),
        ...(launchParts.get(p.name) ?? []),
        ...(gasParts.get(p.name) ?? []),
        ...(validators && stakeOf.has(p.name) ? [{ values: { validatorStake: stakeOf.get(p.name) as number }, asOf: validators.asOf }] : []),
        ...(refTotals.end && refByProject.has(p.name)
          ? [
              {
                values: {
                  referralVolume: Math.round(refByProject.get(p.name)!.usd),
                  referralSwaps: refByProject.get(p.name)!.count,
                  ...(refByProject.get(p.name)!.fees !== null ? { intentsAppFees: Math.round(refByProject.get(p.name)!.fees as number) } : {}),
                },
                asOf: refTotals.end,
              },
            ]
          : []),
      ];
    },
  };
}
