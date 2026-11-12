/**
 * Reads the CSV and Markdown sources in ./data, joins the committed history
 * under ./data/history (when present), validates, and writes typed JSON to
 * src/data/generated. Never touches the network, so it runs the same on Vercel
 * and on a judge's fresh clone.
 *
 * Run with: npm run data   (also runs as part of `npm run rebuild` before `next build`)
 */
import fs from "node:fs";
import path from "node:path";
import { daysBetween, dateRange, utcToday, type DateStr } from "../src/lib/dates";
import { emptyOverview, type ChainHistory, type HistoryMeta, type LlamaProtocolSnap, type Series, type SeriesMap } from "../src/lib/history-types";
import { mergeExtra, parseSeedRow, type LivePart, type SeedRow } from "../src/lib/extra-metrics";
import { loadExtras } from "./lib/extras";
import type { ChainStatsFile } from "../src/lib/extra-types";
import type { MetricId } from "../src/lib/sector-metrics";
import { gasFeeGaps, txnGaps } from "../src/lib/chain-gaps";
import { alignSeries, applyLive, changes, computeLive, emptyLive, projectFlow, sparkDates, sumWindow, valueAt, windowEnd, type HistoryStore } from "../src/lib/live";
import { parseMapRows, rowsByProject } from "../src/lib/mapping";
import { aggregateInvestors, NameResolver, parseMemoInsights, toEvent, toLeader, toProject, toRound, uniqueSorted } from "../src/lib/parse";
import { CHAIN_SERIES, NEARBLOCKS_SERIES, TIERS, type ChainData, type ChainFacts, type ChainLatest, type ContractInfo, type Meta, type Project, type SeriesFile, type Tier } from "../src/lib/types";
import { EMPTY_INTENTS, summarizeIntents } from "../src/lib/intents";
import { validate, type Expected } from "../src/lib/validate";
import { readDaily as readIntentsDaily } from "./fetch/intents";
import { dateFromName, findFile, findFileOrNull, readCsv, readCsvOrEmpty } from "./lib/csv";
import { DATA, HISTORY, OUT } from "./lib/paths";
import { readJson } from "./lib/store";

function label(d: DateStr): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

type SumKey = "tvl" | "tvlNear" | "tvlAurora" | "volume" | "fees" | "revenue";
function sum(rows: Project[], key: SumKey): number {
  return rows.reduce((acc, r) => acc + (r[key] ?? 0), 0);
}

function loadContracts(): Map<string, ContractInfo[]> {
  const m = new Map<string, ContractInfo[]>();
  for (const r of readCsvOrEmpty(path.join(DATA, "contracts.csv"))) {
    const accountId = (r["Account ID"] ?? "").trim().toLowerCase();
    const project = (r["Project"] ?? "").trim();
    if (!accountId || !project) continue;
    const arr = m.get(project) ?? [];
    arr.push({ accountId, role: (r["Role"] ?? "").trim().toLowerCase(), source: (r["Source"] ?? "").trim(), verified: (r["Verified"] ?? "").trim() });
    m.set(project, arr);
  }
  return m;
}

interface History {
  meta: HistoryMeta;
  store: HistoryStore;
  chain: ChainHistory;
  protocols: LlamaProtocolSnap[];
}

