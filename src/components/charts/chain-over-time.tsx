"use client";

import { ChartCard, EmptyState, TvlNote } from "@/components/atlas/chart-card";
import { frameHeight, type ChartFrame } from "@/components/atlas/chart-frame";
import { RangeBrush } from "@/components/atlas/range-brush";
import { RangeControl } from "@/components/atlas/range-control";
import { brushSlice, fittedDomain, levelWindow, rangeStats } from "@/lib/chart-frame";
import { chainData, meta, sql } from "@/lib/data";
import { fmtCompact, fmtDateShort, fmtPctSigned, fmtUsd } from "@/lib/format";
import { rangeDays, RANGE_LONG, sliceTail, type Range } from "@/lib/ranges";
import type { ChainSeriesKey } from "@/lib/types";
import type { Project } from "@/lib/types";
import { MiniSeries } from "./mini-series";
import { SelectionOverTime } from "./selection-over-time";
import { SPECS } from "@/lib/query-specs";

const PANELS: Array<{ key: ChainSeriesKey; label: string; kind: "line" | "bar"; count?: boolean }> = [
  { key: "tvl", label: "Chain TVL", kind: "line" },
  { key: "volume", label: "Daily DEX volume", kind: "bar" },
  { key: "fees", label: "Protocol fees", kind: "bar" },
  { key: "gasFees", label: "Gas fees", kind: "bar" },
  { key: "revenue", label: "Protocol revenue", kind: "bar" },
  { key: "txns", label: "Transactions", kind: "bar", count: true },
];

type Chain = "near" | "aurora";
const CHAIN_LABEL: Record<Chain, string> = { near: "NEAR", aurora: "Aurora" };
const CHAIN_COLOR: Record<Chain, string> = { near: "var(--chain-near)", aurora: "var(--chain-aurora)" };

/**
 * DefiLlama chain-level history for NEAR and Aurora as 2×4 small multiples,
 * each with its own axis. TVL is a level series (fitted axis, 90-day floor,
 * "From zero" toggle); volume, fees and revenue are flows that start at zero
 * and follow the card's own range control (standard sections 4 and 6).
 */
export function ChainOverTime({ range, onRangeChange, selection = null }: { range: Range; onRangeChange: (r: Range) => void; /** With a filter set, the selected projects; the card then shows their own summed history. */ selection?: Project[] | null }) {
  if (selection) return <SelectionOverTime projects={selection} range={range} onRangeChange={onRangeChange} />;
  return <ChainTotals range={range} onRangeChange={onRangeChange} />;
}

