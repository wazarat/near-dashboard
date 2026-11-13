/**
 * Gas fees generated per project (NEAR protocol rule): when a receipt executes on a contract account, the
 * protocol pays that contract 30% of the gas the execution burnt. Summing tokens burnt per executor account
 * (queries/daily_gas.sql) therefore gives two numbers per project:
 *
 * - gas paid by users: every NEAR burnt executing on the project's accounts, at that day's NEAR price;
 * - gas fees generated: the contract's 30% share of it.
 *
 * Both measure usage, not protocol income, so they are kept out of every fee and revenue total. Pure, so the
 * arithmetic is tested on a fixture.
 */
export const CONTRACT_GAS_SHARE = 0.3;
export const GAS_WINDOW_DAYS = 30;

/** Account → [date, NEAR burnt, outcomes] per day, as stored in data/history/bigquery/gas.json. */
export type GasFile = Record<string, Array<[string, number, number]>>;

/** The price on a day, or the latest earlier one (NearBlocks prices are daily; a missing day uses the day before). */
export function priceOn(prices: ReadonlyArray<readonly [string, number]>, date: string): number | null {
  let lo = 0;
  let hi = prices.length - 1;
  let best: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (prices[mid][0] <= date) {
      best = prices[mid][1];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best;
}

export interface GasTotals {
  /** USD of every NEAR burnt on the accounts over the window. */
  paidUsd: number;
  /** The contracts' 30% share, in USD. */
  generatedUsd: number;
  nearBurnt: number;
  days: number;
  end: string;
}

/**
 * Over the last `windowDays` days up to the latest day any account reports: sums NEAR burnt across the accounts
 * and converts each day at that day's price. null when no account has data or no price is known.
 */
export function gasTotals(file: GasFile, accounts: readonly string[], prices: ReadonlyArray<readonly [string, number]>, windowDays = GAS_WINDOW_DAYS): GasTotals | null {
  const byDay = new Map<string, number>();
  for (const a of accounts) for (const [d, near] of file[a] ?? []) byDay.set(d, (byDay.get(d) ?? 0) + near);
  if (!byDay.size) return null;
  const days = [...byDay.keys()].sort();
  const end = days[days.length - 1];
  const start = new Date(Date.parse(`${end}T00:00:00Z`) - (windowDays - 1) * 86_400_000).toISOString().slice(0, 10);
  let paidUsd = 0;
  let nearBurnt = 0;
  let n = 0;
  for (const d of days) {
    if (d < start) continue;
    const p = priceOn(prices, d);
    if (p === null) continue;
    const near = byDay.get(d) ?? 0;
    nearBurnt += near;
    paidUsd += near * p;
    n += 1;
  }
  if (!n) return null;
  return { paidUsd, generatedUsd: paidUsd * CONTRACT_GAS_SHARE, nearBurnt, days: n, end };
}
