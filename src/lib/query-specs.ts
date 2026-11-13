/**
 * Every "How this is calculated" block on the site reads from here (thesis track: each chart shows the query
 * behind it and one plain sentence on what it shows). API calls and transforms are written once; SQL is never
 * copied, it is read from queries/*.sql at build time (scripts/build-data.ts writes src/data/generated/queries.json),
 * so the page always shows the file that actually runs. scripts/thesis.ts uses the same specs.
 */
export interface QuerySpec {
  /** "sql" for BigQuery, "http" for an API call, "transform" for a pure function in this repository. */
  kind: "sql" | "http" | "transform";
  /** The SQL file path, the endpoint, or the transform's file and function. */
  title: string;
  code: string;
}

/** The SQL files in queries/, by file name without the extension. */
export type SqlId = "daily_chain" | "daily_receipts" | "daily_gas";

export function sqlSpec(id: SqlId, text: string, table?: string): QuerySpec {
  return { kind: "sql", title: `queries/${id}.sql${table ? ` (${table} table)` : ""}`, code: text.trim() };
}

export const SPECS = {
  intentsLlama: {
    kind: "http",
    title: "GET https://api.llama.fi/overview/dexs/near",
    code: `GET https://api.llama.fi/overview/dexs/near?excludeTotalDataChart=true
-> totalDataChartBreakdown[][1]["NEAR Intents"]   (one USD value per UTC day, data/history/defillama/volume-near.json)`,
  },
  intentsExplorer: {
    kind: "http",
    title: "GET https://explorer.near-intents.org/api/v0/transactions",
    code: /* copy-ok */ `GET https://explorer.near-intents.org/api/v0/transactions
  ?numberOfTransactions=1000
  &direction=next                 # older rows
  &lastDepositAddress=<cursor>    # depositAddress of the last row of the previous page
  &lastDepositMemo=<cursor>       # depositMemo of that row, omitted when null
  &startTimestampUnix=<unix>      # optional window bounds
  &endTimestampUnix=<unix>
Authorization: Bearer $NEAR_INTENTS_JWT
Rate limit: 1 request / 5 s, at most 1000 rows per page
-> rows[].{depositAddress, depositMemo, status, createdAt, originAsset, destinationAsset,
           amountInUsd, amountOutUsd, recipient, referral, appFees[].{recipient, fee}}`,
  },
  intentsDaily: {
    kind: "transform",
    title: "scripts/fetch/intents.ts aggregateDay (data/raw/intents/daily/YYYY-MM-DD.json)",
    code: /* copy-ok */ `day        = UTC date of createdAt
volumeUsd  = sum(amountInUsd) where status = SUCCESS
swaps      = count(*)          where status = SUCCESS
recipients = count(distinct sha256(recipient)) per day   # estimate: one person can use many addresses
medianUsd  = median(amountInUsd) of SUCCESS swaps
rates      = SUCCESS / rows, REFUNDED / rows, (FAILED + INCOMPLETE_DEPOSIT) / rows
routes     = originChain > destinationChain, summed count and amountInUsd of SUCCESS swaps
referrals  = per referral tag, count and amountInUsd of SUCCESS swaps
partial    = true when the backfill cursor stopped inside the day or the day is still open
ratio      = volumeUsd / DefiLlama["NEAR Intents"] on complete days where both exist`,
  },
  referralApps: {
    kind: "transform",
    title: "src/lib/referrals.ts referralTotals + referralsByProject",
    code: /* copy-ok */ `days      = last 30 complete days of data/raw/intents/daily/*.json
per tag   = sum(referrals[tag].usd), sum(referrals[tag].count)   ("(none)" and "(other)" left out)
per app   = sum over the tags data/intents-referrals.csv maps to the project with Verified = Yes
never     = added to the app's own DEX volume (it is already inside NEAR Intents' figure)`,
  },
  nearblocks: {
    kind: "http",
    title: "GET https://api.nearblocks.io/v1/charts",
    code: "GET https://api.nearblocks.io/v1/charts\n-> charts[].{date, txns, active_accounts, new_accounts, active_contracts, near_price, market_cap}   (data/history/chain.json, nearblocks)",
  },
  llamaChainTvl: {
    kind: "http",
    title: "GET https://api.llama.fi/v2/historicalChainTvl/{Near,Aurora}",
    code: "GET https://api.llama.fi/v2/historicalChainTvl/Near\nGET https://api.llama.fi/v2/historicalChainTvl/Aurora\n-> [].{date, tvl}   default chain TVL, liquid staking and bridges excluded (data/history/chain.json, near.tvl and aurora.tvl)",
  },
  llamaChainFlows: {
    kind: "http",
    title: "GET https://api.llama.fi/overview/{dexs,fees}/{near,aurora}",
    code: /* copy-ok */ `GET https://api.llama.fi/overview/dexs/near?excludeTotalDataChart=true                        (daily DEX volume)
GET https://api.llama.fi/overview/fees/near?excludeTotalDataChart=true&dataType=dailyFees     (protocol fees)
GET https://api.llama.fi/overview/fees/near?excludeTotalDataChart=true&dataType=dailyRevenue  (protocol revenue)
-> totalDataChartBreakdown, summed across every protocol per day
GET https://api.llama.fi/summary/fees/near?dataType=dailyFees -> totalDataChart  (the chain's own gas fees)
(the same four for aurora)`,
  },
  chainTxns: {
    kind: "http",
    title: "GET https://explorer.mainnet.aurora.dev/api/v2/stats/charts/transactions",
    code: /* copy-ok */ `NEAR:   GET https://api.nearblocks.io/v1/charts -> charts[].txns
Aurora: GET https://explorer.mainnet.aurora.dev/api/v2/stats/charts/transactions -> chart_data[].{date, transactions_count}   (about the last 31 days)
        before that, receipts to the aurora account per day from queries/daily_receipts.sql (they match Aurora transactions within 1%)`,
  },
  chainGaps: {
    kind: "transform",
    title: "src/lib/chain-gaps.ts",
    code: /* copy-ok */ "gas fees: a day reported as 0 is a gap (a chain that processed transactions cannot earn $0 gas)\ntransactions and other flows: a 0 is a gap when that day's transactions are 0 or missing",
  },
  llamaProtocolTvl: {
    kind: "http",
    title: "GET https://api.llama.fi/protocol/{slug}",
    code: "GET https://api.llama.fi/protocol/{slug}   for every slug in data/defillama-map.csv\n-> chainTvls.{Near,Aurora}.tvl[].{date, totalLiquidityUSD}   (data/history/defillama/tvl-{near,aurora}.json)",
  },
  llamaProtocolFlows: {
    kind: "http",
    title: "GET https://api.llama.fi/overview/{dexs,fees}/{near,aurora} (per protocol)",
    code: "GET https://api.llama.fi/overview/dexs/near and /overview/fees/near (and aurora)\n-> totalDataChartBreakdown[][1][protocol name]   daily volume and fees per protocol (data/history/defillama/{volume,fees}-{near,aurora}.json)",
  },
  selectionSeries: {
    kind: "transform",
    title: "src/lib/selection-series.ts selectionSeries",
    code: /* copy-ok */ "for each day: sum over the selected projects that have a value that day (TVL, volume, fees, revenue)\na project with no history is left out of the sum, never counted as zero; the card says how many have history",
  },
  movers: {
    kind: "transform",
    title: "src/lib/movers.ts movers",
    code: /* copy-ok */ "volume, fees, revenue: sum over the last N days / sum over the N days before − 1\nTVL: value on the last day / value N days earlier − 1\nonly projects above the minimum size; risers = largest changes, fallers = smallest; a project with no earlier value is left out",
  },
  snapshotCsv: {
    kind: "transform",
    title: "data/near-ecosystem-2026-11-08.csv + scripts/build-data.ts",
    code: "projects, sectors, subcategories, Native Chain and status come from the research CSV\nTVL, volume, fees and revenue come from DefiLlama (live where mapped in data/defillama-map.csv, else the snapshot value); blank stays blank, never zero",
  },
  treemap: {
    kind: "transform",
    title: "src/lib/treemap.ts",
    code: "box size = the chosen metric summed over the sector's projects in the selection (blank values left out)\ncolour = share of the sector's projects whose Native Chain is NEAR native",
  },
  nativeShare: {
    kind: "transform",
    title: "src/components/charts/native-stacked-bar.tsx nativeStackRows",
    code: /* copy-ok */ "per sector: count of projects by Native Chain (NEAR native, Aurora native, imported from another chain), from the research CSV",
  },
  concentration: {
    kind: "transform",
    title: "src/lib/metrics.ts concentration",
    code: "sort projects by the metric, largest first; point k = share of the selection's total held by the top k projects",
  },
  events: {
    kind: "transform",
    title: "data/near-events-2026-11-08.csv + src/lib/timeline.ts",
    code: "one row per dated event from the research CSV (launches, incidents, funding, listings, integrations), each with its source link",
  },
  weekly: { kind: "transform", title: "src/lib/stats.ts toWeekly + logChanges", code: "weekly = ISO-week sums (flows) or last value (price); x_t = ln(weekly_t / weekly_{t-1}); weeks with < 4 days or the incomplete trailing week are dropped" },
  leadLag: { kind: "transform", title: "src/lib/stats.ts crossCorrelation", code: /* copy-ok */ "for k in −8…+8: r_k = pearson(x_t, y_{t+k}) over all t where both exist; positive k = x leads y by k weeks; noise band ≈ 2/√n" },
  oos: {
    kind: "transform",
    title: "src/lib/stats.ts outOfSample",
    code: /* copy-ok */ "lag k* = argmax_{k∈1…8} |corr(x_{t−k}, y_t)| on weeks < cutoff; fit y_t = a + b·x_{t−k*} on the same weeks;\nscore weeks ≥ cutoff: R²_oos = 1 − SSE(model)/SSE(train mean); hit rate = share of weeks with sign(forecast) = sign(actual)",
  },
} satisfies Record<string, QuerySpec>;

export type SpecId = keyof typeof SPECS;

/** A chart's method: one plain sentence on what it shows, and the queries behind it. */
export interface ChartMethod {
  sentence: string;
  queries: QuerySpec[];
}
