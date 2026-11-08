"use client";

import { Info } from "lucide-react";
import { EmptyState } from "@/components/atlas/chart-card";
import { EstimateLabel } from "@/components/atlas/estimate-label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtDateShort, fmtInt, fmtPct, fmtUsd, fmtUsdFull } from "@/lib/format";
import type { IntentsSummary } from "@/lib/intents";
import { EXPLORER_LABEL, LLAMA_LABEL } from "./labels";

interface Tile {
  label: string;
  value: string;
  sub: string;
  info: string;
  full?: string;
  estimate?: string;
}

/** KPI tiles for the Explorer's trailing 30 complete days. */
export function IntentsKpis({ data }: { data: IntentsSummary }) {
  const { last30, coverage } = data;
  if (!data.available) {
    return (
      <EmptyState message="No 1Click swap history from the Explorer API yet. The backfill needs NEAR_INTENTS_JWT and runs with npm run refresh; until it lands, the charts below show DefiLlama's all-channel NEAR Intents series." />
    );
  }
  if (last30.days === 0) {
    return (
      <EmptyState
        message={`The Explorer has ${coverage.days} day${coverage.days === 1 ? "" : "s"} so far but none is complete yet, so there are no 30-day figures. Partial days are drawn hatched in the charts below; DefiLlama's all-channel series is shown alongside.`}
      />
    );
  }

  const n = last30.days;
  const span = last30.from && last30.to ? `${fmtDateShort(last30.from)} – ${fmtDateShort(last30.to)}` : "";
  const window = n < 30 ? `over ${n} day${n === 1 ? "" : "s"}` : "last 30 complete days";
  const windowSub = span ? `${window} · ${span}` : window;

  const tiles: Tile[] = [
    {
      label: "30d 1Click volume",
      value: fmtUsd(last30.volumeUsd),
      sub: windowSub,
      full: fmtUsdFull(last30.volumeUsd),
      info: `Sum of amountInUsd for swaps with status SUCCESS, ${EXPLORER_LABEL}, over the trailing complete Explorer days (${n} of a possible 30). Partial days are excluded.`,
    },
    {
      label: "Swaps",
      value: fmtInt(last30.swaps),
      sub: `SUCCESS status · ${window}`,
      info: `Count of 1Click swaps with status SUCCESS over the same ${n}-day window. Refunded, failed and pending rows are not counted here; their rates are in the success-rate tile.`,
    },
    {
      label: "Unique recipients",
      value: fmtInt(last30.uniqueRecipients),
      sub: `recipient hash, estimate · ${window}`,
      estimate: "Distinct sha256(recipient) per UTC day, summed across days. One person can use many addresses, and the same address on two days counts twice, so this is an upper-bound estimate of people.",
      info: `Daily distinct recipient hashes summed over ${n} day${n === 1 ? "" : "s"}, ${EXPLORER_LABEL}. The raw address is hashed before it is stored.`,
    },
    {
      label: "Median swap size",
      value: fmtUsd(last30.medianUsd, { digits: 0 }),
      sub: `median of daily medians · ${window}`,
      full: last30.medianUsd === null ? undefined : fmtUsdFull(last30.medianUsd),
      info: `Each day's median amountInUsd across SUCCESS swaps, then the median of those ${n} daily values. Not a pooled median: the per-swap rows are not kept in the committed data.`,
    },
    {
      label: "Success rate",
      value: fmtPct(last30.successRate, 1),
      sub: `refunded ${fmtPct(last30.refundRate, 1)} · failed ${fmtPct(last30.failRate, 2)}`,
      info: `SUCCESS rows divided by all rows the Explorer returned for the window. Refunded = REFUNDED / rows; failed = (FAILED + INCOMPLETE_DEPOSIT) / rows. Pending and processing rows make up the remainder.`,
    },
    {
      label: "DefiLlama 30d volume",
      value: fmtUsd(last30.llamaVolume),
      sub: last30.llamaVolume === null ? `DefiLlama missing for part of the window` : `1Click share of all-channel volume ${fmtPct(last30.ratio)} · ${window}`,
      full: last30.llamaVolume === null ? undefined : fmtUsdFull(last30.llamaVolume),
      info: `${LLAMA_LABEL}: DefiLlama's "NEAR Intents" daily volume summed over the same ${n} day${n === 1 ? "" : "s"}. The ratio is Explorer volume divided by DefiLlama volume; DefiLlama covers every channel, the Explorer only 1Click swaps.`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs text-muted-foreground">{t.estimate ? <EstimateLabel note={t.estimate}>{t.label}</EstimateLabel> : t.label}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="shrink-0 rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`About ${t.label}`}>
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs leading-relaxed">{t.info}</TooltipContent>
            </Tooltip>
          </div>
          <div className="mt-1 text-2xl font-semibold leading-none tracking-tight" title={t.full}>
            {t.value}
          </div>
          <div className="mt-1.5 truncate text-xs text-muted-foreground" title={t.sub}>
            {t.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
