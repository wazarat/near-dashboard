"use client";

import { useMemo } from "react";
import { ChartCard } from "@/components/atlas/chart-card";
import { fmtPct, fmtUsd } from "@/lib/format";
import type { IntentsSummary } from "@/lib/intents";
import { BucketBars, bucketRows, bucketTable, topShare, type BucketRow } from "./bucket-bars";
import { EXPLORER_LABEL, EXPLORER_QUERY, TRANSFORM_QUERY } from "./labels";

function windowText(data: IntentsSummary): string {
  const n = data.last30.days;
  return n === 0 ? "no complete days" : n < 30 ? `${n} complete day${n === 1 ? "" : "s"}` : "last 30 complete days";
}

function assetTakeaway(rows: BucketRow[], side: "sold" | "bought", window: string): string {
  if (rows.length === 0) return "No complete Explorer day yet.";
  const top = rows[0];
  const top3 = topShare(rows, 3);
  return `${top.label} was the most ${side} asset with ${fmtPct(top.share)} of 1Click volume (${fmtUsd(top.usd)}) over the ${window}${top3 !== null && rows.length > 2 ? `; the top 3 assets cover ${fmtPct(top3)}` : ""}.`;
}

/** Origin and destination asset buckets side by side. */
export function AssetsCards({ data }: { data: IntentsSummary }) {
  const origin = useMemo(() => bucketRows(data.originAssets), [data.originAssets]);
  const dest = useMemo(() => bucketRows(data.destinationAssets), [data.destinationAssets]);
  const window = windowText(data);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ChartCard
      scope="whole-chain"
        title="Origin assets"
        takeaway={assetTakeaway(origin, "sold", window)}
        info={`originAsset of each SUCCESS swap, summed by amountInUsd over the Explorer's trailing 30 complete days, ${EXPLORER_LABEL}. Keys are the Explorer's asset ids (NEP-141 account ids such as …omft.near, or chain:address pairs), shortened in the per-day files; hover a label for the stored key. The hatched bar is everything beyond the top 12.`}
        table={bucketTable(origin, "Origin asset", "1Click volume by origin asset, Explorer API", "intents-origin-assets.csv")}
        queries={[EXPLORER_QUERY, TRANSFORM_QUERY]}
      >
        <BucketBars rows={origin} color="var(--cat-6)" hatchId="hatch-intents-origin-assets" keyLabel="Origin asset" ariaLabel="1Click volume by origin asset" emptyMessage="No complete Explorer days yet." />
      </ChartCard>
      <ChartCard
      scope="whole-chain"
        title="Destination assets"
        takeaway={assetTakeaway(dest, "bought", window)}
        info={`destinationAsset of each SUCCESS swap, summed by the swap's amountInUsd over the Explorer's trailing 30 complete days, ${EXPLORER_LABEL}. Keys are the Explorer's asset ids, shortened in the per-day files; hover a label for the stored key. The hatched bar is everything beyond the top 12.`}
        table={bucketTable(dest, "Destination asset", "1Click volume by destination asset, Explorer API", "intents-destination-assets.csv")}
        queries={[EXPLORER_QUERY, TRANSFORM_QUERY]}
      >
        <BucketBars rows={dest} color="var(--cat-7)" hatchId="hatch-intents-dest-assets" keyLabel="Destination asset" ariaLabel="1Click volume by destination asset" emptyMessage="No complete Explorer days yet." />
      </ChartCard>
    </div>
  );
}
