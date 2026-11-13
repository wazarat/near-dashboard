/**
 * When a reported 0 is a gap rather than a zero (docs/LIVE-DATA.md, section 0). Sources write 0 for a day
 * their indexer missed; drawing it as a dip would be wrong, so it becomes null and the chart shows a gap.
 *
 * - Transactions: a chain that is running never has a day with no transactions, so a 0 is always a gap.
 * - Gas fees: every transaction pays gas, so a 0 is a gap whether or not that day's transactions are known.
 *   (The spec's rule says "when transactions are also 0 or missing"; its own fixture marks Aurora's $0 days
 *   on Nov 1, 5 and 9 as gaps although Aurora had transactions, which only this stricter reading allows.)
 * - Any other flow: a 0 is a gap only when that day's transactions are 0 or missing (the spec's rule).
 */
export type Values = ReadonlyArray<number | null>;

export function txnGaps(txns: Values): Array<number | null> {
  return txns.map((v) => (v === 0 ? null : v));
}

export function gasFeeGaps(fees: Values): Array<number | null> {
  return fees.map((v) => (v === 0 ? null : v));
}

export function flowGaps(values: Values, txns: Values): Array<number | null> {
  return values.map((v, i) => (v === 0 && (txns[i] === null || txns[i] === undefined || txns[i] === 0) ? null : v));
}

type Point = readonly [string, number];

/**
 * Aurora daily transactions: Aurora Blockscout returns only about the last 31 days, so the history comes from
 * receipts to the aurora account in the NEAR BigQuery public dataset, which match Blockscout's daily
 * transactions within about 1% where both exist. BigQuery is used through its last day and Blockscout after it.
 */
export function spliceHistory(history: ReadonlyArray<Point>, recent: ReadonlyArray<Point>): Array<[string, number]> {
  const out = history.map(([d, v]) => [d, v] as [string, number]);
  const last = out.length ? out[out.length - 1][0] : "";
  for (const [d, v] of recent) if (d > last) out.push([d, v]);
  return out;
}
