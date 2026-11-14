/**
 * Computes every number behind the /thesis page and renders THESIS.md from
 * docs/templates/THESIS.template.md. Reads only committed files (data/history, data/raw and
 * src/data/generated written by build-data.ts); no network, so `npm run rebuild` is reproducible
 * on a fresh clone. Output is deterministic: no timestamps other than the data window itself.
 */
import fs from "node:fs";
import path from "node:path";
import { addDays, type DateStr } from "../src/lib/dates";
import { emptyOverview, type ChainHistory, type HistoryMeta, type Series, type SeriesMap } from "../src/lib/history-types";
import { windowEnd } from "../src/lib/live";
import { indexTo100, leadLag, logChanges, outOfSample, subtractSeries, toWeekly, trimTop, dropTop, type LeadLagSummary, type OosResult } from "../src/lib/stats";
import type { BootRow, Confounder, CrossCheck, ExplorerTest, ExplorerTestCell, ResultRow, Rigor, RobustnessVariant, ThesisJson, UsageKey, UsageMeta, UsageWindow } from "../src/lib/thesis-types";
import { BH_Q, BOOT_BLOCK, BOOT_RESAMPLES, BOOT_SEED, SIG_P, benjaminiHochberg, blockBootstrapLead, clarkWest, granger, ruleA2, ruleA4 } from "../src/lib/thesis-tests";
import { relatedTests } from "./lib/related-tests";
import type { EcosystemEvent } from "../src/lib/types";
import { BQ_BACKFILL_MAX_DEFAULT } from "./fetch/bigquery";
import { readDaily as readIntentsDaily } from "./fetch/intents";
import { HISTORY, OUT, ROOT } from "./lib/paths";
import { readJson } from "./lib/store";
import { readTablesUsedInput, tablesUsedMarkdown } from "./lib/tables-used";
import { SPECS, sqlSpec } from "../src/lib/query-specs";

const MAX_LAG = 8;
const USAGE: UsageMeta[] = [
  { key: "txns", label: "Transactions", source: "BigQuery", level: "chain", kind: "flow" },
  { key: "activeAccounts", label: "Active accounts", source: "BigQuery", level: "chain", kind: "flow" },
  { key: "newAccounts", label: "New accounts", source: "NearBlocks", level: "chain", kind: "flow" },
  { key: "functionCalls", label: "Function calls", source: "BigQuery", level: "contract", kind: "flow" },
  { key: "contractsCalled", label: "Contracts called", source: "BigQuery", level: "contract", kind: "flow" },
];
/** Where each usage series is read from: the column in data/history/chain.json and the query or endpoint that fills it. */
const USAGE_REF: Record<UsageKey, { store: "bigquery" | "nearblocks"; column: string; ref: string }> = {
  txns: { store: "bigquery", column: "transactions", ref: "`queries/daily_chain.sql` (`transactions` table)" },
  activeAccounts: { store: "bigquery", column: "active_accounts", ref: "`queries/daily_chain.sql` (`transactions` table, distinct signers)" },
  newAccounts: { store: "nearblocks", column: "newAccounts", ref: "`GET https://api.nearblocks.io/v1/charts`" },
  functionCalls: { store: "bigquery", column: "function_calls", ref: "`queries/daily_receipts.sql` (`receipt_actions` table)" },
  contractsCalled: { store: "bigquery", column: "contracts_called", ref: "`queries/daily_receipts.sql` (`receipt_actions` table)" },
};
/** BigQuery chain counts that NearBlocks' daily charts also publish; NearBlocks stays as a labelled cross-check. */
const CROSS_CHECK: Array<{ key: UsageKey; nearblocks: string }> = [
  { key: "txns", nearblocks: "txns" },
  { key: "activeAccounts", nearblocks: "activeAccounts" },
];
/** Weekly totals further apart than this are listed in the cross-check. */
const CROSS_CHECK_FLAG = 0.1;

const QUERIES: ThesisJson["queries"] = {
  intentsLlama: SPECS.intentsLlama,
  intentsExplorer: SPECS.intentsExplorer,
  nearblocks: SPECS.nearblocks,
  dailyChain: sqlSpec("daily_chain", fs.readFileSync(path.join(ROOT, "queries", "daily_chain.sql"), "utf8")),
  dailyReceipts: sqlSpec("daily_receipts", fs.readFileSync(path.join(ROOT, "queries", "daily_receipts.sql"), "utf8")),
  weekly: SPECS.weekly,
  leadLag: SPECS.leadLag,
  oos: SPECS.oos,
  rigor: {
    kind: "transform",
    title: "src/lib/thesis-tests.ts blockBootstrapLead, benjaminiHochberg, clarkWest, granger",
    code: `x, y        = weekly log changes (predictor, usage), aligned on ISO weeks
rows        = for each week t, [x_t, y_t+1 ... y_t+8]
r*          = max over lags 1..8 of corr(x_t, y_t+k)
null        = 2,000 times, resample x rows and y rows separately in moving blocks of 4 weeks, recompute r* with the lag search
p           = (1 + count(null r* >= observed r*)) / 2,001
interval    = 5th and 95th percentile of corr at the chosen lag over paired block resamples
BH          = Benjamini-Hochberg over 5 series x 2 predictors, q = 0.10
Clark-West  = model 1 y_t ~ price_t-Lp, model 2 adds intents_t-Li (lags picked on weeks before the cutoff)
              f_t = e1^2 - (e2^2 - (yhat1 - yhat2)^2), CW = mean(f) / se(f), one-sided normal p
Granger     = F-test of x lags 1..p added to y lags 1..p, p = 1..4, summary p = min(p) x 4`,
  },
};

function loadChain(): ChainHistory {
  const c = readJson<Partial<ChainHistory>>(path.join(HISTORY, "chain.json"), {});
  return { near: { ...emptyOverview(), ...(c.near ?? {}) }, aurora: { ...emptyOverview(), ...(c.aurora ?? {}) }, nearblocks: c.nearblocks ?? {}, bigquery: c.bigquery ?? {}, price: c.price ?? {} };
}

function clip(s: Series, start: DateStr, end: DateStr): Series {
  return s.filter(([d]) => d >= start && d <= end);
}

function asAligned(series: Series, dates: DateStr[]): Array<number | null> {
  const m = new Map(series);
  return dates.map((d) => m.get(d) ?? null);
}

function r3(v: number | null | undefined): number | null {
  return v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000;
}

function roundLL(ll: LeadLagSummary): LeadLagSummary {
  return {
    ...ll,
    points: ll.points.map((p) => ({ ...p, r: r3(p.r) })),
    r0: r3(ll.r0),
    bestLead: ll.bestLead ? { ...ll.bestLead, r: r3(ll.bestLead.r) } : null,
    bestPositiveLead: ll.bestPositiveLead ? { ...ll.bestPositiveLead, r: r3(ll.bestPositiveLead.r) } : null,
    bestLagging: ll.bestLagging ? { ...ll.bestLagging, r: r3(ll.bestLagging.r) } : null,
    noiseBand: r3(ll.noiseBand),
  };
}

function roundOos(o: OosResult): OosResult {
  return { ...o, train: o.train ? { ...o.train, a: r3(o.train.a) ?? 0, b: r3(o.train.b) ?? 0, r2: r3(o.train.r2) ?? 0 } : null, r2Oos: r3(o.r2Oos), hitRate: r3(o.hitRate), mae: r3(o.mae), naiveMae: r3(o.naiveMae) };
}

