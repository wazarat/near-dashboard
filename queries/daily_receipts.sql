-- One scan of receipt_actions per window gives both the chain-level totals and the per-receiver
-- rows for tracked accounts (aurora = Aurora EVM, intents.near = NEAR Intents settlement, plus
-- data/contracts.csv) via GROUPING SETS. account_id is NULL on the chain-level rows.
-- A CREATE_ACCOUNT for a sub-account of a tracked launchpad factory (Role factory in contracts.csv)
-- is attributed to 'factory:<factory>', so its new_accounts column counts the tokens that factory
-- launched that day. Same columns read, so the scan costs the same.
SELECT
  block_date,
  account_id,
  COUNTIF(action_kind = 'FUNCTION_CALL') AS function_calls,
  COUNT(DISTINCT IF(action_kind = 'FUNCTION_CALL', signer_account_id, NULL)) AS distinct_signers,
  COUNT(DISTINCT IF(action_kind = 'FUNCTION_CALL', receipt_receiver_account_id, NULL)) AS contracts_called,
  COUNTIF(action_kind = 'CREATE_ACCOUNT') AS new_accounts,
  COUNTIF(action_kind = 'DEPLOY_CONTRACT') AS contracts_deployed
FROM (
  SELECT
    block_date,
    action_kind,
    signer_account_id,
    receipt_receiver_account_id,
    COALESCE(
      IF(receipt_receiver_account_id IN UNNEST(@accounts), receipt_receiver_account_id, NULL),
      IF(action_kind = 'CREATE_ACCOUNT',
        (SELECT CONCAT('factory:', f) FROM UNNEST(@factories) AS f WHERE ENDS_WITH(receipt_receiver_account_id, CONCAT('.', f)) LIMIT 1),
        NULL)
    ) AS account_id
  FROM `bigquery-public-data.crypto_near_mainnet_us.receipt_actions`
  WHERE block_date BETWEEN @start AND @end
)
GROUP BY GROUPING SETS ((block_date), (block_date, account_id))
HAVING account_id IS NOT NULL OR GROUPING(account_id) = 1
ORDER BY block_date, account_id
