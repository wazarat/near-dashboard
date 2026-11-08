"use client";

import { useMemo } from "react";
import { ChartCard, EmptyState, Legend } from "@/components/atlas/chart-card";
import { EstimateLabel } from "@/components/atlas/estimate-label";
import { chainData } from "@/lib/data";
import { fmtCompact, fmtDateShort, fmtPctSigned } from "@/lib/format";
import { rangeDays, RANGE_LONG, sliceTail, type Range } from "@/lib/ranges";
import { MiniSeries } from "./mini-series";

const BQ_DAILY_CHAIN = `SELECT block_date, COUNT(*) AS transactions, COUNT(DISTINCT signer_account_id) AS active_accounts, COUNT(DISTINCT receiver_account_id) AS distinct_receivers
FROM \`bigquery-public-data.crypto_near_mainnet_us.transactions\`
WHERE block_date BETWEEN @start AND @end GROUP BY block_date ORDER BY block_date`;

const BQ_DAILY_RECEIPTS = /* copy-ok */ `-- one scan of receipt_actions: chain totals (account_id NULL) and per-receiver rows for tracked accounts
SELECT block_date, account_id, COUNTIF(action_kind = 'FUNCTION_CALL') AS function_calls,
  COUNT(DISTINCT IF(action_kind = 'FUNCTION_CALL', signer_account_id, NULL)) AS distinct_signers,
  COUNT(DISTINCT IF(action_kind = 'FUNCTION_CALL', receipt_receiver_account_id, NULL)) AS contracts_called,
  COUNTIF(action_kind = 'CREATE_ACCOUNT') AS new_accounts, COUNTIF(action_kind = 'DEPLOY_CONTRACT') AS contracts_deployed
FROM (SELECT block_date, action_kind, signer_account_id, receipt_receiver_account_id,
        IF(receipt_receiver_account_id IN UNNEST(@accounts), receipt_receiver_account_id, NULL) AS account_id
      FROM \`bigquery-public-data.crypto_near_mainnet_us.receipt_actions\` WHERE block_date BETWEEN @start AND @end)
GROUP BY GROUPING SETS ((block_date), (block_date, account_id))
HAVING account_id IS NOT NULL OR GROUPING(account_id) = 1`;

