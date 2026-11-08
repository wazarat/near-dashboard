import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { fmtDate } from "@/lib/format";
import type { ThesisJson } from "@/lib/thesis-types";
import { THESIS_MD_URL } from "./palette";
import { VerdictBadge } from "./verdict-badge";

export const CLAIM = "Cross-chain volume through NEAR Intents is a better leading indicator of real NEAR network usage than token price.";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-label uppercase tracking-wider text-ink-300">{label}</dt>
      <dd className="mt-1 text-sm text-ink-100">{children}</dd>
    </div>
  );
}

/** The claim, the computed verdict and the facts behind it. Every number comes from thesis.json; this file only lays them out. */
export function ClaimCard({ data }: { data: ThesisJson }) {
  const { verdict, window, bigqueryWindow, cutoff, sources, asOf } = data;
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="gap-3 px-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-label uppercase tracking-wider text-ink-300">Claim</span>
          <VerdictBadge supported={verdict.supported} />
          <span className="text-label text-ink-300">as of {fmtDate(asOf)}</span>
        </div>
        <h2 className="text-title leading-snug sm:text-title-lg">{CLAIM}</h2>
        <p className="text-sm leading-relaxed text-ink-200">
          <span className="font-medium text-ink-50">Result. </span>
          {verdict.headline}
        </p>
      </CardHeader>
      <CardContent className="px-5">
        <dl className="grid gap-4 border-t border-ink-700/40 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Window">
            {fmtDate(window.start)} to {fmtDate(window.end)} ({window.weeks} ISO weeks)
            {bigqueryWindow.start && bigqueryWindow.end && (
              <span className="block text-xs text-ink-300">
                BigQuery series {fmtDate(bigqueryWindow.start)} to {fmtDate(bigqueryWindow.end)} ({bigqueryWindow.weeks} weeks)
              </span>
            )}
          </Fact>
          <Fact label="Out-of-sample cutoff">
            Fit before {fmtDate(cutoff)}, scored from {fmtDate(cutoff)} onward
            <span className="block text-xs text-ink-300">
              Lags tested, −{data.maxLag} to +{data.maxLag} weeks
            </span>
          </Fact>
          <Fact label="Sources">
            <ul className="space-y-0.5 text-xs">
              <li>
                <span className="text-ink-300">Intents </span>
                {sources.intents}
              </li>
              <li>
                <span className="text-ink-300">Price </span>
                {sources.price}
              </li>
              <li>
                <span className="text-ink-300">Usage </span>
                {sources.usage.join("; ")}
              </li>
            </ul>
          </Fact>
          <Fact label="Write-up">
            <a
              href={THESIS_MD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-sm text-electric-400 underline-offset-4 hover:text-electric-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60"
            >
              THESIS.md on GitHub <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
            <span className="block text-xs text-ink-300">Same numbers as this page, rendered as Markdown with the queries behind them.</span>
          </Fact>
        </dl>
      </CardContent>
    </Card>
  );
}
