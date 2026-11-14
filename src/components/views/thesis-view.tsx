"use client";

import { CircleCheck, CircleX, HelpCircle, Lightbulb } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/atlas/chart-card";
import { AnchorCard } from "@/components/thesis/anchor-card";
import { ClaimCard } from "@/components/thesis/claim-card";
import { Confounders } from "@/components/thesis/confounders";
import { CoverageStrip } from "@/components/thesis/coverage-strip";
import { CrossCheckTable } from "@/components/thesis/cross-check-table";
import { ExplorerTest } from "@/components/thesis/explorer-test";
import { LeadLagChart } from "@/components/thesis/lead-lag-chart";
import { LevelsChart } from "@/components/thesis/levels-chart";
import { OosChart } from "@/components/thesis/oos-chart";
import { ReproduceCard } from "@/components/thesis/reproduce-card";
import { ResultsTable } from "@/components/thesis/results-table";
import { BeyondPriceCard, GrangerCard, SignificanceCard } from "@/components/thesis/rigor-cards";
import { RobustnessTable } from "@/components/thesis/robustness-table";
import { TextListCard } from "@/components/thesis/text-list-card";
import { anchorData, thesisData } from "@/lib/data";
import { useFilters } from "@/lib/filters";
import type { ThesisJson } from "@/lib/thesis-types";

function Section({ id, title, lede, children }: { id: string; title: string; lede?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-3">
      <div>
        <h2 id={`${id}-heading`} className="text-title leading-tight">
          {title}
        </h2>
        {lede && <p className="mt-1 max-w-3xl text-sm text-ink-300">{lede}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * The thesis page. Restyled only (CanHav Atlas UI standard); every number
 * and every conclusion comes from thesis.json as computed by scripts/thesis.ts.
 */
export function ThesisView() {
  const { scale, setState } = useFilters();
  if ("reason" in thesisData || !thesisData.available) {
    const reason = "reason" in thesisData ? thesisData.reason : "thesis.json is marked unavailable. Run npm run rebuild.";
    return <EmptyState message={reason} />;
  }
  const data: ThesisJson = thesisData;
  const { verdict } = data;

  return (
    <div className="space-y-10">
      <ClaimCard data={data} />

      <Section id="results" title="Every pre-registered test at a glance" lede="The rules were committed before any of these tests ran. Each row links to its card below.">
        <ResultsTable rows={data.results} />
        <p id="test-verdict-gate" className="max-w-3xl text-xs text-ink-300">
          {verdict.rule}
        </p>
      </Section>

      <Section id="levels" title="Do the series move together at all?" lede="Before any lag test, the raw weekly levels on one indexed axis.">
        <LevelsChart data={data} scale={scale} onScaleChange={(s) => void setState({ scale: s })} />
      </Section>

      <Section id="lead-lag" title="Which predictor moves first?" lede="Correlation of weekly changes at every lag. The claim needs Intents volume to correlate at a positive lag, above the noise band, more strongly than price does.">
        <LeadLagChart data={data} />
      </Section>

      <Section id="oos" title="Does it forecast?" lede="A correlation found on the whole window can be luck. This fits on the early weeks only and scores the late ones.">
        <OosChart data={data} />
      </Section>

      <Section id="rigor" title="Is the lead more than noise?" lede="A fixed noise band is a rough guide. These tests put a p-value on the lead, ask whether Intents adds anything once price is known, and check which way the relationship runs.">
        <div className="space-y-8">
          <SignificanceCard data={data} />
          <BeyondPriceCard data={data} />
          <GrangerCard data={data} />
        </div>
      </Section>

      <Section id="robustness" title="Does the result survive the obvious objections?" lede="Spikes, settlement counting itself as usage, and the week boundary.">
        <RobustnessTable data={data} />
      </Section>

      <Section id="explorer-test" title="Does it hold with the Explorer as the source?" lede="The track names the NEAR Intents Explorer API. It covers 1Click swaps only and a shorter window, so the same two tests are run on it alone.">
        <ExplorerTest data={data} />
      </Section>

      <Section id="cross-check" title="Do two sources agree on chain usage?" lede="Transactions and active accounts are counted from BigQuery and again from NearBlocks. Only the BigQuery rows enter the verdict.">
        <CrossCheckTable data={data} />
      </Section>

      <Section id="coverage" title="Which Intents measure is this?" lede="Two sources exist for Intents volume; this is how much of one the other sees.">
        <CoverageStrip data={data} />
      </Section>

      <Section id="confounders" title="What else moved these series?">
        <Confounders items={data.confounders} />
      </Section>

      <Section id="evidence" title="Verdict, both sides">
        <div className="grid gap-4 md:grid-cols-2">
          <TextListCard title="Evidence for" note="Generated from the tests above; each line names the series, the lag and the correlation or R² it rests on." items={verdict.evidenceFor} icon={CircleCheck} iconColor="var(--up)" />
          <TextListCard title="Evidence against" note="Everything that cuts the other way, including the inconclusive series." items={verdict.evidenceAgainst} icon={CircleX} iconColor="var(--down)" />
        </div>
      </Section>

      <Section id="falsify" title="How this could be wrong">
        <div className="grid gap-4 md:grid-cols-2">
          <TextListCard title="What would change my mind" note="Concrete thresholds the daily refresh can hit." items={verdict.changeMyMind} icon={Lightbulb} iconColor="var(--ink-secondary)" />
          <TextListCard title="Data gaps and metrics that could not be computed" note="Known limits of the free sources used." items={verdict.gaps} icon={HelpCircle} iconColor="var(--ink-muted)" />
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnchorCard data={anchorData} />
        <ReproduceCard />
      </div>
    </div>
  );
}