function ChainTotals({ range, onRangeChange }: { range: Range; onRangeChange: (r: Range) => void }) {
  const total = chainData.dates.length;
  const flowN = rangeDays(range, total);
  const levelN = levelWindow(range, total);
  const levelDates = sliceTail(chainData.dates, levelN);

  const near = chainData.latest.near;
  const aurora = chainData.latest.aurora;
  const chg = (k: ChainSeriesKey) => near.change[k]?.[range === "7d" ? "d7" : range === "30d" ? "d30" : "d90"] ?? null;
  const takeaway =
    total === 0
      ? "Daily chain history appears after the first refresh run."
      : `NEAR chain TVL ${fmtUsd(near.tvl)} (${fmtPctSigned(chg("tvl"))} over the ${RANGE_LONG[range]}), 30d volume ${fmtUsd(near.volume30d)}, 30d fees ${fmtUsd(near.fees30d)}; Aurora TVL ${fmtUsd(aurora.tvl)}.`;
  const subtitle = total === 0 ? undefined : levelN !== flowN ? `TVL shown over ${levelN} days so the level has shape to read, flows follow the range control (${RANGE_LONG[range]})` : `Every panel covers the ${RANGE_LONG[range]}`;

  const rows = levelDates.map((d, i) => {
    const r: Record<string, unknown> = { date: d };
    for (const p of PANELS) {
      r[`near_${p.key}`] = chainData.near[p.key][total - levelN + i];
      r[`aurora_${p.key}`] = chainData.aurora[p.key][total - levelN + i];
    }
    return r;
  });

  const renderPanels = (frame: ChartFrame) => {
    const nearHeight = frameHeight(frame, 120, 240);
    const auroraHeight = frameHeight(frame, 90, 180);
    const brushed = frame.brushRange !== null;
    const panelData = (chain: Chain, key: ChainSeriesKey, kind: "line" | "bar") => {
      const n = brushed || kind === "line" ? levelN : flowN;
      return {
        dates: brushSlice(sliceTail(chainData.dates, n), frame.brushRange),
        values: brushSlice(sliceTail(chainData[chain][key], n), frame.brushRange),
      };
    };
    return (
      <>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PANELS.map((p) => (
            <div key={p.key} className="rounded-lg border border-ink-700/40 p-2">
              {(p.key === "revenue" ? (["near"] as Chain[]) : (["near", "aurora"] as Chain[])).map((chain) => {
                const { dates, values } = panelData(chain, p.key, p.kind);
                const level = p.kind === "line";
                const stats = level ? rangeStats(dates, values) : null;
                return (
                  <div key={chain} className={chain === "aurora" ? "mt-2" : undefined}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className={chain === "near" ? "font-medium" : "sr-only"}>{p.label}</span>
                      <span className="ml-auto text-ink-300">{CHAIN_LABEL[chain]}</span>
                    </div>
                    <MiniSeries
                      dates={dates}
                      values={values}
                      kind={p.kind}
                      primaryLabel={`${CHAIN_LABEL[chain]} ${p.label}`}
                      height={p.key === "revenue" ? nearHeight + auroraHeight + 28 : chain === "near" ? nearHeight : auroraHeight}
                      color={CHAIN_COLOR[chain]}
                      format={p.count ? fmtCompact : fmtUsd}
                      yDomain={level && !frame.startAtZero ? fittedDomain(values) : undefined}
                    />
                    {stats && (
                      <p className="mt-1 text-label text-ink-300" data-testid="range-stats">
                        Low {fmtUsd(stats.min)}, high {fmtUsd(stats.max)}, {fmtPctSigned(stats.change)} over {dates.length} days
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <RangeBrush dates={levelDates} preview={sliceTail(chainData.near.tvl, levelN)} color="var(--chain-near)" />
        <p className="mt-2 text-xs text-ink-300">
          {total ? `${levelDates.length} days to ${fmtDateShort(levelDates[levelDates.length - 1])}` : `Snapshot as of ${meta.snapshotAsOfLabel}`}
        </p>
      </>
    );
  };

  return (
    <ChartCard
      id="chain-over-time"
      method={{ sentence: "Daily chain-wide TVL, DEX volume, protocol fees, gas fees, revenue and transactions for NEAR and Aurora.", queries: [SPECS.llamaChainTvl, SPECS.llamaChainFlows, SPECS.chainTxns, sql("daily_receipts", "receipt_actions"), SPECS.chainGaps] }}
      title="Chain over time"
      takeaway={takeaway}
      subtitle={subtitle}
      scope="whole-chain"
      level
      info="DefiLlama chain-level series. Default chain TVL (excludes liquid staking and bridges), and daily DEX volume, protocol fees and protocol revenue summed across every protocol on the chain. Gas fees are the chain's own gas from DefiLlama's chain fee summary, which the protocol sum leaves out. Transactions come from NearBlocks for NEAR and Aurora Blockscout for Aurora. A day a source reports as 0 where that cannot be true (gas fees, transactions) is drawn as a gap, not a dip. TVL keeps at least 90 days in view; flows follow this card's range control and exclude the current partial day."
      actions={<RangeControl value={range} onChange={onRangeChange} ariaLabel="Chain over time range" />}
      source="DefiLlama chain TVL, the NEAR and Aurora DEX, fees and revenue overviews and chain fee summaries, NearBlocks and Aurora Blockscout transactions, daily"
      footer={<TvlNote />}
      table={{
        columns: [
          { key: "date", label: "Date" },
          ...PANELS.flatMap((p) => {
            const format = (v: unknown) => (p.count ? fmtCompact(v as number | null) : fmtUsd(v as number | null));
            const cols = [{ key: `near_${p.key}`, label: `NEAR ${p.label}`, align: "right" as const, format }];
            // Aurora has no daily revenue series, so its revenue panel and column are left out.
            if (p.key !== "revenue") cols.push({ key: `aurora_${p.key}`, label: `Aurora ${p.label}`, align: "right" as const, format });
            return cols;
          }),
        ],
        rows: [...rows].reverse(),
        filename: `chain-over-time-${range}.csv`,
        maxRows: 120,
      }}
    >
      {(frame: ChartFrame) => (total === 0 ? <EmptyState message="No daily chain history yet. Run npm run refresh to fetch it; the snapshot pages work without it." /> : renderPanels(frame))}
    </ChartCard>
  );
}
