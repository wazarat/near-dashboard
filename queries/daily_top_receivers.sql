-- Step 2 of the top-receivers test: daily signed transactions to the 10 accounts in data/top-receivers.csv
-- (@top) and to every other receiver. Reads block_date and receiver_account_id only.
-- Partition filter on block_date keeps the scan to the requested window.
SELECT
  block_date,
  COUNT(*) AS transactions,
  COUNTIF(receiver_account_id IN UNNEST(@top)) AS top_transactions,
  COUNTIF(receiver_account_id NOT IN UNNEST(@top)) AS other_transactions
FROM `bigquery-public-data.crypto_near_mainnet_us.transactions`
WHERE block_date BETWEEN @start AND @end
GROUP BY block_date
ORDER BY block_date
