"use client";

import { useMemo } from "react";
import { ChartCard } from "@/components/atlas/chart-card";
import { fmtPct, fmtUsd } from "@/lib/format";
import type { IntentsSummary } from "@/lib/intents";
import { BucketBars, bucketRows, bucketTable, type BucketRow } from "./bucket-bars";
import { EXPLORER_COLOR, EXPLORER_LABEL, EXPLORER_QUERY, TRANSFORM_QUERY } from "./labels";

function windowText(data: IntentsSummary): string {
  const n = data.last30.days;
  return n === 0 ? "no complete days" : n < 30 ? `${n} complete day${n === 1 ? "" : "s"}` : "last 30 complete days";
}

function shareTakeaway(rows: BucketRow[], noun: string, noneText: string, window: string): string {
  if (rows.length === 0) return "No complete Explorer day yet.";
  const top = rows.find((r) => r.kind === "normal");
  const none = rows.find((r) => r.kind === "none");
  const parts: string[] = [];
  if (top) parts.push(`${top.label} is the largest ${noun} with ${fmtPct(top.share)} of 1Click volume (${fmtUsd(top.usd)}) over the ${window}`);
  if (none) parts.push(`${fmtPct(none.share)} of volume ${noneText}`);
  return `${parts.join("; ")}.`;
}

/** Share of 1Click volume by referral tag and by app-fee recipient. */
export function ReferralsCards({ data }: { data: IntentsSummary }) {
  const referrals = useMemo(() => bucketRows(data.referrals, { noneLabel: "no referral tag", caption: "share" }), [data.referrals]);
  const appFees = useMemo(() => bucketRows(data.appFeeRecipients, { noneLabel: "no app fee", caption: "share" }), [data.appFeeRecipients]);
  const window = windowText(data);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ChartCard
      scope="whole-chain"
        id="intents-referrals"
        title="Share by referral"
        takeaway={shareTakeaway(referrals, "referral tag", "carried no referral tag", window)}
        info={`The referral field of each SUCCESS swap, summed by amountInUsd over the Explorer's trailing 30 complete days, ${EXPLORER_LABEL}. Integrators set this tag when they route through 1Click; the muted bar is rows with no tag. The hatched bar is everything beyond the top 12.`}
        table={bucketTable(referrals, "Referral", "1Click volume share by referral tag, Explorer API", "intents-referrals.csv")}
        queries={[EXPLORER_QUERY, TRANSFORM_QUERY]}
        footer={<span>Bar labels show share of window volume, then USD. &ldquo;no referral tag&rdquo; is rows whose referral field was empty.</span>}
      >
        <BucketBars rows={referrals} color={EXPLORER_COLOR} hatchId="hatch-intents-referrals" keyLabel="Referral" ariaLabel="Share of 1Click volume by referral tag" emptyMessage="No complete Explorer days yet." />
      </ChartCard>
      <ChartCard
      scope="whole-chain"
        id="intents-app-fees"
        title="Share by app-fee recipient"
        takeaway={shareTakeaway(appFees, "app-fee recipient", "paid no app fee", window)}
        info={`Accounts named in appFees[].recipient on each SUCCESS swap, summed by the swap's amountInUsd over the Explorer's trailing 30 complete days, ${EXPLORER_LABEL}. A swap with several fee recipients counts once per recipient, so shares can exceed 100% in total. The muted bar is rows with no app fee. The hatched bar is everything beyond the top 12.`}
        table={bucketTable(appFees, "App-fee recipient", "1Click volume share by app-fee recipient, Explorer API", "intents-app-fee-recipients.csv")}
        queries={[EXPLORER_QUERY, TRANSFORM_QUERY]}
        footer={<span>Bar labels show share of window volume, then USD. &ldquo;no app fee&rdquo; is rows whose appFees list was empty.</span>}
      >
        <BucketBars rows={appFees} color="var(--cat-7)" hatchId="hatch-intents-appfees" keyLabel="App-fee recipient" ariaLabel="Share of 1Click volume by app-fee recipient" emptyMessage="No complete Explorer days yet." />
      </ChartCard>
    </div>
  );
}