function loadHistory(): History | null {
  const metaFile = path.join(HISTORY, "_meta.json");
  if (!fs.existsSync(metaFile)) return null;
  const meta = readJson<HistoryMeta>(metaFile, null as unknown as HistoryMeta);
  if (!meta?.lastRunDate) return null;
  const dl = (name: string) => readJson<SeriesMap>(path.join(HISTORY, "defillama", `${name}.json`), {});
  const pair = (name: string) => ({ near: dl(`${name}-near`), aurora: dl(`${name}-aurora`) });
  const protocols = readJson<LlamaProtocolSnap[]>(path.join(HISTORY, "defillama", "protocols.json"), []);
  const store: HistoryStore = {
    tvl: pair("tvl"),
    volume: pair("volume"),
    fees: pair("fees"),
    revenue: pair("revenue"),
    holdersRevenue: pair("holders-revenue"),
    supplySideRevenue: pair("supply-side-revenue"),
    aggregators: pair("aggregators"),
    bridgeAggregators: pair("bridge-aggregators"),
    nameOfSlug: new Map(protocols.map((p) => [p.slug, p.name])),
    mcapOfSlug: new Map(protocols.map((p) => [p.slug, p.mcap])),
    activity: readJson(path.join(HISTORY, "bigquery", "project-activity.json"), {}),
  };
  const chain = readJson<ChainHistory>(path.join(HISTORY, "chain.json"), { near: emptyOverview(), aurora: emptyOverview(), nearblocks: {}, bigquery: {}, price: {} });
  chain.near = { ...emptyOverview(), ...chain.near };
  chain.aurora = { ...emptyOverview(), ...chain.aurora };
  chain.nearblocks ??= {};
  chain.bigquery ??= {};
  chain.price ??= {};
  return { meta, store, chain, protocols };
}

function latestOf(o: ChainHistory["near"], end: DateStr): ChainLatest {
  return {
    asOf: end,
    tvl: valueAt(o.tvl, end),
    volume30d: sumWindow(o.volume, end, 30).value,
    fees30d: sumWindow(o.fees, end, 30).value,
    revenue30d: sumWindow(o.revenue, end, 30).value,
    gasFees30d: sumWindow(o.gasFees ?? [], end, 30).value,
    change: {
      tvl: changes(o.tvl, end, "stock"),
      volume: changes(o.volume, end, "flow"),
      fees: changes(o.fees, end, "flow"),
      revenue: changes(o.revenue, end, "flow"),
    },
  };
}

function buildChain(chain: ChainHistory, end: DateStr): ChainData {
  const all: Series[] = [...Object.values(chain.near), ...Object.values(chain.aurora), ...Object.values(chain.nearblocks), ...Object.values(chain.bigquery), ...Object.values(chain.price)];
  const firsts = all.filter((s) => s.length).map((s) => s[0][0]);
  const start = firsts.length ? firsts.sort()[0] : end;
  const dates = dateRange(start, end);
  const align = (o: ChainHistory["near"], txnsFallback: Series = []) => {
    const out = {} as ChainData["near"];
    for (const k of CHAIN_SERIES) out[k] = alignSeries(o[k] ?? [], dates, k === "tvl" ? "stock" : "flow");
    // NEAR's daily transactions come from NearBlocks; Aurora's from its own Blockscout.
    if (!(o.txns ?? []).length && txnsFallback.length) out.txns = alignSeries(txnsFallback, dates, "flow");
    // A reported 0 that is really an indexer gap is drawn as a gap (src/lib/chain-gaps.ts).
    out.txns = txnGaps(out.txns);
    out.gasFees = gasFeeGaps(out.gasFees);
    return out;
  };
  const nearblocks = {} as ChainData["nearblocks"];
  for (const k of NEARBLOCKS_SERIES) nearblocks[k] = alignSeries(chain.nearblocks[k] ?? [], dates, k === "price" || k === "marketCap" ? "stock" : "flow");
  const bigquery: ChainData["bigquery"] = {};
  for (const [k, s] of Object.entries(chain.bigquery)) bigquery[k] = alignSeries(s, dates, "flow");
  const price: ChainData["price"] = {};
  for (const [k, s] of Object.entries(chain.price)) price[k] = alignSeries(s, dates, "stock");
  const nb = (k: string) => chain.nearblocks[k] ?? [];
  return {
    dates,
    near: align(chain.near, chain.nearblocks.txns ?? []),
    aurora: align(chain.aurora),
    nearblocks,
    bigquery,
    price,
    latest: {
      near: latestOf(chain.near, end),
      aurora: latestOf(chain.aurora, end),
      activeAccounts: valueAt(nb("activeAccounts"), end),
      txns: valueAt(nb("txns"), end),
      newAccounts: valueAt(nb("newAccounts"), end),
      price: valueAt(nb("price"), end),
      marketCap: valueAt(nb("marketCap"), end),
      activityChange: {
        activeAccounts: changes(nb("activeAccounts"), end, "flow"),
        txns: changes(nb("txns"), end, "flow"),
        newAccounts: changes(nb("newAccounts"), end, "flow"),
        price: changes(nb("price"), end, "stock"),
      },
    },
  };
}

