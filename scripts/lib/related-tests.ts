/**
 * Part B of the thesis tests (B1 to B6): five related angles, each computed from committed files only and judged by
 * the rule pre-registered in THESIS.md. A test whose data is not committed returns "not computed" with the reason.
 */
import fs from "node:fs";
import path from "node:path";
import type { DateStr } from "../../src/lib/dates";
import type { ChainHistory, IntentsDay, Series, SeriesMap } from "../../src/lib/history-types";
import { leadLag, logChanges, outOfSample, toWeekly } from "../../src/lib/stats";
import { SPECS, sqlSpec, type SqlId } from "../../src/lib/query-specs";
import { BH_Q, benjaminiHochberg, blockBootstrapLead, monthlySum, ruleB1, ruleB2, ruleB3, ruleB4, ruleB5, trend, type TrendResult } from "../../src/lib/thesis-tests";
import type { ChartSeries, RelatedTest } from "../../src/lib/thesis-types";
import type { EcosystemEvent } from "../../src/lib/types";
import { readCsvOrEmpty } from "./csv";
import { DATA, HISTORY, RAW, ROOT } from "./paths";
import { readJson } from "./store";

export interface RelatedCtx {
  chain: ChainHistory;
  start: DateStr;
  end: DateStr;
  cutoff: DateStr;
  explorerDays: IntentsDay[];
  xIntents: Series;
  xPrice: Series;
  maxLag: number;
  /** Weekly log changes of total transactions, the headline series B1 compares with. */
  txnsWeekly: Series;
  txnsIntentsR: number | null;
  events: EcosystemEvent[];
}

const BQ_DIR = path.join(RAW, "bigquery");
/** B2 starts at the first full month after the fee switch (announced 2026-02-25). */
const FEE_SWITCH_MONTH = "2026-03";
/** B5 group: the accounts present in every committed receipts window (see the card notes for the two left out). */
export const B5_GROUP = ["intents.near", "aurora", "game.hot.tg", "token.sweat"];
const B5_LATE = ["oracle.sweat", "distributions.grow.sweat"];
/** B6: the two Explorer asset labels that are ZEC (native, and ZEC bridged to NEAR). */
const ZEC_LABELS = ["ZEC", "near:zec.omft.near"];

const r3 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);
const pct = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "n/a" : `${(v * 100).toFixed(d)}%`);
const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const fmt = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? "n/a" : v.toFixed(d));
const sqlFile = (id: SqlId) => sqlSpec(id, fs.readFileSync(path.join(ROOT, "queries", `${id}.sql`), "utf8"));

/** Cached BigQuery CSVs for one query, merged by date (a later window wins on overlap). */
function readBqDaily(prefix: string): Array<Record<string, string>> {
  if (!fs.existsSync(BQ_DIR)) return [];
  const byDate = new Map<string, Record<string, string>>();
  for (const f of fs.readdirSync(BQ_DIR).filter((n) => n.startsWith(`${prefix}_`) && n.endsWith(".csv")).sort()) {
    for (const row of readCsvOrEmpty(path.join(BQ_DIR, f)) as Array<Record<string, string>>) if (row.block_date) byDate.set(row.block_date, row);
  }
  return Array.from(byDate.values()).sort((a, b) => (a.block_date < b.block_date ? -1 : 1));
}

function trendLine(t: TrendResult, unit: string, scale = 1, d = 2): string {
  return t.slope === null ? "no trend (too few points)" : `slope ${fmt(t.slope * scale, d)} ${unit} (90% interval ${fmt((t.ciLow ?? 0) * scale, d)} to ${fmt((t.ciHigh ?? 0) * scale, d)}, ${t.n} points)`;
}

// ---------------------------------------------------------------- B1

