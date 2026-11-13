"use client";

import { ChartCard, EmptyState, Legend } from "@/components/atlas/chart-card";
import { frameHeight, type ChartFrame } from "@/components/atlas/chart-frame";
import { EstimateLabel } from "@/components/atlas/estimate-label";
import { RangeBrush } from "@/components/atlas/range-brush";
import { RangeControl } from "@/components/atlas/range-control";
import { brushSlice, dataStart } from "@/lib/chart-frame";
import { chainData, sql } from "@/lib/data";
import { SPECS } from "@/lib/query-specs";
import { fmtCompact, fmtDateShort, fmtPct, fmtPctSigned, fmtDate } from "@/lib/format";
import { rangeDays, RANGE_THE, sliceTail, type Range } from "@/lib/ranges";
import { selectionSeries, windowSum } from "@/lib/selection-series";
import type { Project } from "@/lib/types";
import { useSeries } from "@/lib/use-series";
import { useMemo } from "react";
import { MiniSeries } from "./mini-series";

type Panel = { label: string; nb: Array<number | null>; bq?: Array<number | null>; kind: "line" | "bar"; bqOnly?: boolean; pair?: readonly ["aurora", "intents.near"]; /** The selection's own figure, in a filtered view; every other panel is then marked whole chain. */ selection?: boolean };

/**
 * Daily chain usage: NearBlocks since genesis with the BigQuery series overlaid where it exists. Every panel is a flow and starts at zero.
 * With a filter set (`selection`), the function calls panel counts calls to the selection's own tracked contracts, summed from the
 * per-project BigQuery history; transactions and accounts cannot be split by project, so those panels stay whole chain and say so.
 */