/** 30-day chain sums (gaps left out) plus the explorers' lifetime stats, for the NEAR Protocol and Aurora pop-ups. */
function chainFactsOf(chain: ChainHistory | null, end: DateStr | null, stats: ChainStatsFile | null): ChainFacts {
  const sum = (s: Series | undefined) => (chain && end && s ? sumWindow(s.filter(([, v]) => v !== 0), end, 30).value : null);
  return {
    windowEnd: end,
    statsAsOf: stats?.asOf ?? null,
    near: { gasFees30d: sum(chain?.near.gasFees), txns30d: sum(chain?.nearblocks.txns), volume30d: sum(chain?.near.volume), nodesOnline: stats?.near?.nodesOnline ?? null, totalTxns: stats?.near?.totalTxns ?? null, tps: stats?.near?.tps ?? null },
    aurora: { gasFees30d: sum(chain?.aurora.gasFees), txns30d: sum(chain?.aurora.txns), volume30d: sum(chain?.aurora.volume), totalTxns: stats?.aurora?.totalTxns ?? null, totalAddresses: stats?.aurora?.totalAddresses ?? null, totalBlocks: stats?.aurora?.totalBlocks ?? null },
  };
}

function emptyChain(asOf: DateStr): ChainData {
  const empty = () => Object.fromEntries(CHAIN_SERIES.map((k) => [k, []])) as unknown as ChainData["near"];
  const latest: ChainLatest = { asOf, tvl: null, volume30d: null, fees30d: null, revenue30d: null, gasFees30d: null, change: {} };
  return {
    dates: [],
    near: empty(),
    aurora: empty(),
    nearblocks: Object.fromEntries(NEARBLOCKS_SERIES.map((k) => [k, []])) as unknown as ChainData["nearblocks"],
    bigquery: {},
    price: {},
    latest: { near: latest, aurora: { ...latest }, activeAccounts: null, txns: null, newAccounts: null, price: null, marketCap: null, activityChange: {} },
  };
}

function dayOverDay(s: Series): number | null {
  if (s.length < 2) return null;
  const [, a] = s[s.length - 2];
  const [, b] = s[s.length - 1];
  return a > 0 ? b / a : null;
}

