/** Source labels used on every NEAR Intents chart so each point says where it comes from. */
export const EXPLORER_LABEL = "1Click swaps (Explorer API)";
export const LLAMA_LABEL = "NEAR Intents, all channels (DefiLlama)";

export const EXPLORER_COLOR = "var(--series-intents)";
export const LLAMA_COLOR = "var(--cat-2)";
export const SWAPS_COLOR = "var(--series-usage)";

export const EXPLORER_QUERY = {
  kind: "http" as const,
  title: "NEAR Intents Explorer API (1Click swaps only)",
  code: `GET https://explorer.near-intents.org/api/v0/transactions
  ?numberOfTransactions=1000
  &direction=next                 # older rows
  &lastDepositAddress=<cursor>    # depositAddress of the last row of the previous page
  &lastDepositMemo=<cursor>       # depositMemo of that row, omitted when null
  &startTimestampUnix=<unix>      # optional window bounds
  &endTimestampUnix=<unix>
Authorization: Bearer $NEAR_INTENTS_JWT
Rate limit: 1 request / 5 s, at most 1000 rows per page
-> rows[].{depositAddress, depositMemo, status, createdAt, originAsset, destinationAsset,
           amountInUsd, amountOutUsd, recipient, referral, appFees[].recipient}`,
};

export const LLAMA_QUERY = {
  kind: "http" as const,
  title: "DefiLlama NEAR Intents daily volume",
  code: `GET https://api.llama.fi/overview/dexs/near?excludeTotalDataChart=true
-> totalDataChartBreakdown[][1]["NEAR Intents"]   (one USD value per UTC day)`,
};

export const TRANSFORM_QUERY = {
  kind: "transform" as const,
  title: "Per-day aggregate (data/raw/intents/daily/YYYY-MM-DD.json)",
  code: `day        = UTC date of createdAt
volumeUsd  = sum(amountInUsd) where status = SUCCESS
swaps      = count(*)          where status = SUCCESS
recipients = count(distinct sha256(recipient)) per day   # estimate: one person can use many addresses
medianUsd  = median(amountInUsd) of SUCCESS swaps
rates      = SUCCESS / rows, REFUNDED / rows, (FAILED + INCOMPLETE_DEPOSIT) / rows
routes     = originChain > destinationChain, summed count and amountInUsd of SUCCESS swaps
partial    = true when the backfill cursor stopped inside the day or the day is still open
ratio      = volumeUsd / DefiLlama["NEAR Intents"] on complete days where both exist`,
};
