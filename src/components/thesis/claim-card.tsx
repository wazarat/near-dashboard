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
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export function ClaimCard({ data }: { data: ThesisJson }) {
  const { verdict, window, bigqueryWindow, cutoff, sources, asOf } = data;
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="gap-2 px-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Claim</span>
          <VerdictBadge supported={verdict.supported} />
          <span className="text-xs text-muted-foreground">as of {fmtDate(asOf)}</span>
        </div>
        <h2 className="text-lg font-semibold leading-snug sm:text-xl">{CLAIM}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Result: </span>
          {verdict.headline}
        </p>
      </CardHeader>
      <CardContent className="px-4">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Window">
            {fmtDate(window.start)} to {fmtDate(window.end)} ({window.weeks} ISO weeks)
            {bigqueryWindow.start && bigqueryWindow.end && (
              <span className="block text-xs text-muted-foreground">
                BigQuery series: {fmtDate(bigqueryWindow.start)} to {fmtDate(bigqueryWindow.end)} ({bigqueryWindow.weeks} weeks)
              </span>
            )}
          </Fact>
          <Fact label="Out-of-sample cutoff">
            Fit before {fmtDate(cutoff)}, scored from {fmtDate(cutoff)} onward
            <span className="block text-xs text-muted-foreground">Lags tested: −{data.maxLag} to +{data.maxLag} weeks</span>
          </Fact>
          <Fact label="Sources">
            <ul className="space-y-0.5 text-xs">
              <li>
                <span className="text-muted-foreground">Intents: </span>
                {sources.intents}
              </li>
              <li>
                <span className="text-muted-foreground">Price: </span>
                {sources.price}
              </li>
              <li>
                <span className="text-muted-foreground">Usage: </span>
                {sources.usage.join("; ")}
              </li>
            </ul>
          </Fact>
          <Fact label="Write-up">
            <a
              href={THESIS_MD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-sm underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              THESIS.md on GitHub <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
            <span className="block text-xs text-muted-foreground">Same numbers as this page, rendered as Markdown with the queries behind them.</span>
          </Fact>
        </dl>
      </CardContent>
    </Card>
  );
}
