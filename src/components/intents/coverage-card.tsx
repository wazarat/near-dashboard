"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { fmtDate, fmtInt, fmtPct, fmtUsd } from "@/lib/format";

const fmtUsdShort = (v: number) => (v < 1000 ? `$${v.toFixed(0)}` : fmtUsd(v));
import type { Series } from "@/lib/history-types";
import type { IntentsSummary } from "@/lib/intents";
import { EXPLORER_LABEL, LLAMA_LABEL } from "./labels";

/** What each source covers, so a reader can tell how much of the page rests on the Explorer backfill. */
export function CoverageCard({ data }: { data: IntentsSummary & { llamaDaily: Series } }) {
  const { coverage, ratioStats, llamaDaily } = data;
  const llamaFirst = llamaDaily[0]?.[0] ?? null;
  const llamaLast = llamaDaily.at(-1)?.[0] ?? null;
  const backfill = !data.available ? "not started (needs NEAR_INTENTS_JWT)" : coverage.backfillDone ? "complete" : "running, older days are still being fetched";

  const items: Array<{ label: string; value: string; note?: string }> = [
    { label: "First Explorer day", value: coverage.firstDay ? fmtDate(coverage.firstDay) : "none yet", note: EXPLORER_LABEL },
    { label: "Last Explorer day", value: coverage.lastDay ? fmtDate(coverage.lastDay) : "none yet" },
    {
      label: "Explorer days",
      value: `${fmtInt(coverage.days)}`,
      note: coverage.days ? `${fmtInt(coverage.completeDays)} complete · ${fmtInt(coverage.partialDays)} partial` : undefined,
    },
    { label: "Backfill", value: backfill },
    {
      label: "1Click / DefiLlama ratio",
      value: ratioStats.days ? `median ${fmtPct(ratioStats.median)} · mean ${fmtPct(ratioStats.mean)} · latest ${fmtPct(ratioStats.latest)}` : "no complete day overlaps DefiLlama yet",
      note: ratioStats.days ? `over ${fmtInt(ratioStats.days)} complete day${ratioStats.days === 1 ? "" : "s"} with both sources` : undefined,
    },
    {
      label: "DefiLlama series",
      value: llamaFirst && llamaLast ? `${fmtDate(llamaFirst)} → ${fmtDate(llamaLast)}` : "not fetched yet",
      note: llamaDaily.length ? `${fmtInt(llamaDaily.length)} days · ${LLAMA_LABEL}` : undefined,
    },
  ];

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="gap-1 px-4">
        <h3 className="text-sm font-semibold leading-tight">Coverage</h3>
        <p className="text-sm text-muted-foreground">
          The Explorer API covers 1Click swaps only and starts in late May 2025{coverage.firstDay ? `; the committed backfill currently reaches back to ${fmtDate(coverage.firstDay)}` : ""}. DefiLlama&apos;s NEAR Intents series covers every channel
          {llamaFirst ? ` and starts ${fmtDate(llamaFirst)}` : ""}. Where both exist, the ratio below says how much of the all-channel volume 1Click swaps account for.
        </p>
      </CardHeader>
      <CardContent className="px-4">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => (
            <div key={it.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{it.label}</dt>
              <dd className="mt-0.5 text-sm font-medium">{it.value}</dd>
              {it.note && <dd className="truncate text-xs text-muted-foreground" title={it.note}>{it.note}</dd>}
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Volume on this page is amountInUsd of SUCCESS swaps only. Partial days (the backfill cursor stopped inside the day, or the day is still open) are excluded from every 30-day and weekly figure and drawn hatched in the daily chart. Recipient counts are
          hashes of the recipient address, so they estimate addresses, not people.
        </p>
        {data.anomalies.length > 0 && (
          <div className="mt-3 rounded-md border border-dashed p-3 text-xs">
            <p className="font-medium text-foreground">Unusual refund days</p>
            <p className="mt-0.5 text-muted-foreground">
              Complete days whose refund share is at least five times the median and above 10%. They stay in every figure; this note exists so a reader sees them rather than infers them.
            </p>
            <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
              {data.anomalies.map((a) => (
                <li key={a.date}>
                  {fmtDate(a.date)}, {fmtPct(a.refundRate)} of {fmtInt(a.rows)} swaps refunded{a.medianUsd !== null ? `, median successful swap ${fmtUsdShort(a.medianUsd)}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
