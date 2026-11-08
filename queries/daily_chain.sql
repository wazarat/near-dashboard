-- Daily chain activity from signed transactions.
-- Partition filter on block_date keeps the scan to the requested window.
SELECT
  block_date,
  COUNT(*) AS transactions,
  COUNT(DISTINCT signer_account_id) AS active_accounts,
  COUNT(DISTINCT receiver_account_id) AS distinct_receivers
FROM `bigquery-public-data.crypto_near_mainnet_us.transactions`
WHERE block_date BETWEEN @start AND @end
GROUP BY block_date
ORDER BY block_date
