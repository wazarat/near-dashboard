/**
 * Pure aggregation of the committed per-day NEAR Intents (1Click) files into what the /intents
 * page shows. DefiLlama's NEAR Intents daily volume is carried alongside as the cross-check.
 */
import { addDays, weekStart, type DateStr } from "./dates";
import type { IntentsDay, Series } from "./history-types";

export interface IntentsDayRow {
  date: DateStr;
  rows: number;
  volumeUsd: number;
  successCount: number;
  uniqueRecipients: number;
  medianUsd: number | null;
  p90Usd: number | null;
  successRate: number | null;
  refundRate: number | null;
  failRate: number | null;
  partial: boolean;
  /** DefiLlama NEAR Intents volume for the same day (all channels), null when missing. */
  llamaVolume: number | null;
  ratio: number | null;
}

export interface Bucket {
  key: string;
  count: number;
  usd: number;
  share: number;
}

export interface IntentsSummary {
  available: boolean;
  coverage: { firstDay: DateStr | null; lastDay: DateStr | null; days: number; completeDays: number; partialDays: number; backfillDone: boolean };
  days: IntentsDayRow[];
  weekly: Array<{ week: DateStr; volumeUsd: number; successCount: number; uniqueRecipients: number; llamaVolume: number | null; days: number }>;
  /** Trailing 30 complete days present in the Explorer data. */
  last30: { from: DateStr | null; to: DateStr | null; volumeUsd: number; swaps: number; uniqueRecipients: number; medianUsd: number | null; successRate: number | null; refundRate: number | null; failRate: number | null; llamaVolume: number | null; ratio: number | null; days: number };
  routes: Bucket[];
  originChains: Bucket[];
  destinationChains: Bucket[];
  originAssets: Bucket[];
  destinationAssets: Bucket[];
  referrals: Bucket[];
  appFeeRecipients: Bucket[];
  /** Explorer volume / DefiLlama volume on days where both exist. */
  ratioStats: { days: number; median: number | null; mean: number | null; latest: number | null };
  /** Complete days whose refund share is at least five times the median refund share and above 10%. */
  anomalies: Array<{ date: DateStr; rows: number; refundRate: number; medianUsd: number | null }>;
}