function r4(v: number | null | undefined): number | null {
  return v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10000) / 10000;
}

function fmtRatio(v: number | null | undefined): string {
  return v === null || v === undefined ? "n/a" : v.toFixed(4);
}

function fmtP(v: number | null | undefined): string {
  return v === null || v === undefined ? "n/a" : v < 0.001 ? "< 0.001" : v.toFixed(3);
}

function fmtR(v: number | null | undefined): string {
  return v === null || v === undefined ? "n/a" : v.toFixed(2);
}

function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? "n/a" : `${Math.round(v * 100)}%`;
}

/**
 * Part A on one set of weekly changes: A1 block-bootstrap p-values with Benjamini-Hochberg across every series and
 * both predictors, A2 the nested Clark-West comparison, A3 Granger both ways, A4 the verdict gate.
 */
function rigorOf(xi: Series, xp: Series, usage: Partial<Record<UsageKey, Series>>, cutoff: DateStr): Rigor {
  const keys = USAGE.filter((u) => (usage[u.key]?.length ?? 0) >= 12).map((u) => u.key);
  const raw = keys.flatMap((k) => [blockBootstrapLead(xi, usage[k]!, MAX_LAG), blockBootstrapLead(xp, usage[k]!, MAX_LAG)]);
  const bh = benjaminiHochberg(raw.map((b) => b.p), BH_Q);
  const row = (i: number): BootRow => {
    const b = raw[i];
    return { lag: b.lag, r: r3(b.r), p: r4(b.p), pAdj: r4(bh.adjusted[i]), significant: bh.significant[i] && (b.r ?? 0) > 0, ciLow: r3(b.ciLow), ciHigh: r3(b.ciHigh), n: b.n, outsideBand: (b.r ?? 0) > 0.2 };
  };
  const bootstrap: Rigor["bootstrap"] = {};
  keys.forEach((k, j) => (bootstrap[k] = { intents: row(2 * j), price: row(2 * j + 1) }));
  const cw: Rigor["clarkWest"] = {};
  const gr: Rigor["granger"] = {};
  for (const k of keys) {
    const c = clarkWest(xi, xp, usage[k]!, cutoff, MAX_LAG);
    cw[k] = { ...c, mse1: r4(c.mse1 === null ? null : c.mse1 * 1000), mse2: r4(c.mse2 === null ? null : c.mse2 * 1000), cw: r3(c.cw), p: r4(c.p) };
    const fwd = granger(xi, usage[k]!, 4);
    const rev = granger(usage[k]!, xi, 4);
    const round = (g: typeof fwd) => ({ ...g, pByLag: g.pByLag.map((p) => r4(p)), pMin: r4(g.pMin) });
    gr[k] = { forward: round(fwd), reverse: round(rev), usageLeads: rev.significant && !fwd.significant };
  }
  const a2Pass = ruleA2(Object.values(cw) as NonNullable<Rigor["clarkWest"][UsageKey]>[]);
  const significantSeries = keys.filter((k) => bootstrap[k]!.intents.significant);
  const levels = significantSeries.map((k) => USAGE.find((u) => u.key === k)!.level);
  return { seed: BOOT_SEED, resamples: BOOT_RESAMPLES, block: BOOT_BLOCK, q: BH_Q, bootstrap, clarkWest: cw, a2Pass, granger: gr, significantSeries, a4Pass: ruleA4(levels, a2Pass) };
}