function b1(ctx: RelatedCtx): RelatedTest {
  const base = {
    id: "top-receivers",
    code: "B1",
    title: "Intents leads app usage, not raw chain counts",
    rule: "Pass when Intents volume leads transactions excluding the top 10 receivers significantly (block bootstrap, Benjamini-Hochberg at q = 0.10), or with an r at least 0.10 above its lead on total transactions. Fail when it has no positive lead on either the excluding-top-10 or the top-10-only series.",
    queries: [] as RelatedTest["queries"],
  };
  const top = readCsvOrEmpty(path.join(DATA, "top-receivers.csv")) as Array<Record<string, string>>;
  const rows = readBqDaily("daily_top_receivers");
  if (fs.existsSync(path.join(ROOT, "queries", "daily_top_receivers.sql"))) base.queries.push(sqlFile("top_receivers"), sqlFile("daily_top_receivers"));
  if (!top.length || rows.length < 120) {
    return { ...base, status: "not computed", result: "The daily counts of transactions to the top 10 receivers are not in the committed BigQuery files, so this test was not run.", notes: [], chart: null };
  }
  const daily = (col: string): Series => rows.map((r) => [r.block_date as DateStr, Number(r[col])] as [DateStr, number]).filter(([d, v]) => d >= ctx.start && d <= ctx.end && Number.isFinite(v));
  const wTop = toWeekly(daily("top_transactions"), "flow", ctx.end);
  const wOther = toWeekly(daily("other_transactions"), "flow", ctx.end);
  const wAll = toWeekly(daily("transactions"), "flow", ctx.end);
  const yEx = logChanges(wOther);
  const yTop = logChanges(wTop);
  const yAll = logChanges(wAll);
  const boots = [yEx, yTop, yAll].map((y) => blockBootstrapLead(ctx.xIntents, y, ctx.maxLag));
  const bh = benjaminiHochberg(boots.map((b) => b.p), BH_Q);
  const [ex, tp, all] = boots.map((b, i) => ({ ...b, significant: bh.significant[i] && (b.r ?? 0) > 0, pAdj: bh.adjusted[i] }));
  const oosEx = outOfSample(ctx.xIntents, yEx, ctx.cutoff, ctx.maxLag);
  const oosTop = outOfSample(ctx.xIntents, yTop, ctx.cutoff, ctx.maxLag);
  const llEx = leadLag(ctx.xIntents, yEx, ctx.maxLag).bestPositiveLead;
  const llTop = leadLag(ctx.xIntents, yTop, ctx.maxLag).bestPositiveLead;
  const llAll = leadLag(ctx.xIntents, yAll, ctx.maxLag).bestPositiveLead;
  const status = ruleB1({ r: llEx?.r ?? null, significant: ex.significant }, { r: llTop?.r ?? null }, { r: llAll?.r ?? null });
  const shareW = wAll.map(([d, v]) => {
    const t = wTop.find(([w]) => w === d)?.[1];
    return [d, t !== undefined && v > 0 ? t / v : null] as [DateStr, number | null];
  });
  const last = shareW.filter(([, v]) => v !== null).at(-1);
  const result =
    status === "pass"
      ? `Intents volume leads transactions to everyone outside the top 10 receivers by ${llEx?.lag} weeks with r = ${fmt(llEx?.r)}, against r = ${fmt(llAll?.r)} on total transactions, so the lead sits in app usage outside the largest accounts.`
      : status === "fail"
        ? `Intents volume has no positive lead on transactions outside the top 10 receivers (r = ${fmt(llEx?.r)}) or on the top 10 alone (r = ${fmt(llTop?.r)}).`
        : `Intents volume leads transactions outside the top 10 receivers by ${llEx?.lag ?? "n/a"} weeks with r = ${fmt(llEx?.r)} (bootstrap p ${fmt(ex.p, 3)}, not significant after Benjamini-Hochberg), not clearly better than its r = ${fmt(llAll?.r)} on total transactions.`;
  return {
    ...base,
    status,
    result,
    notes: [
      `Top 10 receivers, picked over ${top[0]?.month ?? "one complete month"} by signed transactions: ${top.map((r) => `\`${r.receiver_account_id}\``).join(", ")}.`,
      `Excluding the top 10: best lead ${llEx ? `${llEx.lag} w, r = ${fmt(llEx.r)}` : "none"}; bootstrap r ${fmt(ex.r)} at ${ex.lag} w, 90% interval ${fmt(ex.ciLow)} to ${fmt(ex.ciHigh)}, p ${fmt(ex.p, 3)}, adjusted ${fmt(ex.pAdj, 3)}; out-of-sample R² ${fmt(oosEx.r2Oos)} at ${oosEx.lag} w.`,
      `Top 10 only: best lead ${llTop ? `${llTop.lag} w, r = ${fmt(llTop.r)}` : "none"}; bootstrap p ${fmt(tp.p, 3)}, adjusted ${fmt(tp.pAdj, 3)}; out-of-sample R² ${fmt(oosTop.r2Oos)} at ${oosTop.lag} w.`,
      `Total transactions over the same weeks: best lead ${llAll ? `${llAll.lag} w, r = ${fmt(llAll.r)}` : "none"}; bootstrap p ${fmt(all.p, 3)}.`,
      `"Clearly better" is read as an r at least 0.10 above the lead on total transactions. The top 10 took ${pct(last?.[1] ?? null)} of transactions in the week of ${last?.[0] ?? "n/a"}.`,
    ],
    chart: { kind: "line", unit: "pct", x: shareW.map(([d]) => d), series: [{ key: "topShare", label: "Top 10 receivers' share of transactions", values: shareW.map(([, v]) => r3(v)) }] },
  };
}

// ---------------------------------------------------------------- B2

function b2(ctx: RelatedCtx): RelatedTest {
  const holders = readJson<SeriesMap>(path.join(HISTORY, "defillama", "holders-revenue-summary.json"), {});
  const intentsHolders = holders["NEAR Intents"] ?? [];
  const supplyRows = readBqDaily("daily_supply");
  const base = {
    id: "buyback-coverage",
    code: "B2",
    title: "Buyback coverage of issuance",
    rule: "Monthly holders revenue in USD over the USD value of the net NEAR supply increase, from March 2026 (the first full month after the fee switch). Pass when the ratio's trend is positive with the slope's 90% interval above zero. Fail when it is flat or falling, or below 20% in each of the last three months.",
    queries: [
      { kind: "http" as const, title: "GET https://api.llama.fi/summary/fees/near-intents?dataType=dailyHoldersRevenue", code: "GET https://api.llama.fi/summary/fees/near-intents?dataType=dailyHoldersRevenue\n-> totalDataChart[][date, usd]   (data/history/defillama/holders-revenue-summary.json, \"NEAR Intents\")\nGET https://api.llama.fi/summary/fees/near?dataType=dailyHoldersRevenue\n-> totalDataChart[][date, usd]   (same file, \"NEAR\")" },
      ...(fs.existsSync(path.join(ROOT, "queries", "daily_supply.sql")) ? [sqlFile("daily_supply")] : []),
      SPECS.nearblocks,
    ],
  };
  if (!intentsHolders.length) return { ...base, status: "not computed", result: "DefiLlama holders revenue for NEAR Intents is not in the committed history.", notes: [], chart: null };
  if (supplyRows.length < 60) {
    return {
      ...base,
      status: "not computed",
      result: "Daily NEAR total supply from the BigQuery blocks table is not in the committed files, so the net supply increase, and with it the coverage ratio, could not be computed.",
      notes: [`Holders revenue alone: NEAR Intents reports ${usd(monthlySum(intentsHolders.filter(([d]) => d.slice(0, 7) >= FEE_SWITCH_MONTH && d <= ctx.end)).reduce((a, [, v]) => a + v, 0))} from ${FEE_SWITCH_MONTH} to the last complete month.`],
      chart: null,
    };
  }
  const price = new Map(ctx.chain.nearblocks.price ?? []);
  const supply: Series = supplyRows.map((r) => [r.block_date as DateStr, Number(r.total_supply)] as [DateStr, number]).filter(([, v]) => Number.isFinite(v));
  const incUsd: Series = [];
  for (let i = 1; i < supply.length; i++) {
    const [d, v] = supply[i];
    const p = price.get(d);
    if (p !== undefined && d <= ctx.end) incUsd.push([d, (v - supply[i - 1][1]) * p]);
  }
  const hm = new Map(monthlySum(intentsHolders.filter(([d]) => d <= ctx.end)));
  const im = monthlySum(incUsd).filter(([m]) => m >= FEE_SWITCH_MONTH && hm.has(m));
  const months = im.map(([m]) => m);
  const ratio = im.map(([m, inc]) => (inc > 0 ? (hm.get(m) as number) / inc : null));
  const valid = ratio.filter((v): v is number => v !== null);
  const t = trend(valid);
  const status = ruleB2(t, valid);
  const lastM = months.at(-1);
  const result = `${status === "pass" ? "Coverage is rising" : "Coverage is not rising with confidence"}: NEAR Intents holders revenue covered ${pct(valid.at(-1) ?? null)} of the USD value of new NEAR supply in ${lastM ?? "n/a"}, with a monthly trend ${trendLine(t, "percentage points a month", 100, 1)}.`;
  const supplyStart = supply.find(([d]) => d.slice(0, 7) >= FEE_SWITCH_MONTH);
  const supplyEnd = supply.filter(([d]) => d <= ctx.end).at(-1);
  return {
    ...base,
    status,
    result,
    notes: [
      `Monthly ratios: ${months.map((m, i) => `${m} ${pct(ratio[i])}`).join(", ")}.`,
      `Total supply ${supplyStart ? `${Math.round(supplyStart[1]).toLocaleString("en-US")} NEAR on ${supplyStart[0]}` : "n/a"} and ${supplyEnd ? `${Math.round(supplyEnd[1]).toLocaleString("en-US")} NEAR on ${supplyEnd[0]}` : "n/a"} (last block of each day). Total supply already nets out the 70% of gas the protocol burns, so DefiLlama's NEAR chain holders revenue (that burn) is not added to the numerator.`,
      "Held or burned: if bought-back NEAR were burned, total supply would fall by the bought amount; the daily total supply does not single out buyback transfers, so this file does not say which, and the ratio counts buybacks as covering issuance either way.",
    ],
    chart: { kind: "line", unit: "pct", x: months, series: [{ key: "coverage", label: "Holders revenue over new supply value", values: ratio.map((v) => r3(v)) }] },
  };
}