function rate(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function topBuckets(days: IntentsDay[], field: keyof Pick<IntentsDay, "routes" | "originChains" | "destinationChains" | "originAssets" | "destinationAssets" | "referrals" | "appFeeRecipients">, top = 15): Bucket[] {
  const acc = new Map<string, { count: number; usd: number }>();
  for (const d of days) {
    for (const [k, v] of Object.entries(d[field])) {
      const e = acc.get(k) ?? { count: 0, usd: 0 };
      e.count += v.count;
      e.usd += v.usd;
      acc.set(k, e);
    }
  }
  const total = Array.from(acc.values()).reduce((a, v) => a + v.usd, 0);
  const sorted = Array.from(acc.entries())
    .filter(([k]) => k !== "(other)")
    .sort((a, b) => b[1].usd - a[1].usd);
  const kept = sorted.slice(0, top).map(([key, v]) => ({ key, count: v.count, usd: Math.round(v.usd), share: total > 0 ? v.usd / total : 0 }));
  const rest = sorted.slice(top);
  const other = (acc.get("(other)")?.usd ?? 0) + rest.reduce((a, [, v]) => a + v.usd, 0);
  const otherCount = (acc.get("(other)")?.count ?? 0) + rest.reduce((a, [, v]) => a + v.count, 0);
  if (other > 0) kept.push({ key: "(other)", count: otherCount, usd: Math.round(other), share: total > 0 ? other / total : 0 });
  return kept;
}

export function summarizeIntents(daysIn: IntentsDay[], llama: Series, backfillDone: boolean): IntentsSummary {
  const days = [...daysIn].sort((a, b) => (a.date < b.date ? -1 : 1));
  const llamaMap = new Map(llama);
  const rows: IntentsDayRow[] = days.map((d) => {
    const lv = llamaMap.get(d.date) ?? null;
    const failed = (d.statuses.FAILED ?? 0) + (d.statuses.INCOMPLETE_DEPOSIT ?? 0);
    return {
      date: d.date,
      rows: d.rows,
      volumeUsd: d.volumeUsd,
      successCount: d.successCount,
      uniqueRecipients: d.uniqueRecipients,
      medianUsd: d.medianUsd,
      p90Usd: d.p90Usd,
      successRate: rate(d.successCount, d.rows),
      refundRate: rate(d.statuses.REFUNDED ?? 0, d.rows),
      failRate: rate(failed, d.rows),
      partial: d.partial,
      llamaVolume: lv,
      ratio: lv && lv > 0 && !d.partial ? d.volumeUsd / lv : null,
    };
  });
  const complete = days.filter((d) => !d.partial);
  const last30Days = complete.slice(-30);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const l30rows = sum(last30Days.map((d) => d.rows));
  const l30llama = last30Days.map((d) => llamaMap.get(d.date)).filter((v): v is number => v !== undefined);
  const l30llamaSum = l30llama.length === last30Days.length && last30Days.length ? sum(l30llama) : null;
  const l30vol = sum(last30Days.map((d) => d.volumeUsd));
  const weeks = new Map<DateStr, { volumeUsd: number; successCount: number; uniqueRecipients: number; llama: number; llamaDays: number; days: number }>();
  for (const d of complete) {
    const w = weekStart(d.date);
    const b = weeks.get(w) ?? { volumeUsd: 0, successCount: 0, uniqueRecipients: 0, llama: 0, llamaDays: 0, days: 0 };
    b.volumeUsd += d.volumeUsd;
    b.successCount += d.successCount;
    b.uniqueRecipients += d.uniqueRecipients;
    const lv = llamaMap.get(d.date);
    if (lv !== undefined) {
      b.llama += lv;
      b.llamaDays += 1;
    }
    b.days += 1;
    weeks.set(w, b);
  }
  const ratios = rows.map((r) => r.ratio).filter((v): v is number => v !== null);
  const refundRates = rows.filter((r) => !r.partial && r.refundRate !== null).map((r) => r.refundRate as number);
  const medianRefund = median(refundRates) ?? 0;
  const anomalies = rows
    .filter((r) => !r.partial && r.refundRate !== null && r.refundRate > 0.1 && r.refundRate >= 5 * medianRefund)
    .map((r) => ({ date: r.date, rows: r.rows, refundRate: r.refundRate as number, medianUsd: r.medianUsd }));
  return {
    available: days.length > 0,
    coverage: { firstDay: days[0]?.date ?? null, lastDay: days.at(-1)?.date ?? null, days: days.length, completeDays: complete.length, partialDays: days.length - complete.length, backfillDone },
    days: rows,
    weekly: Array.from(weeks.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([week, b]) => ({ week, volumeUsd: Math.round(b.volumeUsd), successCount: b.successCount, uniqueRecipients: b.uniqueRecipients, llamaVolume: b.llamaDays === b.days ? Math.round(b.llama) : null, days: b.days })),
    last30: {
      from: last30Days[0]?.date ?? null,
      to: last30Days.at(-1)?.date ?? null,
      volumeUsd: Math.round(l30vol),
      swaps: sum(last30Days.map((d) => d.successCount)),
      uniqueRecipients: sum(last30Days.map((d) => d.uniqueRecipients)),
      medianUsd: median(last30Days.map((d) => d.medianUsd).filter((v): v is number => v !== null)),
      successRate: rate(sum(last30Days.map((d) => d.successCount)), l30rows),
      refundRate: rate(sum(last30Days.map((d) => d.statuses.REFUNDED ?? 0)), l30rows),
      failRate: rate(sum(last30Days.map((d) => (d.statuses.FAILED ?? 0) + (d.statuses.INCOMPLETE_DEPOSIT ?? 0))), l30rows),
      llamaVolume: l30llamaSum,
      ratio: l30llamaSum && l30llamaSum > 0 ? l30vol / l30llamaSum : null,
      days: last30Days.length,
    },
    routes: topBuckets(last30Days, "routes", 25),
    originChains: topBuckets(last30Days, "originChains", 12),
    destinationChains: topBuckets(last30Days, "destinationChains", 12),
    originAssets: topBuckets(last30Days, "originAssets", 12),
    destinationAssets: topBuckets(last30Days, "destinationAssets", 12),
    referrals: topBuckets(last30Days, "referrals", 12),
    appFeeRecipients: topBuckets(last30Days, "appFeeRecipients", 12),
    ratioStats: { days: ratios.length, median: median(ratios), mean: ratios.length ? sum(ratios) / ratios.length : null, latest: ratios.at(-1) ?? null },
    anomalies,
  };
}

export const EMPTY_INTENTS: IntentsSummary = {
  available: false,
  coverage: { firstDay: null, lastDay: null, days: 0, completeDays: 0, partialDays: 0, backfillDone: false },
  days: [],
  weekly: [],
  last30: { from: null, to: null, volumeUsd: 0, swaps: 0, uniqueRecipients: 0, medianUsd: null, successRate: null, refundRate: null, failRate: null, llamaVolume: null, ratio: null, days: 0 },
  routes: [],
  originChains: [],
  destinationChains: [],
  originAssets: [],
  destinationAssets: [],
  referrals: [],
  appFeeRecipients: [],
  ratioStats: { days: 0, median: null, mean: null, latest: null },
  anomalies: [],
};

void addDays;
