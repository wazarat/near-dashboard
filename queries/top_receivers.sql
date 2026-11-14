-- Step 1 of the top-receivers test: the 10 receiver accounts with the most signed transactions over one
-- complete month. The list is saved to data/top-receivers.csv and passed to daily_top_receivers.sql as @top.
-- Partition filter on block_date keeps the scan to the month.
SELECT
  receiver_account_id,
  COUNT(*) AS transactions
FROM `bigquery-public-data.crypto_near_mainnet_us.transactions`
WHERE block_date BETWEEN @start AND @end
GROUP BY receiver_account_id
ORDER BY transactions DESC, receiver_account_id
LIMIT 10
