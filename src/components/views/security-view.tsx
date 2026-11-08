"use client";

import { CircleCheck, CircleHelp, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { ChartCard } from "@/components/atlas/chart-card";
import { IncidentTimeline, incidentTableSpec, summariseIncidents } from "@/components/charts/incident-timeline";
import { RiskBreakdown, riskCounts, riskTableSpec } from "@/components/charts/risk-breakdown";
import { RiskTable } from "@/components/charts/risk-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CHAIN_RISK_STATUSES, CHAIN_RISK_STATUS_META, chainRisk, type ChainRiskItem, type ChainRiskStatus } from "@/data/chain-risk";
import { events } from "@/lib/data";
import { useFilters } from "@/lib/filters";
import { fmtInt, fmtUsd } from "@/lib/format";
import type { RiskLevel } from "@/lib/types";

const STATUS_ICON: Record<ChainRiskStatus, LucideIcon> = { good: CircleCheck, watch: TriangleAlert, serious: OctagonAlert, unknown: CircleHelp };

function StatusGlyph({ status, className }: { status: ChainRiskStatus; className?: string }) {
  const Icon = STATUS_ICON[status];
  return <Icon aria-hidden="true" className={className ?? "size-4 shrink-0"} style={{ color: CHAIN_RISK_STATUS_META[status].color }} />;
}

function ChecklistItem({ item }: { item: ChainRiskItem }) {
  const meta = CHAIN_RISK_STATUS_META[item.status];
  return (
    <li className="flex gap-2.5 py-2.5 text-sm">
      <StatusGlyph status={item.status} className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">{item.label}</span>
          <span className="text-xs text-muted-foreground">{meta.label}</span>
        </div>
        <p className="text-xs leading-snug text-muted-foreground">{item.detail}</p>
        {item.source && <p className="mt-0.5 text-[11px] text-muted-foreground/80">Source {item.source}</p>}
      </div>
    </li>
  );
}

function pluralProjects(n: number) {
  return `${fmtInt(n)} ${n === 1 ? "project" : "projects"}`;
}

export function SecurityView() {
  const { filtered, all, openProject } = useFilters();

  const incidents = useMemo(() => events.filter((e) => e.type === "Incident"), []);
  const incidentSummary = useMemo(() => summariseIncidents(incidents), [incidents]);
  const incidentTable = useMemo(() => incidentTableSpec(incidents), [incidents]);

  const riskRows = useMemo(() => riskCounts(filtered), [filtered]);
  const riskTable = useMemo(() => riskTableSpec(riskRows), [riskRows]);
  const countOf = (r: RiskLevel) => riskRows.find((x) => x.risk === r)?.count ?? 0;
  const notResearched = countOf("Not researched");
  const researched = filtered.length - notResearched;
  const flagged = useMemo(() => filtered.filter((p) => p.risk === "High" || p.risk === "Medium"), [filtered]);

  const neverCheckedAll = all.filter((p) => p.risk === "Not researched").length;
  const researchedAll = all.length - neverCheckedAll;
  const chainRows = all.filter((p) => p.risk !== "Not researched" && (p.name === "NEAR Protocol" || p.name === "Aurora")).length;

  const incidentTakeaway = (() => {
    const s = incidentSummary;
    if (s.count === 0) return "No incidents recorded.";
    const span = s.first && s.last ? ` between ${s.first.date.slice(0, 4)} and ${s.last.date.slice(0, 4)}` : "";
    const stated = s.statedCount ? ` ${s.statedCount} state an amount, ${fmtUsd(s.statedTotal)} in total` : " none states an amount";
    const largest = s.largest ? `; the largest is ${s.largest.title} at ${fmtUsd(s.largest.amount)}` : "";
    return `${s.count} incidents recorded${span};${stated}${largest}.`;
  })();

  const riskTakeaway =
    filtered.length === 0
      ? "No projects match the current filters."
      : `${pluralProjects(researched)} of ${fmtInt(filtered.length)} in this selection carry a security rating, ${countOf("High")} High, ${countOf("Medium")} Medium, ${countOf("Low")} Low, ${countOf("Unknown")} Unknown. ${fmtInt(notResearched)} were never checked.`;

  return (
    <div className="space-y-4">
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <h2 className="text-sm font-semibold">Chain-level checklist</h2>
              <p className="mt-1 text-sm text-muted-foreground">NEAR L1, NEAR Intents and Aurora as recorded in the research memo&apos;s Security section. Independent of the project filters.</p>
            </div>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Status legend">
              {CHAIN_RISK_STATUSES.map((s) => (
                <li key={s} className="inline-flex items-center gap-1" title={CHAIN_RISK_STATUS_META[s].description}>
                  <StatusGlyph status={s} className="size-3.5 shrink-0" /> {CHAIN_RISK_STATUS_META[s].label}
                </li>
              ))}
            </ul>
          </div>
        </CardHeader>
        <CardContent className="px-4">
          <div className="grid gap-4 md:grid-cols-3">
            {chainRisk.map((entity) => {
              const tally = CHAIN_RISK_STATUSES.map((s) => ({ s, n: entity.items.filter((i) => i.status === s).length })).filter((t) => t.n > 0);
              return (
                <section key={entity.id} aria-labelledby={`chain-risk-${entity.id}`} className="rounded-lg border bg-card p-3">
                  <h3 id={`chain-risk-${entity.id}`} className="text-sm font-semibold">
                    {entity.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{entity.summary}</p>
                  <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    {tally.map((t) => (
                      <span key={t.s} className="inline-flex items-center gap-1">
                        <StatusGlyph status={t.s} className="size-3 shrink-0" />
                        {t.n} {CHAIN_RISK_STATUS_META[t.s].label.toLowerCase()}
                      </span>
                    ))}
                  </p>
                  <ul className="mt-1 divide-y">
                    {entity.items.map((item) => (
                      <ChecklistItem key={item.id} item={item} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Incident timeline"
          scope="whole-chain"
          takeaway={incidentTakeaway}
          info="Events of type Incident from the research events file (data/near-ecosystem-events CSV). Marker area tracks the stated USD amount, which can be a loss, a bounty paid or value at risk as the amount note says; incidents without a stated amount use the smallest hollow marker. Month-only dates sit on the first of the month. Hover for detail, click to open the source. Independent of the project filters."
          table={incidentTable}
        >
          <IncidentTimeline events={incidents} />
        </ChartCard>

        <ChartCard
          title="Security risk levels"
          takeaway={riskTakeaway}
          info="Projects in the current selection grouped by the Security Risk Level column of the research CSV. Not researched (hatched) means the project was never checked; Unknown means it was checked and no audit or incident was found. Click a bar to filter."
          table={riskTable}
        >
          <RiskBreakdown rows={riskRows} />
        </ChartCard>
      </div>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <h2 className="text-sm font-semibold">High and Medium risk projects ({fmtInt(flagged.length)})</h2>
          <p className="text-sm text-muted-foreground">Audits, incidents and red flags as recorded by the researcher, from the Security columns of the research CSV. High first, then by TVL. Each row links to its security source where one exists.</p>
        </CardHeader>
        <CardContent className="px-0">
          <RiskTable projects={flagged} onOpen={openProject} />
        </CardContent>
      </Card>

      <Card className="gap-2 py-4">
        <CardHeader className="px-4">
          <h2 className="text-sm font-semibold">How to read this</h2>
        </CardHeader>
        <CardContent className="space-y-1.5 px-4 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Not researched</strong> means security was never checked for that project. <strong className="text-foreground">Unknown</strong> means it was checked and nothing was found, no published audit and no incident in the sources consulted. Unknown is not the same as unaudited.
          </p>
          <p>
            The security pass covered {fmtInt(researchedAll)} rows of the full list{chainRows > 0 ? `, including the ${chainRows === 1 ? "base-chain entry" : "base-chain entries"} for NEAR and Aurora` : ""}. The remaining {fmtInt(neverCheckedAll)} rows were never checked and show as Not researched everywhere.
          </p>
          <p>Risk levels are the researcher&apos;s judgement from audits, incidents, admin powers and red flags. They are not a rating of code quality, and Low does not mean safe. The chain-level checklist above is independent of the project filters; the risk chart and table follow them.</p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Name the route file imports. */
