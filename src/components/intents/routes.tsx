"use client";

import { useMemo } from "react";
import { ChartCard } from "@/components/atlas/chart-card";
import { fmtInt, fmtPct, fmtUsd } from "@/lib/format";
import type { IntentsSummary } from "@/lib/intents";
import { BucketBars, bucketRows, bucketTable, topShare } from "./bucket-bars";
import { EXPLORER_COLOR, EXPLORER_LABEL, EXPLORER_QUERY, TRANSFORM_QUERY } from "./labels";

export function routeLabel(key: string): string {
  const [from, to] = key.split(">");
  return to === undefined ? key : `${from} → ${to}`;
}

function windowText(data: IntentsSummary): string {
  const n = data.last30.days;
  return n === 0 ? "no complete days" : n < 30 ? `${n} complete day${n === 1 ? "" : "s"}` : "last 30 complete days";
}

/** Top origin → destination chain routes by SUCCESS volume over the Explorer's trailing 30 complete days. */
export function RoutesChart({ data }: { data: IntentsSummary }) {
  const rows = useMemo(() => bucketRows(data.routes, { label: routeLabel }), [data.routes]);
  const window = windowText(data);

  const takeaway = useMemo(() => {
    if (rows.length === 0) return "No complete Explorer day yet, so there are no route totals.";
    const top = rows[0];
    const top3 = topShare(rows, 3);
    const other = rows.find((r) => r.kind === "other");
    return `${top.label} is the largest route with ${fmtPct(top.share)} of 1Click volume over the ${window} (${fmtUsd(top.usd)} across ${fmtInt(top.count)} swaps)${top3 !== null ? `; the top 3 routes hold ${fmtPct(top3)}` : ""}${other ? ` and the long tail ${fmtPct(other.share)}` : ""}.`;
  }, [rows, window]);

  return (
    <ChartCard
      scope="whole-chain"
      title="Top routes"
      takeaway={takeaway}
      info={`Origin chain → destination chain of each SUCCESS swap, summed by amountInUsd over the Explorer's trailing 30 complete days, ${EXPLORER_LABEL}. Chain ids are the Explorer's asset prefixes (eth, tron, sol, btc, near, 1cs_v1 and so on). The hatched bar folds the long tail beyond the top 15 together with routes the per-day files already grouped as (other).`}
      table={bucketTable(rows, "Route", "Top routes by 1Click volume, Explorer API", "intents-routes.csv")}
      queries={[EXPLORER_QUERY, TRANSFORM_QUERY]}
      footer={<span>Volume is amountInUsd of SUCCESS swaps only, over the {window}. Shares are of total volume in that window, including the (other) bucket.</span>}
    >
      <BucketBars rows={rows} color={EXPLORER_COLOR} hatchId="hatch-intents-routes" keyLabel="Route" ariaLabel="Top origin to destination chain routes by 1Click volume" emptyMessage="No complete Explorer days to rank routes from yet." />
    </ChartCard>
  );
}

/** Two small lists: volume by origin chain and by destination chain. */
export function ChainsCards({ data }: { data: IntentsSummary }) {
  const origin = useMemo(() => bucketRows(data.originChains), [data.originChains]);
  const dest = useMemo(() => bucketRows(data.destinationChains), [data.destinationChains]);
  const window = windowText(data);

  const takeawayFor = (rows: ReturnType<typeof bucketRows>, side: "from" | "to") => {
    if (rows.length === 0) return "No complete Explorer day yet.";
    const top = rows[0];
    const top2 = topShare(rows, 2);
    return `${fmtPct(top.share)} of 1Click volume over the ${window} ${side === "from" ? "left" : "landed on"} ${top.label}${top2 !== null && rows.length > 1 ? `; the top 2 chains ${side === "from" ? "sent" : "received"} ${fmtPct(top2)}` : ""}.`;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ChartCard
      scope="whole-chain"
        title="Origin chains"
        takeaway={takeawayFor(origin, "from")}
        info={`Chain the deposit came from, by amountInUsd of SUCCESS swaps over the Explorer's trailing 30 complete days, ${EXPLORER_LABEL}. The hatched bar is everything beyond the top 12.`}
        table={bucketTable(origin, "Origin chain", "1Click volume by origin chain, Explorer API", "intents-origin-chains.csv")}
        queries={[EXPLORER_QUERY, TRANSFORM_QUERY]}
      >
        <BucketBars rows={origin} color="var(--cat-6)" hatchId="hatch-intents-origin-chains" keyLabel="Origin chain" ariaLabel="1Click volume by origin chain" emptyMessage="No complete Explorer days yet." />
      </ChartCard>
      <ChartCard
      scope="whole-chain"
        title="Destination chains"
        takeaway={takeawayFor(dest, "to")}
        info={`Chain the swap paid out on, by amountInUsd of SUCCESS swaps over the Explorer's trailing 30 complete days, ${EXPLORER_LABEL}. The hatched bar is everything beyond the top 12.`}
        table={bucketTable(dest, "Destination chain", "1Click volume by destination chain, Explorer API", "intents-destination-chains.csv")}
        queries={[EXPLORER_QUERY, TRANSFORM_QUERY]}
      >
        <BucketBars rows={dest} color="var(--cat-7)" hatchId="hatch-intents-dest-chains" keyLabel="Destination chain" ariaLabel="1Click volume by destination chain" emptyMessage="No complete Explorer days yet." />
      </ChartCard>
    </div>
  );
}