/** Daily chain usage: NearBlocks since genesis with the BigQuery series overlaid where it exists. */
export function ChainActivity({ range }: { range: Range }) {
  const total = chainData.dates.length;
  const n = rangeDays(range, total);
  const dates = useMemo(() => sliceTail(chainData.dates, n), [n]);
  const nb = chainData.nearblocks;
  const bq = chainData.bigquery;
  const tail = (a: Array<number | null> | undefined) => (a ? sliceTail(a, n) : dates.map(() => null));
  const latest = chainData.latest;
  const key = range === "7d" ? "d7" : range === "30d" ? "d30" : "d90";
  const bqDays = (bq.transactions ?? []).filter((v) => v !== null).length;
  const takeaway =
    total === 0
      ? "Chain activity appears after the first refresh run."
      : `${fmtCompact(latest.txns)} transactions and ${fmtCompact(latest.activeAccounts)} active accounts on the last complete day (${fmtPctSigned(latest.activityChange.txns?.[key])} and ${fmtPctSigned(latest.activityChange.activeAccounts?.[key])} over the ${RANGE_LONG[range]}); ${bqDays ? `BigQuery covers the last ${bqDays} days and agrees with NearBlocks on transactions` : "BigQuery series not loaded yet"}.`;

  const panels = [
    { label: "Transactions per day", nb: tail(nb.txns), bq: tail(bq.transactions), kind: "line" as const },
    { label: "Active accounts (distinct signers)", nb: tail(nb.activeAccounts), bq: tail(bq.active_accounts), kind: "line" as const },
    { label: "New accounts", nb: tail(nb.newAccounts), bq: tail(bq.new_accounts), kind: "bar" as const },
    { label: "Function calls (BigQuery)", nb: tail(bq.function_calls), bq: undefined, kind: "bar" as const, bqOnly: true },
    { label: "Contracts called (BigQuery)", nb: tail(bq.contracts_called), bq: undefined, kind: "line" as const, bqOnly: true },
    { label: "Receipts to aurora and intents.near (BigQuery)", nb: tail(bq.auroraCalls), bq: tail(bq.intentsCalls), kind: "line" as const, pair: ["aurora", "intents.near"] as const },
  ];

  return (
    <ChartCard
      title="Chain activity"
      takeaway={takeaway}
      info="NearBlocks daily charts (transactions, active accounts, new accounts) since 2020 plus the NEAR BigQuery public dataset for the last year, which adds transactions, distinct signers, CREATE_ACCOUNT actions, FUNCTION_CALL receipts, distinct contracts called, and receipts to the aurora and intents.near accounts. Distinct signers are an estimate, since one person can use many accounts, and relayers or intents hide the end user."
      queries={[
        { kind: "sql", title: "queries/daily_chain.sql (transactions table)", code: BQ_DAILY_CHAIN },
        { kind: "sql", title: "queries/daily_receipts.sql (receipt_actions table)", code: BQ_DAILY_RECEIPTS },
        { kind: "http", title: "NearBlocks daily charts", code: "GET https://api.nearblocks.io/v1/charts  -> charts[].{date, txns, active_accounts, new_accounts, active_contracts, near_price, market_cap}" },
      ]}
      table={{
        columns: [
          { key: "date", label: "Date" },
          { key: "nbTxns", label: "Txns (NearBlocks)", align: "right" },
          { key: "bqTxns", label: "Txns (BigQuery)", align: "right" },
          { key: "nbActive", label: "Active accts (NearBlocks)", align: "right" },
          { key: "bqActive", label: "Signers (BigQuery)", align: "right" },
          { key: "newAcc", label: "New accts (NearBlocks)", align: "right" },
          { key: "calls", label: "Function calls", align: "right" },
          { key: "contracts", label: "Contracts called", align: "right" },
          { key: "aurora", label: "Receipts to aurora", align: "right" },
          { key: "intents", label: "Receipts to intents.near", align: "right" },
        ],
        rows: dates
          .map((d, i) => ({
            date: d,
            nbTxns: panels[0].nb[i],
            bqTxns: panels[0].bq?.[i] ?? null,
            nbActive: panels[1].nb[i],
            bqActive: panels[1].bq?.[i] ?? null,
            newAcc: panels[2].nb[i],
            calls: panels[3].nb[i],
            contracts: panels[4].nb[i],
            aurora: panels[5].nb[i],
            intents: panels[5].bq?.[i] ?? null,
          }))
          .reverse(),
        filename: `chain-activity-${range}.csv`,
        maxRows: 120,
      }}
    >
      {total === 0 ? (
        <EmptyState message="No chain activity history yet. Run npm run refresh to fetch it." />
      ) : (
        <div>
          <Legend
            items={[
              { label: "NearBlocks", color: "var(--series-usage)", shape: "line" },
              { label: "BigQuery", color: "var(--cat-1)", shape: "line" },
              { label: "aurora", color: "var(--chain-aurora)", shape: "line" },
              { label: "intents.near", color: "var(--series-intents)", shape: "line" },
            ]}
            className="mb-2"
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {panels.map((p) => (
              <div key={p.label} className="rounded-md border p-2">
                <div className="mb-1 text-xs font-medium">
                  {p.label.includes("signers") ? <EstimateLabel note="Distinct signer accounts per day. People use several accounts and relayers hide the end user.">{p.label}</EstimateLabel> : p.label}
                </div>
                <MiniSeries
                  dates={dates}
                  values={p.nb}
                  kind={p.kind}
                  primaryLabel={p.pair ? p.pair[0] : p.bqOnly ? "BigQuery" : "NearBlocks"}
                  height={130}
                  color={p.pair ? "var(--chain-aurora)" : p.bqOnly ? "var(--cat-1)" : "var(--series-usage)"}
                  format={(v) => fmtCompact(v)}
                  secondary={p.bq ? { values: p.bq, label: p.pair ? p.pair[1] : "BigQuery", color: p.pair ? "var(--series-intents)" : "var(--cat-1)" } : undefined}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {dates.length} days to {fmtDateShort(dates[dates.length - 1])}. Function calls, contracts called and receipts to aurora / intents.near exist only for the BigQuery window.
          </p>
        </div>
      )}
    </ChartCard>
  );
}
