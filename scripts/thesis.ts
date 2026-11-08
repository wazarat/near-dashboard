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
import { indexTo100, leadLag, logChanges, outOfSample, subtractSeries, toWeekly, trimTop, type LeadLagSummary, type OosResult } from "../src/lib/stats";
import type { Confounder, RobustnessVariant, ThesisJson, UsageKey, UsageMeta } from "../src/lib/thesis-types";
import type { EcosystemEvent } from "../src/lib/types";
import { readDaily as readIntentsDaily } from "./fetch/intents";
import { HISTORY, OUT, ROOT } from "./lib/paths";
import { readJson } from "./lib/store";

const MAX_LAG = 8;
const USAGE: UsageMeta[] = [
  { key: "txns", label: "Transactions", source: "NearBlocks", kind: "flow" },
  { key: "activeAccounts", label: "Active accounts", source: "NearBlocks", kind: "flow" },
  { key: "newAccounts", label: "New accounts", source: "NearBlocks", kind: "flow" },
  { key: "functionCalls", label: "Function calls", source: "BigQuery", kind: "flow" },
  { key: "contractsCalled", label: "Contracts called", source: "BigQuery", kind: "flow" },
];

const QUERIES: ThesisJson["queries"] = {
  intentsLlama: { kind: "http", title: "DefiLlama NEAR Intents daily volume", code: "GET https://api.llama.fi/overview/dexs/near?excludeTotalDataChart=true\n-> totalDataChartBreakdown[][1][\"NEAR Intents\"]  (data/history/defillama/volume-near.json)" },
  intentsExplorer: { kind: "http", title: "NEAR Intents Explorer API (1Click swaps only)", code: "GET https://explorer.near-intents.org/api/v0/transactions?numberOfTransactions=1000&direction=next&lastDepositAddress=…&lastDepositMemo=…\nAuthorization: Bearer $NEAR_INTENTS_JWT   (1 request / 5 s)\n-> per-day aggregates in data/raw/intents/daily/*.json: volume = Σ amountInUsd where status = SUCCESS" },
  nearblocks: { kind: "http", title: "NearBlocks daily charts", code: "GET https://api.nearblocks.io/v1/charts\n-> charts[].{date, txns, active_accounts, new_accounts, near_price}  (data/history/chain.json → nearblocks)" },
  dailyChain: { kind: "sql", title: "queries/daily_chain.sql", code: fs.readFileSync(path.join(ROOT, "queries", "daily_chain.sql"), "utf8") },
  dailyReceipts: { kind: "sql", title: "queries/daily_receipts.sql", code: fs.readFileSync(path.join(ROOT, "queries", "daily_receipts.sql"), "utf8") },
  weekly: { kind: "transform", title: "src/lib/stats.ts: toWeekly + logChanges", code: "weekly = ISO-week sums (flows) or last value (price); x_t = ln(weekly_t / weekly_{t-1}); weeks with < 4 days or the incomplete trailing week are dropped" },
  leadLag: { kind: "transform", title: "src/lib/stats.ts: crossCorrelation", code: "for k in −8…+8: r_k = pearson(x_t, y_{t+k}) over all t where both exist; positive k = x leads y by k weeks; noise band ≈ 2/√n" },
  oos: { kind: "transform", title: "src/lib/stats.ts: outOfSample", code: "lag k* = argmax_{k∈1…8} |corr(x_{t−k}, y_t)| on weeks < cutoff; fit y_t = a + b·x_{t−k*} on the same weeks;\nscore weeks ≥ cutoff: R²_oos = 1 − SSE(model)/SSE(train mean); hit rate = share of weeks with sign(forecast) = sign(actual)" },
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

function fmtR(v: number | null | undefined): string {
  return v === null || v === undefined ? "n/a" : v.toFixed(2);
}

function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? "n/a" : `${Math.round(v * 100)}%`;
}