function main() {
  const meta = readJson<HistoryMeta | null>(path.join(HISTORY, "_meta.json"), null);
  const uncoveredReceipts = readJson<{ uncovered?: Record<string, { start: DateStr; end: DateStr; gb?: number }> }>(path.join(HISTORY, "bq-estimate.json"), {}).uncovered?.daily_receipts;
  const chain = loadChain();
  const volumeNear = readJson<SeriesMap>(path.join(HISTORY, "defillama", "volume-near.json"), {});
  const intentsLlama = volumeNear["NEAR Intents"] ?? [];
  const events = readJson<EcosystemEvent[]>(path.join(OUT, "events.json"), []);
  const outFile = path.join(OUT, "thesis.json");
  const mdFile = path.join(ROOT, "THESIS.md");
  fs.mkdirSync(OUT, { recursive: true });

  if (!meta?.lastRunDate || intentsLlama.length < 60 || !(chain.bigquery.transactions ?? []).length || !(chain.nearblocks.price ?? []).length) {
    const reason = "The thesis needs the committed history (DefiLlama NEAR Intents volume, BigQuery daily chain counts, NearBlocks daily charts). Run npm run refresh first.";
    fs.writeFileSync(outFile, JSON.stringify({ available: false, reason }));
    console.log(`  thesis: unavailable (${reason})\n`);
    return;
  }

  const end = windowEnd(meta.lastRunDate);
  const start = intentsLlama.find(([, v]) => v > 0)?.[0] ?? intentsLlama[0][0];
  const cutoff = (process.env.THESIS_CUTOFF as DateStr | undefined) ?? "2026-05-01";
  const nb = chain.nearblocks;
  const bq = chain.bigquery;

  const dailyRaw = Object.fromEntries(USAGE.map((u) => [u.key, clip((USAGE_REF[u.key].store === "bigquery" ? bq : nb)[USAGE_REF[u.key].column] ?? [], start, end)])) as Record<UsageKey, Series>;
  const priceDaily = clip(nb.price ?? [], start, end);
  const intentsDaily = clip(intentsLlama, start, end);
  const explorerDays = readIntentsDaily().filter((d) => !d.partial);
  const explorerDaily: Series = explorerDays.map((d) => [d.date, d.volumeUsd]);

  // Weekly base series.
  const wIntents = toWeekly(intentsDaily, "flow", end);
  const wPrice = toWeekly(priceDaily, "stock", end);
  const wUsage = {} as Record<UsageKey, Series>;
  for (const u of USAGE) wUsage[u.key] = toWeekly(dailyRaw[u.key], u.kind, end);
  const weeklyDates = wIntents.map(([d]) => d);
  const xIntents = logChanges(wIntents);
  const xPrice = logChanges(wPrice);

  // Test 2: lead-lag per usage series. Test 3: out-of-sample.
  const leadLagOut: ThesisJson["leadLag"] = {};
  const oosOut: ThesisJson["oos"] = {};
  for (const u of USAGE) {
    const y = logChanges(wUsage[u.key]);
    if (y.length < 12) continue;
    leadLagOut[u.key] = { intents: roundLL(leadLag(xIntents, y, MAX_LAG)), price: roundLL(leadLag(xPrice, y, MAX_LAG)) };
    oosOut[u.key] = { intents: roundOos(outOfSample(xIntents, y, cutoff, MAX_LAG)), price: roundOos(outOfSample(xPrice, y, cutoff, MAX_LAG)) };
  }

  // NearBlocks cross-check of the BigQuery chain counts: the daily ratio, the weeks whose totals differ by more
  // than 10%, and the same two tests on the NearBlocks series. Reported, never used in the verdict.
  const crossCheck: ThesisJson["crossCheck"] = {};
  for (const c of CROSS_CHECK) {
    const u = USAGE.find((m) => m.key === c.key)!;
    const nbDaily = clip(nb[c.nearblocks] ?? [], start, end);
    if (!nbDaily.length || !dailyRaw[c.key].length) continue;
    const nbMap = new Map(nbDaily);
    const ratios = dailyRaw[c.key].filter(([d]) => (nbMap.get(d) ?? 0) > 0).map(([d, v]) => v / (nbMap.get(d) as number)).sort((a, b) => a - b);
    const wNb = toWeekly(nbDaily, u.kind, end);
    const wNbMap = new Map(wNb);
    const weeks = wUsage[c.key].filter(([d]) => (wNbMap.get(d) ?? 0) > 0).map(([d, v]) => ({ week: d, bigquery: v, nearblocks: wNbMap.get(d) as number, ratio: r4(v / (wNbMap.get(d) as number)) as number }));
    const yNb = logChanges(wNb);
    const check: CrossCheck = {
      days: ratios.length,
      ratioMedian: r4(ratios.length ? ratios[Math.floor(ratios.length / 2)] : null),
      ratioMin: r4(ratios[0]),
      ratioMax: r4(ratios.at(-1)),
      weeks: weeks.length,
      flaggedWeeks: weeks.filter((w) => Math.abs(w.ratio - 1) > CROSS_CHECK_FLAG),
      leadLag: { intents: roundLL(leadLag(xIntents, yNb, MAX_LAG)), price: roundLL(leadLag(xPrice, yNb, MAX_LAG)) },
      oos: { intents: roundOos(outOfSample(xIntents, yNb, cutoff, MAX_LAG)), price: roundOos(outOfSample(xPrice, yNb, cutoff, MAX_LAG)) },
    };
    crossCheck[c.key] = check;
  }

  // Test 4: robustness variants.
  /** A predictor "wins" a usage series when its best positive-lag correlation is positive, outside the noise band and at least 0.02 above the other predictor's. */
  const score = (a: LeadLagSummary, b: LeadLagSummary): "intents" | "price" | "none" => {
    const band = a.noiseBand ?? 0.2;
    const ra = a.bestPositiveLead?.r ?? 0;
    const rb = b.bestPositiveLead?.r ?? 0;
    if (ra > band && ra >= rb + 0.02) return "intents";
    if (rb > band && rb >= ra + 0.02) return "price";
    return "none";
  };
  const variant = (id: string, label: string, description: string, xi: Series, xp: Series, usage: Partial<Record<UsageKey, Series>>, maxLag = MAX_LAG): RobustnessVariant => {
    const results: RobustnessVariant["results"] = {};
    let iw = 0;
    let pw = 0;
    for (const u of USAGE) {
      const y = usage[u.key];
      if (!y || y.length < 12) continue;
      const a = leadLag(xi, y, maxLag);
      const b = leadLag(xp, y, maxLag);
      const ai = a.bestPositiveLead && a.bestPositiveLead.r !== null ? { lag: a.bestPositiveLead.lag, r: r3(a.bestPositiveLead.r) as number } : null;
      const bp = b.bestPositiveLead && b.bestPositiveLead.r !== null ? { lag: b.bestPositiveLead.lag, r: r3(b.bestPositiveLead.r) as number } : null;
      results[u.key] = { intents: ai, price: bp, n: a.n };
      const w = score(a, b);
      if (w === "intents") iw += 1;
      else if (w === "price") pw += 1;
    }
    return { id, label, description, results, intentsWins: iw, priceWins: pw };
  };
  const weeklyChanges = (m: Record<UsageKey, Series>) => Object.fromEntries(USAGE.map((u) => [u.key, logChanges(toWeekly(m[u.key], u.kind, end))])) as Record<UsageKey, Series>;
  const baseUsage = weeklyChanges(dailyRaw);
  const robustness: RobustnessVariant[] = [];
  robustness.push(variant("base", "Weekly, all days", "The headline test: weekly log changes, DefiLlama Intents volume, NearBlocks price.", xIntents, xPrice, baseUsage));
  const trimmed = trimTop(intentsDaily, 0.95);
  robustness.push(variant("trimmed", "Largest 5% of Intents days capped", `The ${trimmed.trimmed} biggest Intents volume days are capped at $${Math.round(trimmed.cap).toLocaleString("en-US")} before weekly resampling, to check that a few spikes do not drive the result.`, logChanges(toWeekly(trimmed.series, "flow", end)), xPrice, baseUsage));
  const dropped = dropTop(intentsDaily, 0.95);
  robustness.push(variant("removed", "Largest 5% of Intents days removed", `The ${dropped.dropped} biggest Intents volume days (above $${Math.round(dropped.cut).toLocaleString("en-US")}) are left out before weekly resampling; their weeks keep the remaining days, and weeks left with fewer than 4 days are dropped.`, logChanges(toWeekly(dropped.series, "flow", end)), xPrice, baseUsage));
  const exUsage: Partial<Record<UsageKey, Series>> = { functionCalls: logChanges(toWeekly(subtractSeries(dailyRaw.functionCalls, clip(bq.auroraCalls ?? [], start, end), clip(bq.intentsCalls ?? [], start, end)), "flow", end)) };
  robustness.push(variant("exAuroraIntents", "Function calls without aurora and intents.near receipts", "Receipts to the aurora and intents.near accounts are subtracted from function calls, so the usage series cannot contain the Intents settlement itself.", xIntents, xPrice, exUsage));
  const dailyChanges = Object.fromEntries(USAGE.map((u) => [u.key, logChanges(dailyRaw[u.key])])) as Record<UsageKey, Series>;
  robustness.push(variant("daily", "Daily instead of weekly", "Day-over-day log changes at lags of −8 to +8 days; noisier, but not dependent on the week boundary.", logChanges(intentsDaily), logChanges(priceDaily), dailyChanges));
  if (explorerDaily.length >= 60) {
    const ex = logChanges(toWeekly(explorerDaily, "flow", end));
    const sub: Partial<Record<UsageKey, Series>> = {};
    for (const u of USAGE) sub[u.key] = baseUsage[u.key].filter(([d]) => d >= explorerDaily[0][0]);
    robustness.push(variant("explorer", "1Click Explorer volume instead of DefiLlama", `The Explorer covers 1Click swaps only, from ${explorerDaily[0][0]}; DefiLlama's adapter covers every channel.`, ex, xPrice.filter(([d]) => d >= explorerDaily[0][0]), sub));
  }

  // Coverage of the Explorer vs DefiLlama.
  const llamaMap = new Map(intentsLlama);
  const both = explorerDays.filter((d) => (llamaMap.get(d.date) ?? 0) > 0);
  const ratios = both.map((d) => d.volumeUsd / (llamaMap.get(d.date) as number)).filter((v) => Number.isFinite(v));
  const sortedRatios = [...ratios].sort((a, b) => a - b);
  const ratioMedian = sortedRatios.length ? sortedRatios[Math.floor(sortedRatios.length / 2)] : null;
  const explorerSum = both.reduce((a, d) => a + d.volumeUsd, 0);
  const llamaSum = both.reduce((a, d) => a + (llamaMap.get(d.date) as number), 0);
  const ratioSum = llamaSum > 0 ? explorerSum / llamaSum : null;

  // Confounders from the events file (matched by title keywords; nothing invented).
  const pickEvent = (re: RegExp, why: string): Confounder | null => {
    const e = events.find((ev) => re.test(ev.title));
    return e ? { title: e.title, date: e.date, monthOnly: e.monthOnly, kind: e.type, detail: e.detail, sourceUrl: e.sourceUrl, why } : null;
  };
  const confounders = [
    pickEvent(/Omni deposit\/withdraw exploit/i, "A $3.8M loss and a service pause on Oct 1, 2026 depress Intents volume for reasons unrelated to demand."),
    pickEvent(/NEAR@3\.33/i, "A token drop tied to Confidential Intents TVL and a price floor creates incentive-driven volume and price moves at the same time."),
    pickEvent(/Zashi wallet adds shielded ZEC/i, "Zcash flows later drove about a tenth of Intents volume; privacy demand, not NEAR usage."),
    pickEvent(/fee switch/i, "Protocol revenue from Intents fees now funds NEAR buybacks, which links volume to price directly rather than through usage."),
    pickEvent(/Brave Wallet integrates/i, "Distribution deals move Intents volume in steps that have nothing to do with activity on NEAR itself."),
    pickEvent(/Halving upgrade/i, "A supply change that can move price independently of usage."),
    pickEvent(/Bitwise NEAR ETF \(NRR\) begins trading/i, "An ETF listing is a price event with no mechanical link to onchain usage."),
  ].filter((c): c is Confounder => Boolean(c));

  const bqWeeks = wUsage.functionCalls.length;
  const usageWindows = Object.fromEntries(USAGE.map((u) => [u.key, { source: u.source, ref: USAGE_REF[u.key].ref, start: dailyRaw[u.key][0]?.[0] ?? null, end: dailyRaw[u.key].at(-1)?.[0] ?? null, weeks: wUsage[u.key].length } satisfies UsageWindow])) as Record<UsageKey, UsageWindow>;
  /** Intents wins of the lead-lag test per level, filled in the loop below. */
  const levelWins: Record<UsageMeta["level"], number> = { chain: 0, contract: 0 };
  // Verdict from the computed tables. Only positive lead correlations outside the noise band count.
  let iw = 0;
  let pw = 0;
  let ties = 0;
  const forLines: string[] = [];
  const againstLines: string[] = [];
  const wk = (n: number) => `${n} week${n === 1 ? "" : "s"}`;
  for (const u of USAGE) {
    const ll = leadLagOut[u.key];
    if (!ll) continue;
    const band = ll.intents.noiseBand ?? 0.2;
    const a = ll.intents.bestPositiveLead;
    const b = ll.price.bestPositiveLead;
    const w = score(ll.intents, ll.price);
    const describe = (name: string, p: typeof a) => (p && p.r !== null ? `${name} leads by ${wk(p.lag)} with r = ${fmtR(p.r)}${p.r > band ? "" : " (inside the noise band)"}` : `${name} has no positive lead at any lag`);
    if (w === "intents") {
      iw += 1;
      levelWins[u.level] += 1;
      forLines.push(`${u.label} (${u.source}, ${ll.intents.n} weeks): ${describe("Intents volume", a)}; ${describe("price", b)}.`);
    } else if (w === "price") {
      pw += 1;
      againstLines.push(`${u.label} (${u.source}, ${ll.intents.n} weeks): ${describe("price", b)}, stronger than Intents volume (${a && a.r !== null ? `r = ${fmtR(a.r)} at ${wk(a.lag)}` : "no positive lead"}).`);
    } else {
      ties += 1;
      againstLines.push(`${u.label} (${u.source}, ${ll.intents.n} weeks): inconclusive. ${describe("Intents volume", a)}; ${describe("price", b)}. Neither clears the ±${fmtR(band)} noise band with a positive lead.`);
    }
    if ((ll.intents.r0 ?? 0) > band && (ll.intents.r0 ?? 0) > (a?.r ?? 0)) {
      againstLines.push(`${u.label}: Intents volume and usage move together in the same week (r = ${fmtR(ll.intents.r0)}) more than with any lead, which reads as coincident, not leading.`);
    }
    const inv = ll.price.bestLead;
    if (inv && inv.r !== null && inv.r < -band) againstLines.push(`${u.label}: the strongest price relationship is inverse (r = ${fmtR(inv.r)} at ${wk(inv.lag)}): price rises precede lower ${u.label.toLowerCase()}, not higher.`);
  }
  let oiw = 0;
  let opw = 0;
  for (const u of USAGE) {
    const o = oosOut[u.key];
    if (!o || o.intents.r2Oos === null || o.price.r2Oos === null) continue;
    if (o.intents.r2Oos > 0 && o.intents.r2Oos > o.price.r2Oos + 0.01) {
      oiw += 1;
      forLines.push(`Out of sample, Intents volume predicts ${u.label.toLowerCase()} changes after ${cutoff} with R² = ${fmtR(o.intents.r2Oos)} and a ${pct(o.intents.hitRate)} sign hit rate, against R² = ${fmtR(o.price.r2Oos)} for price.`);
    } else if (o.price.r2Oos > 0 && o.price.r2Oos > o.intents.r2Oos + 0.01) {
      opw += 1;
      againstLines.push(`Out of sample, price predicts ${u.label.toLowerCase()} changes better than Intents volume after ${cutoff} (R² = ${fmtR(o.price.r2Oos)} vs ${fmtR(o.intents.r2Oos)}).`);
    } else {
      againstLines.push(`Out of sample, neither predictor beats the training mean for ${u.label.toLowerCase()} after ${cutoff} (Intents R² = ${fmtR(o.intents.r2Oos)}, price R² = ${fmtR(o.price.r2Oos)}).`);
    }
  }
  // Each robustness variant counts on the side it falls, so a check that cuts against the claim is listed as such.
  for (const v of robustness.slice(1)) {
    const line = `Robustness, ${v.label.charAt(0).toLowerCase()}${v.label.slice(1)}: Intents volume is the stronger positive lead for ${v.intentsWins} usage series, price for ${v.priceWins}.`;
    if (v.intentsWins > v.priceWins) forLines.push(line);
    else if (v.priceWins > v.intentsWins) againstLines.push(line);
  }
  const riw = robustness.slice(1).reduce((a, v) => a + v.intentsWins, 0);
  const rpw = robustness.slice(1).reduce((a, v) => a + v.priceWins, 0);
  const total = iw + pw + ties;
  // Part A on the headline weeks.
  const rigor = rigorOf(xIntents, xPrice, baseUsage, cutoff);
  const labelOf = (k: UsageKey) => USAGE.find((u) => u.key === k)!.label;
  for (const u of USAGE) {
    const b = rigor.bootstrap[u.key];
    if (!b) continue;
    const i = b.intents;
    const line = `${u.label}: Intents volume's best lead (${wk(i.lag)}, r = ${fmtR(i.r)}, 90% interval ${fmtR(i.ciLow)} to ${fmtR(i.ciHigh)}) has a block-bootstrap p-value of ${fmtP(i.p)}, ${fmtP(i.pAdj)} after Benjamini-Hochberg`;
    if (i.significant) forLines.push(`${line}, significant at q = ${BH_Q}.`);
    else againstLines.push(`${line}, not significant at q = ${BH_Q}.`);
    const g = rigor.granger[u.key];
    if (g?.usageLeads) againstLines.push(`${u.label}: usage changes Granger-predict Intents volume (p = ${fmtP(g.reverse.pMin)}) while Intents volume does not Granger-predict usage (p = ${fmtP(g.forward.pMin)}), so usage may lead Intents rather than the reverse.`);
  }
  const cwPassed = USAGE.filter((u) => rigor.clarkWest[u.key]?.pass).map((u) => u.label.toLowerCase());
  (rigor.a2Pass ? forLines : againstLines).push(`Adding lagged Intents volume to a price-only model lowers out-of-sample error with Clark-West p < ${SIG_P} for ${cwPassed.length} of ${Object.keys(rigor.clarkWest).length} usage series${cwPassed.length ? ` (${cwPassed.join(", ")})` : ""}; the rule needs at least two.`);
  /** The verdict rule, shared by the headline and the Explorer-only test. */
  const verdictOf = (lead: number, priceLead: number, oosWins: number, priceOosWins: number, gate: boolean): ThesisJson["verdict"]["supported"] => (lead >= 3 && priceLead === 0 && oosWins >= priceOosWins && gate ? "yes" : lead > priceLead && oosWins >= priceOosWins ? "partly" : "no");
  const verdictWord = (v: ThesisJson["verdict"]["supported"]) => (v === "yes" ? "supported" : v === "partly" ? "partly supported" : "not supported");
  const supported = verdictOf(iw, pw, oiw, opw, rigor.a4Pass);
  const verdictRule = `"Supported" needs Intents volume to be the stronger positive lead on three or more usage series with none for price, to win at least as many out-of-sample comparisons as price, to be significant after Benjamini-Hochberg (block bootstrap, q = ${BH_Q}) on at least three series including one chain-level count, and the nested Clark-West test to pass on at least two series. "Partly supported" needs more lead wins than price and at least as many out-of-sample wins. Anything else is "not supported".`;

  // Explorer-only test: both tests again with the track's named source, 1Click Explorer volume, as the predictor over
  // the weeks it covers, next to DefiLlama volume and price over those same weeks.
  const explorerClipped = clip(explorerDaily, start, end);
  const xExplorer = logChanges(toWeekly(explorerClipped, "flow", end));
  const explorerTest: ExplorerTest = (() => {
    const tally = () => ({ leadWins: 0, priceLeadWins: 0, ties: 0, oosWins: 0, priceOosWins: 0 });
    const te = tally();
    const tl = tally();
    const span = { start: explorerClipped[0]?.[0] ?? null, end: explorerClipped.at(-1)?.[0] ?? null, weeks: xExplorer.length };
    const none = { ...tally(), supported: "no" as const };
    if (xExplorer.length < 12) {
      return { available: false, ...span, results: {}, explorer: none, llama: none, holds: null, conclusion: `The Explorer backfill gives ${xExplorer.length} weekly changes, fewer than the 12 the tests need, so no Explorer-only result is reported.` };
    }
    const from = xExplorer[0][0];
    const to = xExplorer[xExplorer.length - 1][0];
    const sameWeeks = (s: Series) => s.filter(([d]) => d >= from && d <= to);
    const xl = sameWeeks(xIntents);
    const xp = sameWeeks(xPrice);
    const results: ExplorerTest["results"] = {};
    for (const u of USAGE) {
      const y = sameWeeks(baseUsage[u.key]);
      if (y.length < 12) continue;
      const cell = (x: Series): ExplorerTestCell => ({ leadLag: roundLL(leadLag(x, y, MAX_LAG)), oos: roundOos(outOfSample(x, y, cutoff, MAX_LAG)) });
      const r = { explorer: cell(xExplorer), llama: cell(xl), price: cell(xp) };
      results[u.key] = r;
      for (const [t, c] of [[te, r.explorer], [tl, r.llama]] as const) {
        const w = score(c.leadLag, r.price.leadLag);
        if (w === "intents") t.leadWins += 1;
        else if (w === "price") t.priceLeadWins += 1;
        else t.ties += 1;
        const a = c.oos.r2Oos;
        const b = r.price.oos.r2Oos;
        if (a === null || b === null) continue;
        if (a > 0 && a > b + 0.01) t.oosWins += 1;
        else if (b > 0 && b > a + 0.01) t.priceOosWins += 1;
      }
    }
    const n = Object.keys(results).length;
    const sameUsage = Object.fromEntries(USAGE.map((u) => [u.key, sameWeeks(baseUsage[u.key])])) as Record<UsageKey, Series>;
    const e = { ...te, supported: verdictOf(te.leadWins, te.priceLeadWins, te.oosWins, te.priceOosWins, rigorOf(xExplorer, xp, sameUsage, cutoff).a4Pass) };
    const l = { ...tl, supported: verdictOf(tl.leadWins, tl.priceLeadWins, tl.oosWins, tl.priceOosWins, rigorOf(xl, xp, sameUsage, cutoff).a4Pass) };
    // The conclusion holds when the Explorer verdict is at least as strong as the full-window one.
    const rank = { no: 0, partly: 1, yes: 2 } as const;
    const holds = rank[e.supported] >= rank[supported];
    const outcome = rank[e.supported] > rank[supported] ? "holds, and reads stronger there than over the full window," : holds ? "holds" : "does not hold";
    const conclusion =
      `With Explorer 1Click volume as the predictor over ${span.weeks} weekly changes (${span.start} to ${span.end}), Intents volume is the stronger positive lead for ${e.leadWins} of ${n} usage series (${e.priceLeadWins} for price, ${e.ties} inconclusive) and wins ${e.oosWins} out-of-sample comparisons to price's ${e.priceOosWins}, which reads as ${verdictWord(e.supported)}. ` +
      `DefiLlama volume over the same weeks gives ${l.leadWins} of ${n} (${l.priceLeadWins} for price, ${l.ties} inconclusive) and ${l.oosWins} to ${l.priceOosWins} out of sample, ${verdictWord(l.supported)}. ` +
      `The full-window result with DefiLlama volume is ${verdictWord(supported)}, so the conclusion ${outcome} with the Explorer as the Intents source over the weeks it covers. Fewer weeks mean a wider noise band, so the Explorer result rests on the smaller sample.`;
    return { available: true, ...span, results, explorer: e, llama: l, holds, conclusion };
  })();
  const tested = USAGE.filter((u) => leadLagOut[u.key]);
  const levelLine = (level: UsageMeta["level"], name: string) => {
    const of = tested.filter((u) => u.level === level);
    const spans = Array.from(new Set(of.map((u) => wUsage[u.key].length))).sort((a, b) => a - b);
    return `${levelWins[level]} of ${of.length} ${name} (${of.map((u) => u.label.toLowerCase()).join(", ")}; ${spans.join(" or ")} weeks)`;
  };
  const headline =
    supported === "yes"
      ? `supported. Intents volume is the stronger positive lead for ${iw} of ${total} usage series with none going to price, and it wins ${oiw} of the out-of-sample comparisons (${opw} for price).`
      : supported === "partly"
        ? `partly supported. Intents volume is the stronger positive lead for ${iw} of ${total} usage series (${pw} for price, ${ties} inconclusive), and it wins ${oiw} out-of-sample comparisons to price's ${opw}, with the lead on ${levelLine("contract", "contract-level series")} and on ${levelLine("chain", "chain-level counts")}.`
        : `not supported by this data. Intents volume is the stronger positive lead for ${iw} of ${total} usage series, price for ${pw}, ${ties} inconclusive; out of sample Intents wins ${oiw} and price ${opw}.`;
  const gateLine = ` After the block bootstrap and Benjamini-Hochberg, Intents volume is significant on ${rigor.significantSeries.length} of ${Object.keys(rigor.bootstrap).length} series${rigor.significantSeries.length ? ` (${rigor.significantSeries.map((k) => labelOf(k).toLowerCase()).join(", ")})` : ""}, and adding it to price lowers out-of-sample error significantly (Clark-West) on ${cwPassed.length}.`;
  const headlineFull = headline + gateLine;

  // Part B, the related tests, from the same committed files.
  const related = relatedTests({ chain, start, end, cutoff, explorerDays, xIntents, xPrice, maxLag: MAX_LAG, txnsWeekly: baseUsage.txns, txnsIntentsR: leadLagOut.txns?.intents.bestPositiveLead?.r ?? null, events });
  for (const t of related) {
    const line = `${t.code}, ${t.title.charAt(0).toLowerCase()}${t.title.slice(1)}: ${t.result}`;
    if (t.status === "pass") forLines.push(line);
    else if (t.status === "fail") againstLines.push(line);
  }
  const statusWord = (ok: boolean) => (ok ? "pass" : "fail") as ResultRow["status"];
  const results: ResultRow[] = [
    { id: "significance", code: "A1", test: "Significance of the best lead", rule: `Block bootstrap p-value with the lag search in every resample, Benjamini-Hochberg at q = ${BH_Q} across ${Object.keys(rigor.bootstrap).length} series and both predictors; the verdict gate needs three or more series`, result: `Intents significant on ${rigor.significantSeries.length} series, price on ${USAGE.filter((u) => rigor.bootstrap[u.key]?.price.significant).length}`, status: statusWord(rigor.significantSeries.length >= 3) },
    { id: "beyond-price", code: "A2", test: "Intents adds information beyond price", rule: `Model with Intents lowers test MSE with Clark-West p < ${SIG_P} on at least two series`, result: `${cwPassed.length} of ${Object.keys(rigor.clarkWest).length} series`, status: statusWord(rigor.a2Pass) },
    { id: "granger", code: "A3", test: "Reverse direction (Granger)", rule: "Reported both ways; flagged when usage leads Intents and not the reverse", result: `Intents predicts usage on ${USAGE.filter((u) => rigor.granger[u.key]?.forward.significant).length} series, usage predicts Intents on ${USAGE.filter((u) => rigor.granger[u.key]?.reverse.significant).length}, usage alone leads on ${USAGE.filter((u) => rigor.granger[u.key]?.usageLeads).length}`, status: USAGE.some((u) => rigor.granger[u.key]?.usageLeads) ? "fail" : "pass" },
    { id: "verdict-gate", code: "A4", test: "Verdict gate", rule: "Significant on three or more series including one chain-level count, and A2 passing", result: `Verdict ${supported === "yes" ? "supported" : supported === "partly" ? "partly supported" : "not supported"}`, status: statusWord(rigor.a4Pass) },
    ...related.map((t) => ({ id: t.id, code: t.code, test: t.title, rule: t.rule, result: t.result, status: t.status })),
  ];

  if (!forLines.length) forLines.push("No usage series showed Intents volume as the stronger lead in this window.");
  if (!againstLines.length) againstLines.push("No usage series showed price as the stronger lead in this window.");
  const changeMyMind = [
    `If, when the daily refresh has added 12 more weeks, price's best positive-lag correlation exceeds Intents volume's by more than 0.10 on three or more of the five usage series, the claim is wrong. Conversely, the claim only becomes "supported" rather than "partly supported" once Intents volume is significant after Benjamini-Hochberg on at least three series, including one chain-level count, and adds out-of-sample information beyond price (Clark-West) on at least two.`,
    `If Intents volume's out-of-sample R² for transactions and active accounts falls below 0 (worse than the training mean) while price's stays above 0.10, the claim is wrong.`,
    `If removing receipts to aurora and intents.near from function calls (the "exAuroraIntents" variant) flips the winner, the apparent lead is just Intents settlement counting itself as usage.`,
    `If the 1Click Explorer series, once it covers the full window, disagrees in sign with the DefiLlama series at the chosen lag, the result depends on which Intents measure is used and should be marked unresolved.`,
  ];
  const gaps = [
    `The NEAR Intents Explorer API covers 1Click swaps only and starts in late May 2025; the committed backfill covers ${explorerDays.length} complete days${explorerDays.length ? ` from ${explorerDays[0].date}` : ""}${meta.cursors.intents.backfillDone ? "" : " and is still running"}. Where both sources exist the Explorer reports a median ${ratioMedian === null ? "n/a" : (ratioMedian * 100).toFixed(0) + "%"} of DefiLlama's daily volume. Until the backfill completes, every Intents chart uses DefiLlama's series and labels the source.`,
    `Function calls and contracts called (BigQuery \`receipt_actions\`) cover ${bqWeeks} weeks only${uncoveredReceipts?.gb !== undefined ? `: running \`queries/daily_receipts.sql\` over ${uncoveredReceipts.start} to ${uncoveredReceipts.end} would scan ${uncoveredReceipts.gb.toFixed(2)} GB by dry run, over the ${Math.round(BQ_BACKFILL_MAX_DEFAULT / 1e9)} GB backfill budget` : ""}. For the same reason new accounts come from NearBlocks' daily charts and not from CREATE_ACCOUNT receipts. Transactions and active accounts come from BigQuery for the whole window.`,
    `Distinct signers are an estimate of users: one person can hold many accounts, and relayers or intents hide the end user, so no "unique users" metric is claimed.`,
    `No incentive or emissions data is available from a free source (DefiLlama's emissions endpoint is paid), so wash-like or incentive-driven volume cannot be separated from organic volume; the confounders above are the known programs.`,
    `Weekly samples number ${xIntents.length}; correlations smaller than about ${fmtR(leadLagOut.txns?.intents.noiseBand)} cannot be told from noise, which is why significance now comes from the block bootstrap instead.`,
    ...related.filter((t) => t.status === "not computed").map((t) => `${t.code}, ${t.title}: ${t.result}`),
  ];

  const thesis: ThesisJson = {
    available: true,
    asOf: end,
    window: { start, end, weeks: weeklyDates.length },
    bigqueryWindow: { start: dailyRaw.functionCalls[0]?.[0] ?? null, end: dailyRaw.functionCalls.at(-1)?.[0] ?? null, weeks: bqWeeks },
    cutoff,
    maxLag: MAX_LAG,
    sources: {
      intents: "DefiLlama NEAR Intents adapter (all channels); 1Click Explorer where backfilled",
      price: "NearBlocks daily NEAR price",
      usage: (["BigQuery", "NearBlocks"] as const).map((src) => `${src === "BigQuery" ? "NEAR BigQuery public dataset" : "NearBlocks daily charts"} (${USAGE.filter((u) => u.source === src).map((u) => u.label.toLowerCase()).join(", ")})`),
    },
    usageWindows,
    crossCheck,
    usage: USAGE,
    weekly: {
      dates: weeklyDates,
      intentsVolume: asAligned(wIntents, weeklyDates),
      price: asAligned(wPrice, weeklyDates),
      series: Object.fromEntries(USAGE.map((u) => [u.key, asAligned(wUsage[u.key], weeklyDates)])),
      indexed: {
        intentsVolume: asAligned(indexTo100(wIntents), weeklyDates),
        price: asAligned(indexTo100(wPrice), weeklyDates),
        series: Object.fromEntries(USAGE.map((u) => [u.key, asAligned(indexTo100(wUsage[u.key]), weeklyDates)])),
      },
    },
    daily: (() => {
      const dates: DateStr[] = [];
      for (let d = start; d <= end; d = addDays(d, 1)) dates.push(d);
      return { dates, intentsLlama: asAligned(intentsDaily, dates), intentsExplorer: asAligned(explorerDaily, dates), price: asAligned(priceDaily, dates) };
    })(),
    leadLag: leadLagOut,
    oos: oosOut,
    robustness,
    coverage: {
      explorerDays: explorerDays.length,
      explorerFirstDay: explorerDays[0]?.date ?? null,
      explorerLastDay: explorerDays.at(-1)?.date ?? null,
      ratioMedian: r3(ratioMedian),
      ratioLatest: r3(ratios.at(-1) ?? null),
      ratioSum: r3(ratioSum),
      explorerVolumeUsd: Math.round(explorerSum),
      llamaVolumeUsd: Math.round(llamaSum),
      ratioDays: both.length,
      explorerBackfillDone: meta.cursors.intents.backfillDone,
    },
    explorerTest,
    rigor,
    related,
    results,
    confounders,
    verdict: { baseIntentsWins: iw, basePriceWins: pw, baseTies: ties, oosIntentsWins: oiw, oosPriceWins: opw, robustnessIntentsWins: riw, robustnessPriceWins: rpw, supported, rule: verdictRule, headline: headlineFull, evidenceFor: forLines, evidenceAgainst: againstLines, changeMyMind, gaps },
    queries: QUERIES,
  };
  fs.writeFileSync(outFile, JSON.stringify(thesis));

  // THESIS.md from the template.
  const tpl = fs.readFileSync(path.join(ROOT, "docs", "templates", "THESIS.template.md"), "utf8");
  const llRows = USAGE.filter((u) => leadLagOut[u.key])
    .map((u) => {
      const ll = leadLagOut[u.key]!;
      const cell = (p: LeadLagSummary["bestPositiveLead"]) => (p ? `${p.lag} w | ${fmtR(p.r)}` : `none | n/a`);
      return `| ${u.label} | ${u.source} | ${cell(ll.intents.bestPositiveLead)} | ${cell(ll.price.bestPositiveLead)} | ${fmtR(ll.intents.r0)} / ${fmtR(ll.price.r0)} | ${ll.intents.n} |`;
    })
    .join("\n");
  const oosRows = USAGE.filter((u) => oosOut[u.key])
    .flatMap((u) => {
      const o = oosOut[u.key]!;
      return [`| ${u.label} | Intents volume | ${o.intents.lag} w | ${o.intents.testN} | ${fmtR(o.intents.r2Oos)} | ${pct(o.intents.hitRate)} |`, `| ${u.label} | NEAR price | ${o.price.lag} w | ${o.price.testN} | ${fmtR(o.price.r2Oos)} | ${pct(o.price.hitRate)} |`];
    })
    .join("\n");
  const robRows = robustness
    .map((v) => {
      const cells = USAGE.filter((u) => v.results[u.key]).map((u) => {
        const r = v.results[u.key]!;
        return `${u.label}: Intents ${r.intents ? `${fmtR(r.intents.r)} @${r.intents.lag}` : "n/a"} vs price ${r.price ? `${fmtR(r.price.r)} @${r.price.lag}` : "n/a"}`;
      });
      return `- **${v.label}** (${v.intentsWins} for Intents, ${v.priceWins} for price). ${v.description} ${cells.join("; ")}.`;
    })
    .join("\n");
  const tablesUsed = tablesUsedMarkdown(readTablesUsedInput(ROOT));
  const sourceRows = USAGE.map((u) => `| ${u.label} | ${u.source} | ${usageWindows[u.key].ref} | ${usageWindows[u.key].start ?? "n/a"} | ${usageWindows[u.key].end ?? "n/a"} | ${usageWindows[u.key].weeks} |`).join("\n");
  const checked = USAGE.filter((u) => crossCheck[u.key]);
  const crossLines = checked
    .map((u) => {
      const c = crossCheck[u.key]!;
      const flagged = c.flaggedWeeks.length ? `${c.flaggedWeeks.length} of ${c.weeks} (${c.flaggedWeeks.map((w) => `week of ${w.week}, ratio ${fmtRatio(w.ratio)}`).join("; ")})` : `none of ${c.weeks}`;
      return `- ${u.label}: the median daily BigQuery / NearBlocks ratio is ${fmtRatio(c.ratioMedian)} over ${c.days} days (lowest ${fmtRatio(c.ratioMin)}, highest ${fmtRatio(c.ratioMax)}). Weeks where the two weekly totals differ by more than ${Math.round(CROSS_CHECK_FLAG * 100)}%: ${flagged}.`;
    })
    .join("\n");
  const crossRows = checked
    .flatMap((u) => {
      const c = crossCheck[u.key]!;
      const cell = (p: LeadLagSummary["bestPositiveLead"]) => (p ? `${p.lag} w | ${fmtR(p.r)}` : `none | n/a`);
      const row = (src: string, ll: { intents: LeadLagSummary; price: LeadLagSummary }, o: { intents: OosResult; price: OosResult }) => `| ${u.label} | ${src} | ${cell(ll.intents.bestPositiveLead)} | ${cell(ll.price.bestPositiveLead)} | ${fmtR(o.intents.r2Oos)} / ${fmtR(o.price.r2Oos)} | ${ll.intents.n} |`;
      return [row(`${u.source} (used)`, leadLagOut[u.key]!, oosOut[u.key]!), row("NearBlocks (check)", c.leadLag, c.oos)];
    })
    .join("\n");
  const usd0 = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
  const explorerStatement = explorerDays.length
    ? `The NEAR Intents Explorer API, the source the track names, covers 1Click swaps only. The committed backfill holds ${explorerDays.length} complete days from ${explorerDays[0].date} to ${explorerDays[explorerDays.length - 1].date}${meta.cursors.intents.backfillDone ? " and has reached the API's first day" : " and had not reached the API's first day (late May 2025) when this file was built"}. Over the ${both.length} days that both sources have, it reports ${usd0(explorerSum)} against DefiLlama's ${usd0(llamaSum)} for every channel, ${pct(ratioSum)} of the total, with a median daily share of ${pct(ratioMedian)}.`
    : "The NEAR Intents Explorer API, the source the track names, covers 1Click swaps only. No complete day has been fetched yet.";
  const explorerRows = USAGE.filter((u) => explorerTest.results[u.key])
    .flatMap((u) => {
      const r = explorerTest.results[u.key]!;
      const row = (name: string, ll: LeadLagSummary, o: OosResult) => `| ${u.label} | ${name} | ${ll.bestPositiveLead ? `${ll.bestPositiveLead.lag} w | ${fmtR(ll.bestPositiveLead.r)}` : "none | n/a"} | ${fmtR(ll.r0)} | ${ll.n} | ${o.lag} w | ${o.train?.n ?? 0} / ${o.testN} | ${fmtR(o.r2Oos)} | ${pct(o.hitRate)} |`;
      const full = leadLagOut[u.key] && oosOut[u.key] ? [row("DefiLlama, full window", leadLagOut[u.key]!.intents, oosOut[u.key]!.intents)] : [];
      return [row("Explorer 1Click", r.explorer.leadLag, r.explorer.oos), row("DefiLlama, same weeks", r.llama.leadLag, r.llama.oos), row("NEAR price, same weeks", r.price.leadLag, r.price.oos), ...full];
    })
    .join("\n");
  const confRows = confounders.map((c) => `- ${c.date}${c.monthOnly ? " (month only)" : ""}, ${c.kind}: ${c.title}. ${c.why}${c.sourceUrl ? ` [source](${c.sourceUrl})` : ""}`).join("\n") || "- No matching events in the events file.";
  const fill: Record<string, string> = {
    asOf: end,
    headline: headlineFull,
    verdictRule,
    resultsTable: results.map((r) => `| ${r.code} | ${r.test} | ${r.rule} | ${r.result} | ${r.status} |`).join("\n"),
    bootTable: USAGE.filter((u) => rigor.bootstrap[u.key])
      .flatMap((u) => (["intents", "price"] as const).map((p) => {
        const b = rigor.bootstrap[u.key]![p];
        return `| ${u.label} | ${p === "intents" ? "Intents volume" : "NEAR price"} | ${b.lag} w | ${fmtR(b.r)} | ${fmtR(b.ciLow)} to ${fmtR(b.ciHigh)} | ${fmtP(b.p)} | ${fmtP(b.pAdj)} | ${b.significant ? "yes" : "no"} | ${b.outsideBand ? "outside" : "inside"} | ${b.n} |`;
      }))
      .join("\n"),
    bootSeed: String(BOOT_SEED),
    bootResamples: BOOT_RESAMPLES.toLocaleString("en-US"),
    bootBlock: String(BOOT_BLOCK),
    bhQ: String(BH_Q),
    cwTable: USAGE.filter((u) => rigor.clarkWest[u.key])
      .map((u) => {
        const c = rigor.clarkWest[u.key]!;
        return `| ${u.label} | ${c.priceLag} w | ${c.intentsLag} w | ${c.trainN} / ${c.testN} | ${c.mse1 === null ? "n/a" : c.mse1.toFixed(3)} | ${c.mse2 === null ? "n/a" : c.mse2.toFixed(3)} | ${fmtR(c.cw)} | ${fmtP(c.p)} | ${c.pass ? "yes" : "no"} |`;
      })
      .join("\n"),
    cwStatement: `Model 2 lowers test error with Clark-West p < ${SIG_P} on ${cwPassed.length} of ${Object.keys(rigor.clarkWest).length} series${cwPassed.length ? ` (${cwPassed.join(", ")})` : ""}, so A2 ${rigor.a2Pass ? "passes" : "fails"} (it needs two).`,
    grangerTable: USAGE.filter((u) => rigor.granger[u.key])
      .map((u) => {
        const g = rigor.granger[u.key]!;
        const ps = (xs: Array<number | null>) => xs.map((p) => fmtP(p)).join(" / ");
        return `| ${u.label} | ${ps(g.forward.pByLag)} | ${fmtP(g.forward.pMin)} | ${ps(g.reverse.pByLag)} | ${fmtP(g.reverse.pMin)} | ${g.usageLeads ? "usage may lead Intents" : g.forward.significant && !g.reverse.significant ? "Intents leads usage" : g.forward.significant ? "both directions" : g.reverse.significant ? "both directions" : "neither"} |`;
      })
      .join("\n"),
    grangerStatement: (() => {
      const ul = USAGE.filter((u) => rigor.granger[u.key]?.usageLeads).map((u) => u.label.toLowerCase());
      return ul.length ? `For ${ul.join(", ")}, usage changes predict later Intents volume while Intents volume does not predict usage, so usage may lead Intents rather than the reverse.` : "No series shows usage predicting Intents volume without Intents volume also predicting usage.";
    })(),
    relatedTests: related.map((t) => [`#### ${t.code}. ${t.title}`, "", `- **Rule.** ${t.rule}`, `- **Result.** ${t.result}`, `- **Status.** ${t.status}`, ...t.notes.map((n) => `- ${n}`), `- **Source.** ${t.queries.map((q) => `\`${q.title}\``).join(", ")}`].join("\n")).join("\n\n"),
    windowStart: start,
    windowEnd: end,
    weeks: String(weeklyDates.length),
    bqWeeks: String(bqWeeks),
    bqStart: thesis.bigqueryWindow.start ?? "n/a",
    bqEnd: thesis.bigqueryWindow.end ?? "n/a",
    maxLag: String(MAX_LAG),
    cutoff,
    evidenceFor: forLines.map((l) => `- ${l}`).join("\n"),
    evidenceAgainst: againstLines.map((l) => `- ${l}`).join("\n"),
    leadLagTable: llRows,
    noiseBand: fmtR(leadLagOut.txns?.intents.noiseBand),
    oosTable: oosRows,
    robustnessTable: robRows,
    sourceTable: sourceRows,
    tablesUsed,
    explorerStatement,
    explorerConclusion: explorerTest.conclusion,
    explorerTable: explorerRows || "| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |",
    crossCheckLines: crossLines || "- No NearBlocks series to compare with.",
    crossCheckTable: crossRows,
    confounders: confRows,
    changeMyMind: changeMyMind.map((l) => `- ${l}`).join("\n"),
    gaps: gaps.map((l) => `- ${l}`).join("\n"),
  };
  // A function as the replacement, so "$" in a generated value (amounts in USD) is never read as a pattern.
  const md = tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => fill[k] ?? `{{${k}}}`);
  fs.writeFileSync(mdFile, md);
  // README.md carries the same as-of date between markers, so the front page never claims fresher data than the files hold.
  const readmeFile = path.join(ROOT, "README.md");
  if (fs.existsSync(readmeFile)) {
    const readme = fs.readFileSync(readmeFile, "utf8");
    const next = readme
      .replace(/<!-- data-as-of -->[\s\S]*?<!-- \/data-as-of -->/, () => `<!-- data-as-of -->Data as of ${end}, the last complete UTC day in the committed raw files.<!-- /data-as-of -->`)
      // The same "Tables used" block as THESIS.md, so the two cannot drift.
      .replace(/<!-- tables-used -->[\s\S]*?<!-- \/tables-used -->/, () => `<!-- tables-used -->\n${tablesUsed}\n<!-- /tables-used -->`);
    if (next !== readme) fs.writeFileSync(readmeFile, next);
  }
  console.log(`  thesis: ${weeklyDates.length} weeks ${start}..${end}, cutoff ${cutoff}; lead-lag wins Intents ${iw} / price ${pw} / ties ${ties}; OOS wins Intents ${oiw} / price ${opw}; robustness ${riw}/${rpw}; verdict: ${supported}`);
  console.log(`  wrote THESIS.md and ${path.relative(ROOT, outFile)}\n`);
}

main();