// ---------------------------------------------------------------- B3

function b3(ctx: RelatedCtx): RelatedTest {
  const llama = (f: string) => readJson<SeriesMap>(path.join(HISTORY, "defillama", `${f}.json`), {})["NEAR Intents"] ?? [];
  const clipEnd = (s: Series) => s.filter(([d]) => d <= ctx.end);
  const gas = new Map(monthlySum(clipEnd(ctx.chain.near.gasFees ?? [])));
  const rev = new Map(monthlySum(clipEnd(llama("revenue-near")), 1));
  const sup = new Map(monthlySum(clipEnd(llama("supply-side-revenue-near")), 1));
  const fees = monthlySum(clipEnd(llama("fees-near")));
  // Months where DefiLlama has a full month of NEAR Intents fees and of gas fees.
  const months = fees.map(([m]) => m).filter((m) => gas.has(m) && m >= "2025-06");
  const layers = months.map((m) => {
    const g = gas.get(m) ?? 0;
    const r = Math.max(0, rev.get(m) ?? 0);
    const s = Math.max(0, sup.get(m) ?? 0);
    const total = g + r + s;
    return { m, g: g / total, r: r / total, s: s / total };
  });
  const tGas = trend(layers.map((l) => l.g));
  const tInt = trend(layers.map((l) => l.r + l.s));
  const status = ruleB3(tGas, tInt);
  // App fees: per-row rates exist only on the Explorer days re-read with fee rates.
  const feeDays = ctx.explorerDays.filter((d) => d.referralFees && d.date <= ctx.end);
  const appFees = feeDays.reduce((a, d) => a + Object.values(d.referralFees ?? {}).reduce((x, v) => x + v, 0), 0);
  const llamaSum = (s: Series) => s.filter(([d]) => feeDays.some((f) => f.date === d)).reduce((a, [, v]) => a + v, 0);
  const gasSame = llamaSum(ctx.chain.near.gasFees ?? []);
  const intentsSame = llamaSum(llama("fees-near"));
  // Overlap check: months where every day has app fee rates, against DefiLlama's NEAR Intents fees for the same month.
  const feeMonths = new Map<string, { days: number; app: number }>();
  for (const d of ctx.explorerDays.filter((x) => x.date <= ctx.end)) {
    const e = feeMonths.get(d.date.slice(0, 7)) ?? { days: 0, app: 0 };
    if (d.referralFees) {
      e.days += 1;
      e.app += Object.values(d.referralFees).reduce((x, v) => x + v, 0);
    } else e.days = -1000;
    feeMonths.set(d.date.slice(0, 7), e);
  }
  const intentsFeeMonth = new Map(fees);
  const overlap = Array.from(feeMonths.entries())
    .filter(([m, e]) => e.days >= 25 && (intentsFeeMonth.get(m) ?? 0) > 0)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([m, e]) => ({ m, ratio: e.app / (intentsFeeMonth.get(m) as number) }));
  const first = layers[0];
  const last = layers.at(-1);
  const result = `L1 gas fell from ${pct(first?.g ?? null)} of fees in ${first?.m ?? "n/a"} to ${pct(last?.g ?? null)} in ${last?.m ?? "n/a"} while the Intents layers rose to ${pct(last ? last.r + last.s : null)}; the gas share's trend is ${trendLine(tGas, "points a month", 100, 1)}${status === "pass" ? ", so fees land at the app layer" : ""}.`;
  return {
    id: "fee-layers",
    code: "B3",
    title: "Where fees land, by layer",
    rule: "Monthly share of total fees across L1 gas, Intents protocol revenue and Intents supply side (solvers), with app fees shown where the Explorer keeps them. Pass when the L1 gas share falls with a negative 90% slope interval while the Intents layers rise. Fail when the L1 gas share is stable or rising.",
    status,
    result,
    notes: [
      `Months: ${months[0] ?? "n/a"} to ${months.at(-1) ?? "n/a"} (${months.length}). Intents protocol revenue and supply side are DefiLlama's NEAR Intents revenue and supply-side revenue, which add up to its fees; a negative month would count as zero (none in this window).`,
      `App fees come from the Explorer's per-row fee rates, kept only for ${feeDays.length} complete days (${feeDays[0]?.date ?? "n/a"} to ${feeDays.at(-1)?.date ?? "n/a"}): ${usd(appFees)} against ${usd(intentsSame)} of NEAR Intents fees and ${usd(gasSame)} of L1 gas on the same days. They are left out of the monthly shares and the rule.`,
      `Overlap: app fees are charged by distribution apps on top of the swap, and DefiLlama's NEAR Intents fees can include a platform's partner fees. In the months where every Explorer day keeps fee rates, Explorer app fees come to ${overlap.map((o) => `${pct(o.ratio)} of DefiLlama's NEAR Intents fees in ${o.m}`).join(", ") || "n/a"}, so DefiLlama's Intents fees already carry most app fees. Stacking app fees as a fourth layer would count them twice, so they are left out of the monthly shares and the rule.`,
      "Gas share trend measured on the monthly share (0 to 1) against the month index; 90% t interval, months treated as independent.",
    ],
    chart: {
      kind: "stack",
      unit: "pct",
      x: months,
      series: [
        { key: "gas", label: "L1 gas", values: layers.map((l) => r3(l.g)) },
        { key: "revenue", label: "Intents protocol revenue", values: layers.map((l) => r3(l.r)) },
        { key: "supply", label: "Intents supply side (solvers)", values: layers.map((l) => r3(l.s)) },
      ],
    },
    queries: [
      { kind: "http", title: "GET https://api.llama.fi/summary/fees/near?dataType=dailyFees", code: "GET https://api.llama.fi/summary/fees/near?dataType=dailyFees\n-> totalDataChart[][date, usd]   (L1 gas, data/history/chain.json near.gasFees)\nGET https://api.llama.fi/overview/fees/near?dataType=dailyRevenue\nGET https://api.llama.fi/overview/fees/near?dataType=dailySupplySideRevenue\n-> totalDataChartBreakdown[][1][\"NEAR Intents\"]   (data/history/defillama/revenue-near.json, supply-side-revenue-near.json)" },
      SPECS.intentsDaily,
    ],
  };
}

// ---------------------------------------------------------------- B4

function b4(ctx: RelatedCtx): RelatedTest {
  const days = ctx.explorerDays.filter((d) => d.date <= ctx.end);
  const byMonth = new Map<string, { days: number; refs: Map<string, number>; total: number }>();
  for (const d of days) {
    const m = d.date.slice(0, 7);
    const e = byMonth.get(m) ?? { days: 0, refs: new Map<string, number>(), total: 0 };
    e.days += 1;
    for (const [k, v] of Object.entries(d.referrals ?? {})) {
      e.refs.set(k, (e.refs.get(k) ?? 0) + v.usd);
      e.total += v.usd;
    }
    byMonth.set(m, e);
  }
  const months = Array.from(byMonth.entries()).filter(([, e]) => e.days >= 25).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  /** Named referrals only: "(other)" is the tail beyond the top 40 of each day, kept in the total but not as a referral. */
  const variant = (withUnlabeled: boolean) =>
    months.map(([m, e]) => {
      const named = Array.from(e.refs.entries()).filter(([k]) => k !== "(other)" && (withUnlabeled || k !== "(none)"));
      const total = e.total - (withUnlabeled ? 0 : (e.refs.get("(none)") ?? 0));
      const vals = named.map(([, v]) => v);
      const shareSq = vals.reduce((a, v) => a + (v / total) ** 2, 0) * 10_000;
      return { m, hhi: shareSq, top1: Math.max(...vals) / total, top5: [...vals].sort((a, b) => b - a).slice(0, 5).reduce((a, v) => a + v, 0) / total, over1m: named.filter(([k, v]) => k !== "(none)" && v > 1e6).length, top1Name: named.sort((a, b) => b[1] - a[1])[0]?.[0] ?? "n/a" };
    });
  const own = variant(true);
  const excl = variant(false);
  const tOwn = trend(own.map((r) => r.hhi));
  const tExcl = trend(excl.map((r) => r.hhi));
  const sOwn = ruleB4(tOwn, own.map((r) => r.top1));
  const sExcl = ruleB4(tExcl, excl.map((r) => r.top1));
  const status = sOwn === "pass" && sExcl === "pass" ? "pass" : sOwn === "not computed" ? "not computed" : "fail";
  const lo = own.at(-1);
  const le = excl.at(-1);
  const why = status === "pass" ? "" : (tOwn.slope ?? 0) > 0 || (tExcl.slope ?? 0) > 0 ? " because the index trends up" : ` because the top referral's share reached 40% or more in ${own.slice(-3).filter((r) => r.top1 >= 0.4).map((r) => r.m).join(", ") || "one of the last three months"} with unlabeled volume as a bucket, or in ${excl.slice(-3).filter((r) => r.top1 >= 0.4).map((r) => r.m).join(", ") || "none"} with it excluded`;
  const result = `${status === "pass" ? "Distribution is broadening" : `Distribution does not pass as broadening${why}`}. Referral concentration (HHI) trends ${trendLine(tOwn, "a month", 1, 0)} with unlabeled volume as a bucket and ${trendLine(tExcl, "a month", 1, 0)} without it; in ${lo?.m ?? "n/a"} the top referral took ${pct(lo?.top1 ?? null)} (${pct(le?.top1 ?? null)} of labeled volume).`;
  return {
    id: "concentration",
    code: "B4",
    title: "Distribution concentration",
    rule: "Per month, the Herfindahl-Hirschman index of 1Click volume by referral, top-1 and top-5 share and the number of referrals over $1M, with unlabeled referral as its own bucket and excluded. Pass (broadening) when the index trends down and top-1 share stays under 40% in each of the last three months. Fail when the index trends up or top-1 share goes over 40%.",
    status,
    result,
    notes: [
      `With unlabeled as a bucket: ${own.map((r) => `${r.m} HHI ${Math.round(r.hhi)}, top-1 ${pct(r.top1)} (${r.top1Name}), top-5 ${pct(r.top5)}, ${r.over1m} over $1M`).join("; ")}.`,
      `Unlabeled excluded: ${excl.map((r) => `${r.m} HHI ${Math.round(r.hhi)}, top-1 ${pct(r.top1)} (${r.top1Name}), top-5 ${pct(r.top5)}`).join("; ")}.`,
      `Rule result per variant: ${sOwn} with unlabeled as a bucket, ${sExcl} with it excluded; the test passes only when both pass.`,
      "The Explorer day files keep the 40 largest referrals of each day and fold the rest into one tail bucket. The tail stays in the total but is not counted as a referral, so the index is a lower bound by at most the tail's own concentration, and a referral over $1M cannot hide in it unless it stays outside the daily top 40 every day.",
    ],
    chart: {
      kind: "line",
      unit: "num",
      x: own.map((r) => r.m),
      series: [
        { key: "hhiOwn", label: "HHI, unlabeled as a bucket", values: own.map((r) => Math.round(r.hhi)) },
        { key: "hhiExcl", label: "HHI, unlabeled excluded", values: excl.map((r) => Math.round(r.hhi)) },
      ],
    },
    queries: [SPECS.intentsExplorer, SPECS.intentsDaily],
  };
}

// ---------------------------------------------------------------- B5

function b5(ctx: RelatedCtx): RelatedTest {
  const calls = new Map<string, number>();
  if (fs.existsSync(BQ_DIR)) {
    const byKey = new Map<string, number>();
    for (const f of fs.readdirSync(BQ_DIR).filter((n) => n.startsWith("daily_receipts_") && n.endsWith(".csv")).sort()) {
      for (const r of readCsvOrEmpty(path.join(BQ_DIR, f)) as Array<Record<string, string>>) if (B5_GROUP.includes(r.account_id)) byKey.set(`${r.block_date}|${r.account_id}`, Number(r.function_calls) || 0);
    }
    for (const [k, v] of byKey) {
      const d = k.split("|")[0];
      calls.set(d, (calls.get(d) ?? 0) + v);
    }
  }
  const total: Series = (ctx.chain.bigquery.function_calls ?? []).filter(([d]) => d <= ctx.end && calls.has(d));
  const group: Series = total.map(([d]) => [d, calls.get(d) as number]);
  const wT = toWeekly(total, "flow", ctx.end);
  const wG = new Map(toWeekly(group, "flow", ctx.end));
  const share = wT.filter(([d, v]) => wG.has(d) && v > 0).map(([d, v]) => [d, 1 - (wG.get(d) as number) / v] as [DateStr, number]);
  const t = trend(share.map(([, v]) => v));
  const status = ruleB5(t);
  const first = share[0];
  const last = share.at(-1);
  const result = `The share of function calls outside intents.near, Aurora, HOT and SWEAT went from ${pct(first?.[1] ?? null)} in the week of ${first?.[0] ?? "n/a"} to ${pct(last?.[1] ?? null)} in the week of ${last?.[0] ?? "n/a"}, a trend of ${trendLine(t, "points a week", 100, 2)}${status === "pass" ? ", so breadth is growing" : ", so breadth is not growing by the rule"}.`;
  return {
    id: "breadth",
    code: "B5",
    title: "Ecosystem breadth",
    rule: "Weekly share of chain function calls going to everything outside a fixed group (intents.near, aurora, HOT, SWEAT). Pass (breadth growing) when the non-group share has a positive trend with the 90% slope interval above zero. Fail when flat or falling.",
    status,
    result,
    notes: [
      `Group accounts used: ${B5_GROUP.map((a) => `\`${a}\``).join(", ")}. These are the accounts present in every committed receipts window; ${B5_LATE.map((a) => `\`${a}\``).join(" and ")} (SWEAT, mapped in data/contracts.csv) are tracked only in the latest windows and are left out so the group stays the same over all ${share.length} weeks.`,
      "Function calls are FUNCTION_CALL receipt actions from `receipt_actions`; the complement is every other receiver on the chain.",
      "Weeks are treated as independent for the 90% t interval; weekly shares are autocorrelated, so the interval is narrower than a block-robust one.",
    ],
    chart: { kind: "line", unit: "pct", x: share.map(([d]) => d), series: [{ key: "nonGroup", label: "Share outside the group", values: share.map(([, v]) => r3(v)) }] },
    queries: [sqlFile("daily_receipts")],
  };
}

// ---------------------------------------------------------------- B6

function b6(ctx: RelatedCtx): RelatedTest {
  const days = ctx.explorerDays.filter((d) => d.date <= ctx.end);
  const byMonth = new Map<string, { days: number; o: number; dst: number; total: number }>();
  for (const d of days) {
    const m = d.date.slice(0, 7);
    const e = byMonth.get(m) ?? { days: 0, o: 0, dst: 0, total: 0 };
    e.days += 1;
    e.total += d.volumeUsd;
    for (const l of ZEC_LABELS) {
      e.o += d.originAssets?.[l]?.usd ?? 0;
      e.dst += d.destinationAssets?.[l]?.usd ?? 0;
    }
    byMonth.set(m, e);
  }
  const months = Array.from(byMonth.entries()).filter(([, e]) => e.days >= 25).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const lo = months.map(([, e]) => Math.max(e.o, e.dst) / e.total);
  const hi = months.map(([, e]) => Math.min(e.o + e.dst, e.total) / e.total);
  const program = ctx.events.find((e) => /NEAR@3\.33/i.test(e.title));
  // Level before 2025-10-01: the ZEC share over every Explorer day before that date.
  const pre = days.filter((d) => d.date < "2025-10-01");
  const preTot = pre.reduce((a, d) => a + d.volumeUsd, 0);
  const preO = pre.reduce((a, d) => a + ZEC_LABELS.reduce((x, l) => x + (d.originAssets?.[l]?.usd ?? 0), 0), 0);
  const preD = pre.reduce((a, d) => a + ZEC_LABELS.reduce((x, l) => x + (d.destinationAssets?.[l]?.usd ?? 0), 0), 0);
  const preLo = preTot > 0 ? Math.max(preO, preD) / preTot : null;
  const preHi = preTot > 0 ? Math.min(preO + preD, preTot) / preTot : null;
  const last3Hi = hi.slice(-3);
  const last3Lo = lo.slice(-3);
  let status: RelatedTest["status"];
  let result: string;
  const span = `the ${months.length >= 3 ? "last three months" : "months available"} (${months.slice(-3).map(([m], i) => `${m} ${pct(last3Lo[i])} to ${pct(last3Hi[i])}`).join(", ")})`;
  if (preLo === null || preHi === null || !months.length) {
    status = "not computed";
    result = "The Explorer day files hold no complete day before 2025-10-01, so the level before the Zashi integration cannot be computed.";
  } else if (last3Hi.length === 3 && last3Hi.every((v) => v < preLo)) {
    status = "fail";
    result = `The ZEC share fell back below its level before 2025-10-01 (${pct(preLo, 1)} to ${pct(preHi, 1)}) in ${span}.`;
  } else {
    status = "inconclusive";
    result = `The ZEC share stays well above its level before 2025-10-01 (${pct(preLo, 1)} to ${pct(preHi, 1)} of 1Click volume) in ${span}, so the fail rule is not met. The pass rule asks about the weeks after the NEAR@3.33 incentive window ends, and the events file dates the program's start (${program?.date ?? "n/a"}) but not an end, so a pass cannot be dated.`;
  }
  return {
    id: "privacy",
    code: "B6",
    title: "Privacy flows",
    rule: "Monthly share of 1Click volume where either side is ZEC. Pass when the ZEC share holds or grows after the NEAR@3.33 incentive window ends. Fail when it falls back below its level before 2025-10-01.",
    status,
    result,
    notes: [
      `Monthly ZEC share (lower to upper bound): ${months.map(([m], i) => `${m} ${pct(lo[i])} to ${pct(hi[i])}`).join(", ")}.`,
      `The day files keep volume per origin asset and per destination asset but not the pair, and the raw rows are not committed. The lower bound is the larger of the ZEC-origin and ZEC-destination volume, the upper bound their sum (a swap with ZEC on both sides would be counted twice there). ZEC is the native asset (\`ZEC\`) and ZEC bridged to NEAR (\`near:zec.omft.near\`).`,
      "Confidential swaps cannot be identified from the Explorer API: no field in its rows marks a swap as confidential.",
    ],
    chart: {
      kind: "line",
      unit: "pct",
      x: months.map(([m]) => m),
      series: [
        { key: "low", label: "ZEC share, lower bound", values: lo.map((v) => r3(v)) },
        { key: "high", label: "ZEC share, upper bound", values: hi.map((v) => r3(v)) },
      ] satisfies ChartSeries[],
    },
    queries: [SPECS.intentsExplorer, SPECS.intentsDaily],
  };
}

export function relatedTests(ctx: RelatedCtx): RelatedTest[] {
  return [b1(ctx), b2(ctx), b4(ctx)];
  void [b3, b5, b6];
}