function main() {
  const projectsFile = findFile("near-ecosystem-", ".csv");
  const leadersFile = findFile("near-sector-leaders-", ".csv");
  const eventsFile = findFile("near-events-", ".csv");
  const roundsFile = findFile("near-funding-rounds-", ".csv");
  const memoFile = findFile("near-traction-funding-security-", ".md");
  const expected = JSON.parse(fs.readFileSync(path.join(DATA, "expected.json"), "utf8")) as Expected;
  const snapshotAsOf = dateFromName(projectsFile) ?? utcToday();

  const snapshotProjects = readCsv(projectsFile)
    .map(toProject)
    .map((p) => ({ ...p, snapshot: { ...p.snapshot, asOf: snapshotAsOf } }));
  // "Aurora" and "Aurora+" both slugify to "aurora": later duplicates get a deterministic numeric suffix.
  const seenIds = new Map<string, number>();
  for (const p of snapshotProjects) {
    const n = (seenIds.get(p.id) ?? 0) + 1;
    seenIds.set(p.id, n);
    if (n > 1) p.id = `${p.id}-${n}`;
  }
  const dupes = snapshotProjects.map((p) => p.id).filter((id, i, arr) => arr.indexOf(id) !== i);
  if (dupes.length) throw new Error(`Duplicate project ids: ${dupes.join(", ")}`);
  const aliasRows = readCsvOrEmpty(path.join(DATA, "aliases.csv")).map((r) => ({ alias: (r["Alias"] ?? "").trim(), project: (r["Project"] ?? "").trim() }));
  const resolver = new NameResolver(snapshotProjects, aliasRows);
  const badAliases = aliasRows.filter((a) => a.alias && !snapshotProjects.some((p) => p.name === a.project)).map((a) => `${a.alias} → ${a.project}`);

  // History join.
  const history = loadHistory();
  const map = parseMapRows(readCsvOrEmpty(path.join(DATA, "defillama-map.csv")));
  const mapRowsOf = rowsByProject(map);
  const end = history ? windowEnd(history.meta.lastRunDate as DateStr) : null;
  const contractsOf = loadContracts();
  const callsSeries = new Map<string, Series>();
  const projects: Project[] = snapshotProjects.map((p) => {
    const contracts = contractsOf.get(p.name) ?? [];
    if (!history || !end) return { ...p, contracts };
    const rows = mapRowsOf.get(p.name) ?? [];
    let live = rows.length ? computeLive(rows, history.store, end) : null;
    const act = history.store.activity?.[p.name];
    if (act && act.length) {
      const calls: Series = act.map(([d, c]) => [d, c]);
      const signers: Series = act.map(([d, , s]) => [d, s]);
      live = {
        ...(live ?? emptyLive(end, rows.map((r) => r.slug))),
        calls7d: sumWindow(calls, end, 7).value,
        calls30d: sumWindow(calls, end, 30).value,
        signers7d: sumWindow(signers, end, 7).value,
        activityAsOf: act[act.length - 1][0],
      };
      callsSeries.set(p.id, calls);
    }
    return { ...applyLive(p, live, rows.length > 0), contracts };
  });

  // Registry metrics beyond DefiLlama's four: live (DefiLlama's borrowed and staking views) first, then the
  // dated snapshot CSV for anything no live source covers yet (docs/LIVE-DATA.md, requirement 7).
  const seedFile = findFileOrNull("near-live-metrics-", ".csv");
  const seedById = new Map<string, SeedRow>();
  const unmatchedSeed: string[] = [];
  if (seedFile) {
    for (const row of readCsv(seedFile)) {
      const s = parseSeedRow(row as Record<string, string>);
      if (!s) continue;
      const id = resolver.resolve(s.name);
      if (id) seedById.set(id, s);
      else unmatchedSeed.push(s.name);
    }
  }
  const protoBySlug = new Map((history?.protocols ?? []).map((pr) => [pr.slug, pr]));
  const ex = loadExtras(projects, mapRowsOf, resolver);
  for (const p of projects) {
    const lives: LivePart[] = [];
    if (history && end) {
      const values: Partial<Record<MetricId, number>> = {};
      const rows = mapRowsOf.get(p.name) ?? [];
      for (const r of rows) {
        const other = protoBySlug.get(r.slug)?.otherTvl;
        if (other?.borrowed !== undefined) values.borrowed = (values.borrowed ?? 0) + other.borrowed;
        if (other?.staking !== undefined) values.ownStaking = (values.ownStaking ?? 0) + other.staking;
      }
      const agg = sumWindow(projectFlow(rows, history.store, history.store.aggregators), end, 30).value;
      if (agg !== null) values.aggregatorVolume = agg;
      const bagg = sumWindow(projectFlow(rows, history.store, history.store.bridgeAggregators), end, 30).value;
      if (bagg !== null) values.bridgeAggregatorVolume = bagg;
      if (Object.keys(values).length) lives.push({ values, asOf: end });
    }
    for (const part of ex.partsFor(p)) lives.push(part);
    const extra = mergeExtra(lives, seedById.get(p.id) ?? null, p.tvl);
    const countedOn = ex.countedOn.get(p.name);
    if (extra || countedOn) {
      p.extra = extra ?? { values: {}, asOf: {}, from: {} };
      if (countedOn) {
        p.extra.countedOn = { stablecoinSupply: countedOn };
        delete p.extra.values.stablecoinSupply;
      }
    }
    const hacks = ex.hacks.get(p.id);
    if (hacks?.length) p.hacks = { asOf: ex.hacksAsOf as string, list: hacks.map((h) => ({ date: h.date, amount: h.amount, technique: h.technique, classification: h.classification })) };
  }

  const leaders = readCsv(leadersFile).map((r) => toLeader(r, resolver));
  for (const l of leaders) {
    const p = l.projectId ? projects.find((x) => x.id === l.projectId) : undefined;
    if (p) p.leaderRank = l.rank;
  }
  const unmatchedLeaders = leaders.filter((l) => !l.projectId).map((l) => l.name);
  const events = readCsv(eventsFile)
    .map((r, i) => toEvent(r, i + 2, resolver))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  const rounds = readCsv(roundsFile)
    .map((r, i) => toRound(r, i + 2, resolver))
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const investors = aggregateInvestors(rounds);
  const insights = parseMemoInsights(fs.readFileSync(memoFile, "utf8"));

  // Series + chain files.
  let series: SeriesFile = { dates: [], projects: {} };
  let chain: ChainData | null = null;
  if (history && end) {
    const dates = sparkDates(end, 90);
    series = { dates, projects: {} };
    for (const p of projects) {
      if (!p.live) continue;
      const rows = mapRowsOf.get(p.name) ?? [];
      const s = rows.length ? (await0(rows, history.store)) : null;
      series.projects[p.id] = {
        tvl: alignSeries(s?.tvl ?? [], dates, "stock"),
        volume: alignSeries(s?.volume ?? [], dates, "flow"),
        fees: alignSeries(s?.fees ?? [], dates, "flow"),
        revenue: alignSeries(s?.revenue ?? [], dates, "flow"),
        calls: alignSeries(callsSeries.get(p.id) ?? [], dates, "flow"),
      };
    }
    chain = buildChain(history.chain, end);
  }

  const asOf = end ?? snapshotAsOf;
  const tierCounts = {} as Record<Tier, number>;
  for (const t of TIERS) tierCounts[t] = projects.filter((p) => p.tier === t).length;
  const perSource: NonNullable<Meta["live"]>["perSource"] = {};
  if (history) {
    for (const [id, st] of Object.entries(history.meta.perSource)) {
      perSource[id] = { ok: !st.error && !st.skipped, lastSuccess: st.lastSuccess, error: st.error, skipped: st.skipped };
    }
  }
  const unmatchedCsv = snapshotProjects.filter((p) => p.hasTraction && !mapRowsOf.get(p.name)?.length).map((p) => p.name);
  const cexReserves = projects.reduce((a, p) => a + (p.live?.cexReserves ?? 0), 0);

  const totals = (rows: Project[]) => ({
    tvl: sum(rows, "tvl"),
    tvlNear: sum(rows, "tvlNear"),
    tvlAurora: sum(rows, "tvlAurora"),
    volume: sum(rows, "volume"),
    fees: sum(rows, "fees"),
    revenue: sum(rows, "revenue"),
  });

  const meta: Meta = {
    asOf,
    asOfLabel: label(asOf),
    snapshotAsOf,
    snapshotAsOfLabel: label(snapshotAsOf),
    live: history && end ? { lastRun: history.meta.lastRun ?? "", windowEnd: end, perSource } : null,
    counts: {
      projects: projects.length,
      sectors: new Set(projects.map((p) => p.sector)).size,
      leaders: leaders.length,
      events: events.length,
      rounds: rounds.length,
      investors: investors.length,
      tier1: tierCounts["Tier 1 - Leader"],
      liveProjects: projects.filter((p) => p.live).length,
      newlyDetected: history?.meta.newlyDetected.length ?? 0,
      mappedSlugs: map.filter((r) => r.project).length,
      withTvl: projects.filter((p) => (p.tvl ?? 0) > 0).length,
      withFlows: projects.filter((p) => (p.volume ?? 0) > 0 || (p.fees ?? 0) > 0 || (p.revenue ?? 0) > 0).length,
    },
    totals: totals(projects),
    snapshotTotals: totals(snapshotProjects),
    chainTvl: chain ? { near: chain.latest.near.tvl, aurora: chain.latest.aurora.tvl, asOf: end } : { near: null, aurora: null, asOf: null },
    chainFacts: chainFactsOf(history?.chain ?? null, end, ex.chainStats),
    stablecoins: ex.stablecoinTotals,
    cexReserves,
    tierCounts,
    sectors: uniqueSorted(projects.map((p) => p.sector)),
    chains: uniqueSorted(projects.map((p) => p.chain)),
    presence: uniqueSorted(projects.flatMap((p) => p.presence)),
    tiers: uniqueSorted(projects.map((p) => p.tier)),
    statuses: uniqueSorted(projects.map((p) => p.status)),
    statusGroups: uniqueSorted(projects.map((p) => p.statusGroup)),
    fundingTypes: uniqueSorted(projects.flatMap((p) => p.fundingTypes)),
    risks: uniqueSorted(projects.map((p) => p.risk)),
    discoveredVia: uniqueSorted(projects.flatMap((p) => p.discoveredViaList)),
  };

  // Validation.
  const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
  const snap = meta.snapshotTotals;
  const result = validate(expected, {
    static: {
      projects: projects.length,
      sectors: meta.counts.sectors,
      nativeChains: meta.chains.length,
      leaders: leaders.length,
      events: events.length,
      rounds: rounds.length,
      snapshotTier1: snapshotProjects.filter((p) => p.tier === "Tier 1 - Leader").length,
    },
    snapshot: {
      tvl: Math.round(snap.tvl),
      volume: Math.round(snap.volume),
      fees: Math.round(snap.fees),
      revenue: Math.round(snap.revenue),
      tvlNear: Math.round(snap.tvlNear),
      tvlAurora: Math.round(snap.tvlAurora),
    },
    live: history ? { tvl: meta.totals.tvl, volume: meta.totals.volume, fees: meta.totals.fees, revenue: meta.totals.revenue } : {},
    liveVsSnapshot: history
      ? { tvl: ratio(meta.totals.tvl, snap.tvl), volume: ratio(meta.totals.volume, snap.volume), fees: ratio(meta.totals.fees, snap.fees), revenue: ratio(meta.totals.revenue, snap.revenue) }
      : {},
    dayOverDay: history
      ? {
          tvl: dayOverDay(history.chain.near.tvl),
          volume: dayOverDay(history.chain.near.volume),
          fees: dayOverDay(history.chain.near.fees),
          txns: dayOverDay(history.chain.nearblocks.txns ?? []),
        }
      : {},
    sourceErrors: history ? Object.entries(history.meta.perSource).filter(([, s]) => s.error).map(([id, s]) => `${id}: ${s.error}`) : [],
    lastRunAgeDays: history?.meta.lastRunDate ? daysBetween(history.meta.lastRunDate as DateStr, utcToday()) : null,
  });

  console.log(`\nNEAR Ecosystem Atlas — data build (as of ${meta.asOfLabel}${history ? "" : ", snapshot only: no data/history found"})`);
  console.log(`  projects: ${path.basename(projectsFile)}   leaders: ${path.basename(leadersFile)}   events: ${path.basename(eventsFile)}   rounds: ${path.basename(roundsFile)}\n`);
  console.log("  group     check          expected              actual  ok");
  for (const r of result.rows) {
    console.log(`  ${r.group.padEnd(9)} ${r.key.padEnd(14)} ${r.expected.padStart(10)} ${r.actual.padStart(19)}  ${r.ok ? "✓" : "✗"}`);
  }
  if (history) {
    const fmt = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
    console.log(`\n  live vs snapshot totals: tvl ${fmt(meta.totals.tvl)} vs ${fmt(snap.tvl)} · volume ${fmt(meta.totals.volume)} vs ${fmt(snap.volume)} · fees ${fmt(meta.totals.fees)} vs ${fmt(snap.fees)} · revenue ${fmt(meta.totals.revenue)} vs ${fmt(snap.revenue)}`);
    console.log(`  window end ${end} · ${meta.counts.liveProjects} projects with live data · tiers ${TIERS.map((t) => `${t.split(" - ")[0]}: ${tierCounts[t]}`).join(", ")}`);
    console.log(`  chain TVL (DefiLlama default): NEAR ${fmt(meta.chainTvl.near ?? 0)} · Aurora ${fmt(meta.chainTvl.aurora ?? 0)} · CEX reserves on NEAR ${fmt(cexReserves)}`);
    console.log(`  live-metrics snapshot: ${seedFile ? `${path.basename(seedFile)}, ${seedById.size} projects joined${unmatchedSeed.length ? `, unmatched: ${unmatchedSeed.join(", ")}` : ""}` : "none"} · ${projects.filter((x) => x.extra?.from.borrowed === "live").length} projects with live borrowed`);
    console.log(`  mapping: ${meta.counts.mappedSlugs} slugs · ${history.meta.newlyDetected.length} newly detected · CSV projects with metrics but no map row: ${unmatchedCsv.length ? unmatchedCsv.join(", ") : "none"}`);
    console.log(`  series: ${Object.keys(series.projects).length} projects × ${series.dates.length} days · chain: ${chain?.dates.length ?? 0} days from ${chain?.dates[0] ?? "-"}`);
  }
  console.log(`  memo insights parsed: ${insights.length} · investors: ${investors.length} · rounds without a project row: ${rounds.filter((r) => !r.projectId).length}`);
  if (unmatchedLeaders.length) console.log(`  leaders without a project row: ${unmatchedLeaders.join(", ")}`);
  if (badAliases.length) console.log(`  aliases pointing at unknown projects: ${badAliases.join(", ")}`);
  const unmatchedEventRefs = uniqueSorted(events.flatMap((e) => e.projects).filter((n) => !resolver.resolve(n)));
  if (unmatchedEventRefs.length) console.log(`  event project refs without a row (shown as text): ${unmatchedEventRefs.join(", ")}`);
  for (const w of result.warnings) console.log(`  warning: ${w}`);
  if (result.failures.length) {
    console.error(`\nValidation failed: ${result.failures.join("; ")}. Update data/expected.json if the new data is intentional.\n`);
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const write = (name: string, value: unknown) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(value));
  write("projects.json", projects);
  write("leaders.json", leaders);
  write("events.json", events);
  write("rounds.json", rounds);
  write("investors.json", investors);
  write("insights.json", insights);
  write("meta.json", meta);
  write("series.json", series);
  write("chain.json", chain ?? emptyChain(asOf));
  write("newly-detected.json", { items: history?.meta.newlyDetected ?? [], unmatchedCsv, unmatchedMap: history?.meta.unmatchedMap ?? [] });
  // NEAR Intents (1Click) per-day aggregates with DefiLlama's NEAR Intents volume as the cross-check.
  const intentsDays = readIntentsDaily();
  const llamaIntents: Series = history ? (history.store.volume.near["NEAR Intents"] ?? []) : [];
  const intents = intentsDays.length ? summarizeIntents(intentsDays, llamaIntents, history?.meta.cursors.intents.backfillDone ?? false) : EMPTY_INTENTS;
  write("intents.json", { ...intents, llamaDaily: llamaIntents });
  console.log(`  intents: ${intents.coverage.days} days of 1Click aggregates${intents.coverage.firstDay ? ` from ${intents.coverage.firstDay}` : ""} · DefiLlama series ${llamaIntents.length} days`);
  console.log(`\n  wrote ${OUT}\n`);
}

// Small indirection so the project-series helper can be imported lazily without a circular import.
import { projectSeries } from "../src/lib/live";
function await0(rows: Parameters<typeof projectSeries>[0], store: HistoryStore) {
  return projectSeries(rows, store);
}

main();