export function ChainActivity({ range, onRangeChange, selection = null }: { range: Range; onRangeChange: (r: Range) => void; selection?: Project[] | null }) {
  const file = useSeries();
  const sel = useMemo(() => (selection && file ? selectionSeries(file, selection.map((p) => p.id)) : null), [selection, file]);
  const selCalls = useMemo(() => {
    const m = new Map<string, number | null>();
    if (sel) sel.dates.forEach((d, i) => m.set(d, sel.metrics.calls.values[i]));
    return m;
  }, [sel]);
  const total = chainData.dates.length;
  const n = rangeDays(range, total);
  const windowDates = sliceTail(chainData.dates, n);
  const nb = chainData.nearblocks;
  const bq = chainData.bigquery;
  const latest = chainData.latest;
  const key = range === "7d" ? "d7" : range === "30d" ? "d30" : "d90";
  const bqDays = (bq.transactions ?? []).filter((v) => v !== null).length;
  const takeaway =
    total === 0
      ? "Chain activity appears after the first refresh run."
      : `${fmtCompact(latest.txns)} transactions and ${fmtCompact(latest.activeAccounts)} active accounts on the last complete day (${fmtPctSigned(latest.activityChange.txns?.[key])} and ${fmtPctSigned(latest.activityChange.activeAccounts?.[key])} over ${RANGE_THE[range]}); ${bqDays ? `BigQuery covers the last ${bqDays} days and agrees with NearBlocks on transactions` : "BigQuery series not loaded yet"}.`;

  const selCallsWindow = sel ? windowSum(windowDates.map((d) => selCalls.get(d) ?? null), n) : null;
  const chainCallsWindow = windowSum(sliceTail(bq.function_calls ?? [], n), n);
  const selectionLine = !selection
    ? ""
    : !sel
      ? " Loading the selection's contract calls."
      : sel.metrics.calls.withHistory === 0
        ? ` None of the ${selection.length} selected projects has tracked contracts, so no panel can be split to the selection; every panel is whole chain.`
        : ` The selection's tracked contracts (${sel.metrics.calls.withHistory} of ${selection.length} selected projects have them) received ${fmtCompact(selCallsWindow)} function calls over the last ${n} days${chainCallsWindow ? `, ${fmtPct(selCallsWindow !== null ? selCallsWindow / chainCallsWindow : null)} of all calls on the chain` : ""}; the other panels are whole chain.`;

  const buildPanels = (brush: [number, number] | null): { dates: string[]; panels: Panel[] } => {
    const dates = brushSlice(windowDates, brush);
    const tail = (a: Array<number | null> | undefined) => (a ? brushSlice(sliceTail(a, n), brush) : dates.map(() => null));
    const panels: Panel[] = [
      { label: "Transactions per day", nb: tail(nb.txns), bq: tail(bq.transactions), kind: "line" },
      { label: "Active accounts (distinct signers)", nb: tail(nb.activeAccounts), bq: tail(bq.active_accounts), kind: "line" },
      { label: "New accounts", nb: tail(nb.newAccounts), bq: tail(bq.new_accounts), kind: "bar" },
      selection
        ? { label: "Function calls to the selection's tracked contracts (BigQuery)", nb: dates.map((d) => selCalls.get(d) ?? null), bq: undefined, kind: "bar", bqOnly: true, selection: true }
        : { label: "Function calls (BigQuery)", nb: tail(bq.function_calls), bq: undefined, kind: "bar", bqOnly: true },
      { label: "Contracts called (BigQuery)", nb: tail(bq.contracts_called), bq: undefined, kind: "line", bqOnly: true },
      { label: "Receipts to aurora and intents.near (BigQuery)", nb: tail(bq.auroraCalls), bq: tail(bq.intentsCalls), kind: "line", pair: ["aurora", "intents.near"] as const },
    ];
    return { dates, panels };
  };

  const full = buildPanels(null);

  const renderPanels = (frame: ChartFrame) => {
    const { dates, panels } = frame.brushRange ? buildPanels(frame.brushRange) : full;
    const height = frameHeight(frame, 130, 260);
    return (
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
          {panels.map((p) => {
            // BigQuery-only panels start a year back; on a longer range they are clipped to their first day and labelled.
            const { start, from } = p.bqOnly || p.pair ? dataStart(dates, p.nb, p.bq) : { start: 0, from: null };
            return (
              <div key={p.label} className="rounded-lg border border-ink-700/40 p-2">
              <div className="mb-1 flex items-start justify-between gap-2 text-xs">
                <span className="font-medium">{p.label.includes("signers") ? <EstimateLabel note="Distinct signer accounts per day. People use several accounts and relayers hide the end user.">{p.label}</EstimateLabel> : p.label}</span>
                {from && (
                  <span className="shrink-0 text-ink-300" data-testid="panel-from">
                    from {fmtDate(from)}
                  </span>
                )}
                {selection && <span className="shrink-0 text-ink-300" data-testid="panel-scope">{p.selection ? "Selection" : "Whole chain"}</span>}
              </div>
              <MiniSeries
                dates={dates.slice(start)}
                values={p.nb.slice(start)}
                kind={p.kind}
                primaryLabel={p.pair ? p.pair[0] : p.bqOnly ? "BigQuery" : "NearBlocks"}
                height={height}
                color={p.pair ? "var(--chain-aurora)" : p.bqOnly ? "var(--cat-1)" : "var(--series-usage)"}
                format={(v) => fmtCompact(v)}
                secondary={p.bq ? { values: p.bq.slice(start), label: p.pair ? p.pair[1] : "BigQuery", color: p.pair ? "var(--series-intents)" : "var(--cat-1)" } : undefined}
              />
              </div>
            );
          })}
        </div>
        <RangeBrush dates={windowDates} preview={sliceTail(nb.txns ?? [], n)} color="var(--series-usage)" />
        <p className="mt-2 text-xs text-ink-300">
          {dates.length} days to {fmtDateShort(dates[dates.length - 1])}. Function calls, contracts called and receipts to aurora / intents.near exist only for the BigQuery window.
        </p>
      </div>
    );
  };

  return (
    <ChartCard
      id="chain-activity"
      title="Chain activity"
      takeaway={takeaway + selectionLine}
      scope={selection ? "filtered" : "whole-chain"}
      actions={<RangeControl value={range} onChange={onRangeChange} ariaLabel="Chain activity range" />}
      info="NearBlocks daily charts (transactions, active accounts, new accounts) since 2020 plus the NEAR BigQuery public dataset for the last year, which adds transactions, distinct signers, CREATE_ACCOUNT actions, FUNCTION_CALL receipts, distinct contracts called, and receipts to the aurora and intents.near accounts. Distinct signers are an estimate, since one person can use many accounts, and relayers or intents hide the end user."
      source="NearBlocks daily charts and the NEAR BigQuery public dataset (transactions and receipt_actions)"
      method={{ sentence: "Daily transactions, active accounts and new accounts on NEAR since 2020, with BigQuery function calls, contracts called and receipts to aurora and intents.near for the last year.", queries: [sql("daily_chain", "transactions"), sql("daily_receipts", "receipt_actions"), SPECS.nearblocks] }}
      table={{
        columns: [
          { key: "date", label: "Date" },
          { key: "nbTxns", label: "Txns (NearBlocks)", align: "right" },
          { key: "bqTxns", label: "Txns (BigQuery)", align: "right" },
          { key: "nbActive", label: "Active accts (NearBlocks)", align: "right" },
          { key: "bqActive", label: "Signers (BigQuery)", align: "right" },
          { key: "newAcc", label: "New accts (NearBlocks)", align: "right" },
          { key: "calls", label: selection ? "Function calls to the selection's contracts" : "Function calls", align: "right" },
          { key: "contracts", label: "Contracts called", align: "right" },
          { key: "aurora", label: "Receipts to aurora", align: "right" },
          { key: "intents", label: "Receipts to intents.near", align: "right" },
        ],
        rows: full.dates
          .map((d, i) => ({
            date: d,
            nbTxns: full.panels[0].nb[i],
            bqTxns: full.panels[0].bq?.[i] ?? null,
            nbActive: full.panels[1].nb[i],
            bqActive: full.panels[1].bq?.[i] ?? null,
            newAcc: full.panels[2].nb[i],
            calls: full.panels[3].nb[i],
            contracts: full.panels[4].nb[i],
            aurora: full.panels[5].nb[i],
            intents: full.panels[5].bq?.[i] ?? null,
          }))
          .reverse(),
        filename: `chain-activity-${range}.csv`,
        maxRows: 120,
      }}
    >
      {(frame: ChartFrame) => (total === 0 ? <EmptyState message="No chain activity history yet. Run npm run refresh to fetch it." /> : renderPanels(frame))}
    </ChartCard>
  );
}
