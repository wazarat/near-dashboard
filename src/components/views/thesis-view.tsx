"use client";

import { CircleCheck, CircleX, HelpCircle, Lightbulb } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/atlas/chart-card";
import { ClaimCard } from "@/components/thesis/claim-card";
import { Confounders } from "@/components/thesis/confounders";
import { CoverageStrip } from "@/components/thesis/coverage-strip";
import { LeadLagChart } from "@/components/thesis/lead-lag-chart";
import { LevelsChart } from "@/components/thesis/levels-chart";
import { OosChart } from "@/components/thesis/oos-chart";
import { ReproduceCard } from "@/components/thesis/reproduce-card";
import { RobustnessTable } from "@/components/thesis/robustness-table";
import { TextListCard } from "@/components/thesis/text-list-card";
import { thesisData } from "@/lib/data";
import { useFilters } from "@/lib/filters";
import type { ThesisJson } from "@/lib/thesis-types";

function Section({ id, title, lede, children }: { id: string; title: string; lede?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-3">
      <div>
        <h2 id={`${id}-heading`} className="text-base font-semibold leading-tight">
          {title}
        </h2>
        {lede && <p className="mt-1 text-sm text-muted-foreground">{lede}</p>}
      </div>
      {children}
    </section>
  );
}

export function ThesisView() {
  const { scale, setState } = useFilters();
  if ("reason" in thesisData || !thesisData.available) {
    const reason = "reason" in thesisData ? thesisData.reason : "thesis.json is marked unavailable. Run npm run rebuild.";
    return <EmptyState message={reason} />;
  }
  const data: ThesisJson = thesisData;
  const { verdict } = data;

  return (
    <div className="space-y-6">
      <ClaimCard data={data} />

      <Section id="levels" title="Do the series move together at all?" lede="Before any lag test, the raw weekly levels on one indexed axis.">
        <LevelsChart data={data} scale={scale} onScaleChange={(s) => void setState({ scale: s })} />
      </Section>

      <Section id="lead-lag" title="Which predictor moves first?" lede="Correlation of weekly changes at every lag. The claim needs Intents volume to correlate at a positive lag, above the noise band, more strongly than price does.">
        <LeadLagChart data={data} />
      </Section>

      <Section id="oos" title="Does it forecast?" lede="A correlation found on the whole window can be luck. This fits on the early weeks only and scores the late ones.">
        <OosChart data={data} />
      </Section>

      <Section id="robustness" title="Does the result survive the obvious objections?" lede="Spikes, settlement counting itself as usage, and the week boundary.">
        <RobustnessTable data={data} />
      </Section>

      <Section id="coverage" title="Which Intents measure is this?" lede="Two sources exist for Intents volume; this is how much of one the other sees.">
        <CoverageStrip data={data} />
      </Section>

      <Section id="confounders" title="What else moved these series?">
        <Confounders items={data.confounders} />
      </Section>

      <Section id="evidence" title="Verdict, both sides">
        <div className="grid gap-4 md:grid-cols-2">
          <TextListCard title="Evidence for" note="Generated from the tests above; each line names the series, the lag and the correlation or R² it rests on." items={verdict.evidenceFor} icon={CircleCheck} iconColor="var(--status-good)" />
          <TextListCard title="Evidence against" note="Everything that cuts the other way, including the inconclusive series." items={verdict.evidenceAgainst} icon={CircleX} iconColor="var(--status-critical)" />
        </div>
      </Section>

      <Section id="falsify" title="How this could be wrong">
        <div className="grid gap-4 md:grid-cols-2">
          <TextListCard title="What would change my mind" note="Concrete thresholds the daily refresh can hit." items={verdict.changeMyMind} icon={Lightbulb} iconColor="var(--status-warning)" />
          <TextListCard title="Data gaps and metrics that could not be computed" note="Known limits of the free sources used." items={verdict.gaps} icon={HelpCircle} iconColor="var(--ink-muted)" />
        </div>
      </Section>

      <ReproduceCard />
    </div>
  );
}