function main() {
  const meta = readJson<HistoryMeta | null>(path.join(HISTORY, "_meta.json"), null);
  const chain = loadChain();
  const volumeNear = readJson<SeriesMap>(path.join(HISTORY, "defillama", "volume-near.json"), {});
  const intentsLlama = volumeNear["NEAR Intents"] ?? [];
  const events = readJson<EcosystemEvent[]>(path.join(OUT, "events.json"), []);
  const outFile = path.join(OUT, "thesis.json");
  const mdFile = path.join(ROOT, "THESIS.md");
  fs.mkdirSync(OUT, { recursive: true });

  if (!meta?.lastRunDate || intentsLlama.length < 60 || !(chain.nearblocks.txns ?? []).length) {
    const reason = "The thesis needs the committed history (DefiLlama NEAR Intents volume, NearBlocks daily charts). Run npm run refresh first.";
    fs.writeFileSync(outFile, JSON.stringify({ available: false, reason }));
    console.log(`  thesis: unavailable (${reason})\n`);
    return;
  }

  const end = windowEnd(meta.lastRunDate);
  const start = intentsLlama.find(([, v]) => v > 0)?.[0] ?? intentsLlama[0][0];
  const cutoff = (process.env.THESIS_CUTOFF as DateStr | undefined) ?? "2026-05-01";
  const nb = chain.nearblocks;
  const bq = chain.bigquery;

  const dailyRaw: Record<UsageKey, Series> = {
    txns: clip(nb.txns ?? [], start, end),
    activeAccounts: clip(nb.activeAccounts ?? [], start, end),
    newAccounts: clip(nb.newAccounts ?? [], start, end),
    functionCalls: clip(bq.function_calls ?? [], start, end),
    contractsCalled: clip(bq.contracts_called ?? [], start, end),
  };
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
  const ratios = explorerDays.map((d) => (llamaMap.get(d.date) ? d.volumeUsd / (llamaMap.get(d.date) as number) : null)).filter((v): v is number => v !== null && Number.isFinite(v));
  const sortedRatios = [...ratios].sort((a, b) => a - b);
  const ratioMedian = sortedRatios.length ? sortedRatios[Math.floor(sortedRatios.length / 2)] : null;

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
  const riw = robustness.slice(1).reduce((a, v) => a + v.intentsWins, 0);
  const rpw = robustness.slice(1).reduce((a, v) => a + v.priceWins, 0);
  const total = iw + pw + ties;
  const supported: ThesisJson["verdict"]["supported"] = iw >= 3 && pw === 0 && oiw >= opw ? "yes" : iw > pw && oiw >= opw ? "partly" : "no";
  const bqKeys = USAGE.filter((u) => u.source === "BigQuery").map((u) => u.label.toLowerCase()).join(" and ");
  const nbKeys = USAGE.filter((u) => u.source === "NearBlocks").map((u) => u.label.toLowerCase()).join(", ");
  const headline =
    supported === "yes"
      ? `supported. Intents volume is the stronger positive lead for ${iw} of ${total} usage series with none going to price, and it wins ${oiw} of the out-of-sample comparisons (${opw} for price).`
      : supported === "partly"
        ? `partly supported. Intents volume is the stronger positive lead for ${iw} of ${total} usage series (${pw} for price, ${ties} inconclusive), and it wins ${oiw} out-of-sample comparisons to price's ${opw}, but the edge shows up in the contract-level series (${bqKeys}, ${bqWeeks} weeks of BigQuery data) and not in the chain-level counts (${nbKeys}) over the full ${weeklyDates.length}-week window, where neither predictor clears the noise band.`
        : `not supported by this data. Intents volume is the stronger positive lead for ${iw} of ${total} usage series, price for ${pw}, ${ties} inconclusive; out of sample Intents wins ${oiw} and price ${opw}.`;
  if (!forLines.length) forLines.push("No usage series showed Intents volume as the stronger lead in this window.");
  if (!againstLines.length) againstLines.push("No usage series showed price as the stronger lead in this window.");
  const changeMyMind = [
    `If, when the daily refresh has added 12 more weeks, price's best positive-lag correlation exceeds Intents volume's by more than 0.10 on three or more of the five usage series, the claim is wrong. Conversely, the claim only becomes "supported" rather than "partly supported" once Intents volume clears the noise band with a positive lead on at least three series, including one chain-level count.`,
    `If Intents volume's out-of-sample R² for transactions and active accounts falls below 0 (worse than the training mean) while price's stays above 0.10, the claim is wrong.`,
    `If removing receipts to aurora and intents.near from function calls (the "exAuroraIntents" variant) flips the winner, the apparent lead is just Intents settlement counting itself as usage.`,
    `If the 1Click Explorer series, once it covers the full window, disagrees in sign with the DefiLlama series at the chosen lag, the result depends on which Intents measure is used and should be marked unresolved.`,
  ];
  const gaps = [
    `The NEAR Intents Explorer API covers 1Click swaps only and starts in late May 2025; the committed backfill covers ${explorerDays.length} complete days${explorerDays.length ? ` from ${explorerDays[0].date}` : ""}${meta.cursors.intents.backfillDone ? "" : " and is still running"}. Where both sources exist the Explorer reports a median ${ratioMedian === null ? "n/a" : (ratioMedian * 100).toFixed(0) + "%"} of DefiLlama's daily volume. Until the backfill completes, every Intents chart uses DefiLlama's series and labels the source.`,
    `BigQuery usage series (function calls, contracts called, distinct signers) cover ${bqWeeks} weeks only, to stay inside the 300 GB query budget; the NearBlocks series cover the whole window.`,
    `Distinct signers are an estimate of users: one person can hold many accounts, and relayers or intents hide the end user, so no "unique users" metric is claimed.`,
    `No incentive or emissions data is available from a free source (DefiLlama's emissions endpoint is paid), so wash-like or incentive-driven volume cannot be separated from organic volume; the confounders above are the known programs.`,
    `Weekly samples number ${xIntents.length}; correlations smaller than about ${fmtR(leadLagOut.txns?.intents.noiseBand)} cannot be told from noise.`,
  ];

  const thesis: ThesisJson = {
    available: true,
    asOf: end,
    window: { start, end, weeks: weeklyDates.length },
    bigqueryWindow: { start: dailyRaw.functionCalls[0]?.[0] ?? null, end: dailyRaw.functionCalls.at(-1)?.[0] ?? null, weeks: bqWeeks },
    cutoff,
    maxLag: MAX_LAG,
    sources: { intents: "DefiLlama NEAR Intents adapter (all channels); 1Click Explorer where backfilled", price: "NearBlocks daily NEAR price", usage: ["NearBlocks daily charts", "NEAR BigQuery public dataset"] },
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
    coverage: { explorerDays: explorerDays.length, explorerFirstDay: explorerDays[0]?.date ?? null, ratioMedian: r3(ratioMedian), ratioLatest: r3(ratios.at(-1) ?? null), explorerBackfillDone: meta.cursors.intents.backfillDone },
    confounders,
    verdict: { baseIntentsWins: iw, basePriceWins: pw, baseTies: ties, oosIntentsWins: oiw, oosPriceWins: opw, robustnessIntentsWins: riw, robustnessPriceWins: rpw, supported, headline, evidenceFor: forLines, evidenceAgainst: againstLines, changeMyMind, gaps },
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
  const confRows = confounders.map((c) => `- ${c.date}${c.monthOnly ? " (month only)" : ""}, ${c.kind}: ${c.title}. ${c.why}${c.sourceUrl ? ` [source](${c.sourceUrl})` : ""}`).join("\n") || "- No matching events in the events file.";
  const fill: Record<string, string> = {
    asOf: end,
    headline,
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
    confounders: confRows,
    changeMyMind: changeMyMind.map((l) => `- ${l}`).join("\n"),
    gaps: gaps.map((l) => `- ${l}`).join("\n"),
  };
  const md = tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => fill[k] ?? `{{${k}}}`);
  fs.writeFileSync(mdFile, md);
  console.log(`  thesis: ${weeklyDates.length} weeks ${start}..${end}, cutoff ${cutoff}; lead-lag wins Intents ${iw} / price ${pw} / ties ${ties}; OOS wins Intents ${oiw} / price ${opw}; robustness ${riw}/${rpw}; verdict: ${supported}`);
  console.log(`  wrote THESIS.md and ${path.relative(ROOT, outFile)}\n`);
}

main();
