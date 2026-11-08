"use client";

import { useMemo } from "react";
import { ChartCard, EmptyState, TvlNote } from "@/components/atlas/chart-card";
import { chainData, meta } from "@/lib/data";
import { fmtDateShort, fmtPctSigned, fmtUsd } from "@/lib/format";
import { rangeDays, RANGE_LONG, sliceTail, type Range } from "@/lib/ranges";
import type { ChainSeriesKey } from "@/lib/types";
import { MiniSeries } from "./mini-series";

const PANELS: Array<{ key: ChainSeriesKey; label: string; kind: "line" | "bar" }> = [
  { key: "tvl", label: "Chain TVL", kind: "line" },
  { key: "volume", label: "Daily DEX volume", kind: "bar" },
  { key: "fees", label: "Daily fees", kind: "bar" },
  { key: "revenue", label: "Daily revenue", kind: "bar" },
];

/** DefiLlama chain-level history for NEAR and Aurora as 2×4 small multiples, each with its own axis. */
export function ChainOverTime({ range }: { range: Range }) {
  const n = rangeDays(range, chainData.dates.length);
  const dates = useMemo(() => sliceTail(chainData.dates, n), [n]);
  const near = chainData.latest.near;
  const aurora = chainData.latest.aurora;
  const chg = (k: ChainSeriesKey) => near.change[k]?.[range === "7d" ? "d7" : range === "30d" ? "d30" : "d90"] ?? null;
  const takeaway =
    chainData.dates.length === 0
      ? "Daily chain history appears after the first refresh run."
      : `NEAR chain TVL ${fmtUsd(near.tvl)} (${fmtPctSigned(chg("tvl"))} over the ${RANGE_LONG[range]}), 30d volume ${fmtUsd(near.volume30d)}, 30d fees ${fmtUsd(near.fees30d)}; Aurora TVL ${fmtUsd(aurora.tvl)}.`;

  const rows = dates.map((d, i) => {
    const r: Record<string, unknown> = { date: d };
    for (const p of PANELS) {
      r[`near_${p.key}`] = chainData.near[p.key][chainData.dates.length - n + i];
      r[`aurora_${p.key}`] = chainData.aurora[p.key][chainData.dates.length - n + i];
    }
    return r;
  });

  return (
    <ChartCard
      id="chain-over-time"
      title="Chain over time"
      takeaway={takeaway}
      scope="whole-chain"
      info="DefiLlama chain-level series. Default chain TVL (excludes liquid staking and bridges), daily DEX volume, fees and revenue summed across every protocol on the chain. Window follows the date range control; the current partial day is excluded from flows."
      footer={<TvlNote />}
      table={{
        columns: [
          { key: "date", label: "Date" },
          ...PANELS.flatMap((p) => [
            { key: `near_${p.key}`, label: `NEAR ${p.label}`, align: "right" as const, format: (v: unknown) => fmtUsd(v as number | null) },
            { key: `aurora_${p.key}`, label: `Aurora ${p.label}`, align: "right" as const, format: (v: unknown) => fmtUsd(v as number | null) },
          ]),
        ],
        rows: [...rows].reverse(),
        filename: `chain-over-time-${range}.csv`,
        maxRows: 120,
      }}
    >
      {chainData.dates.length === 0 ? (
        <EmptyState message="No daily chain history yet. Run npm run refresh to fetch it; the snapshot pages work without it." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PANELS.map((p) => (
            <div key={p.key} className="rounded-lg border border-ink-700/40 p-2">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">{p.label}</span>
                <span className="text-muted-foreground">NEAR</span>
              </div>
              <MiniSeries dates={dates} values={sliceTail(chainData.near[p.key], n)} kind={p.kind} primaryLabel={`NEAR ${p.label}`} height={120} color="var(--chain-near)" format={fmtUsd} />
              <div className="mb-1 mt-2 flex items-center justify-between text-xs">
                <span className="sr-only">{p.label}</span>
                <span className="ml-auto text-muted-foreground">Aurora</span>
              </div>
              <MiniSeries dates={dates} values={sliceTail(chainData.aurora[p.key], n)} kind={p.kind} primaryLabel={`Aurora ${p.label}`} height={90} color="var(--chain-aurora)" format={fmtUsd} />
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {chainData.dates.length ? `${dates.length} days to ${fmtDateShort(dates[dates.length - 1])}` : `Snapshot as of ${meta.snapshotAsOfLabel}`}
      </p>
    </ChartCard>
  );
}
