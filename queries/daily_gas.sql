-- Gas burnt per tracked account per day, from execution outcomes.
-- A receipt's outcome is executed by its receiver, so for a contract account this is the gas its calls
-- burnt; the protocol pays the contract 30% of that (scripts/lib/gas.ts). Transaction outcomes are
-- executed by the signer, so a tracked account that also signs transactions adds the gas of converting
-- them; that share is small for contracts and is noted on the site.
-- Partition filter on block_date keeps the scan to the requested window.
SELECT
  block_date,
  executor_account_id AS account_id,
  COUNT(*) AS outcomes,
  SUM(CAST(gas_burnt AS BIGNUMERIC)) AS gas_burnt,
  SUM(CAST(tokens_burnt AS BIGNUMERIC)) / 1e24 AS near_burnt
FROM `bigquery-public-data.crypto_near_mainnet_us.execution_outcomes`
WHERE block_date BETWEEN @start AND @end
  AND executor_account_id IN UNNEST(@accounts)
GROUP BY block_date, account_id
ORDER BY block_date, account_id
