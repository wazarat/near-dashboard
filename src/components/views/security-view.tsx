"use client";

import { useMemo } from "react";
import { ScopeNote } from "@/components/atlas/chart-card";
import { IncidentsTable, summariseIncidents } from "@/components/charts/incidents-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CHAIN_RISK_STATUS_META, chainRisk, type ChainRiskItem, type ChainRiskStatus } from "@/data/chain-risk";
import { events } from "@/lib/data";
import { useFilters } from "@/lib/filters";
import { fmtInt, fmtUsd } from "@/lib/format";
import { FACT_HELP, FACT_TYPES, securityAggregates } from "@/lib/security";
import { cn } from "@/lib/utils";

/** Status as a plain word; colour sits on the word only when a condition is met or material (standard section 10). */
const STATUS_WORD: Record<ChainRiskStatus, string> = { good: "text-signal-400", watch: "text-ink-50", serious: "text-rose-400", unknown: "text-ink-300" };

function StatusWord({ status }: { status: ChainRiskStatus }) {
  const meta = CHAIN_RISK_STATUS_META[status];
  return (
    <span className={cn("font-medium", STATUS_WORD[status])} title={meta.description}>
      {meta.label}
    </span>
  );
}

function ChecklistItem({ item }: { item: ChainRiskItem }) {
  return (
    <li className="py-2.5 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium">{item.label}</span>
        <StatusWord status={item.status} />
      </div>
      <p className="text-xs leading-snug text-ink-300">{item.detail}</p>
      {item.source && <p className="mt-0.5 text-label text-ink-300">Source {item.source}</p>}
    </li>
  );
}

function pluralProjects(n: number) {
  return `${fmtInt(n)} ${n === 1 ? "project" : "projects"}`;
}

export function SecurityView() {
  const { filtered, all } = useFilters();

  const incidents = useMemo(() => events.filter((e) => e.type === "Incident"), []);
  const incidentSummary = useMemo(() => summariseIncidents(incidents), [incidents]);
  const facts = useMemo(() => securityAggregates(filtered), [filtered]);
  const factsAll = useMemo(() => securityAggregates(all), [all]);
  const chainRows = all.filter((p) => p.risk !== "Not researched" && (p.name === "NEAR Protocol" || p.name === "Aurora")).length;

  const incidentTakeaway = (() => {
    const s = incidentSummary;
    if (s.count === 0) return "No incidents recorded.";
    const span = s.first && s.last ? ` between ${s.first.date.slice(0, 4)} and ${s.last.date.slice(0, 4)}` : "";
    const stated = s.statedCount ? ` ${s.statedCount} state an amount, ${fmtUsd(s.statedTotal)} in total` : " none states an amount";
    const largest = s.largest ? `; the largest is ${s.largest.title} at ${fmtUsd(s.largest.amount)}` : "";
    return `${s.count} incidents recorded${span};${stated}${largest}.`;
  })();

  const factsTakeaway =
    filtered.length === 0
      ? "No projects match the current filters."
      : `Security was checked for ${pluralProjects(facts.checked)} of ${fmtInt(filtered.length)} in this selection; ${facts.auditFound} list a published audit, ${facts.byFact[1].count} record a past incident and ${facts.byFact[3].count} carry a noted red flag. ${fmtInt(facts.notChecked)} were never checked.`;

  return (
    <div className="space-y-4">
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h2 className="text-sm font-semibold">Chain-level checklist</h2>
            <ScopeNote scope="whole-chain" />
          </div>
          <p className="mt-1 text-sm text-ink-300">NEAR L1, NEAR Intents and Aurora as recorded in the research memo&apos;s Security section. Good means mitigated or a positive finding, Watch a partial mitigation or an open question, Serious a material risk as recorded, Unknown not documented.</p>
        </CardHeader>
        <CardContent className="px-4">
          <div className="grid gap-4 md:grid-cols-3">
            {chainRisk.map((entity) => {
              const tally = (["good", "watch", "serious", "unknown"] as ChainRiskStatus[]).map((s) => ({ s, n: entity.items.filter((i) => i.status === s).length })).filter((t) => t.n > 0);
              return (
                <section key={entity.id} aria-labelledby={`chain-risk-${entity.id}`} className="rounded-lg border border-ink-700/40 p-3">
                  <h3 id={`chain-risk-${entity.id}`} className="text-sm font-semibold">
                    {entity.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-ink-300">{entity.summary}</p>
                  <p className="mt-1.5 text-label text-ink-300">{tally.map((t) => `${t.n} ${CHAIN_RISK_STATUS_META[t.s].label.toLowerCase()}`).join(", ")}</p>
                  <ul className="mt-1 divide-y divide-ink-700/40">
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
        <Card className="gap-3 py-4" data-chart-card="Security facts">
          <CardHeader className="px-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h2 className="text-sm font-semibold">Security facts</h2>
              <ScopeNote />
            </div>
            <p className="mt-1 text-sm text-ink-300">{factsTakeaway}</p>
          </CardHeader>
          <CardContent className="px-4">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Fact</TableHead>
                  <TableHead className="text-right">Projects</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facts.byFact.map((f) => (
                  <TableRow key={f.fact}>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        {f.fact}
                        <InfoTip label={`About ${f.fact}`}>{FACT_HELP[f.fact]}</InfoTip>
                      </span>
                    </TableCell>
                    <TableCell className="tabular text-right">{fmtInt(f.count)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="text-ink-300">Security checked</TableCell>
                  <TableCell className="tabular text-right">{fmtInt(facts.checked)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-ink-300">Not researched</TableCell>
                  <TableCell className="tabular text-right">{fmtInt(facts.notChecked)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-ink-300">Counts from the Audits, Incidents, Red Flags and Status columns of the research CSV. A project can carry more than one fact. No rating is published; the drawer quotes each fact with its source.</p>
          </CardContent>
        </Card>

        <Card className="gap-3 py-4 xl:col-span-2" data-chart-card="Security facts by sector">
          <CardHeader className="px-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h2 className="text-sm font-semibold">Security facts by sector</h2>
              <ScopeNote />
            </div>
            <p className="mt-1 text-sm text-ink-300">Sectors with at least one checked project in the selection, most checked first.</p>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Sector</TableHead>
                    <TableHead className="text-right">Projects</TableHead>
                    <TableHead className="text-right">Checked</TableHead>
                    {FACT_TYPES.map((f) => (
                      <TableHead key={f} className="text-right">
                        {f}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facts.bySector.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3 + FACT_TYPES.length} className="pl-4 text-ink-300">
                        No checked project in this selection.
                      </TableCell>
                    </TableRow>
                  )}
                  {facts.bySector.map((s) => (
                    <TableRow key={s.sector}>
                      <TableCell className="whitespace-nowrap pl-4 font-medium">{s.sector}</TableCell>
                      <TableCell className="tabular text-right">{fmtInt(s.projects)}</TableCell>
                      <TableCell className="tabular text-right">{fmtInt(s.checked)}</TableCell>
                      {FACT_TYPES.map((f) => (
                        <TableCell key={f} className={cn("tabular text-right", s.counts[f] === 0 && "text-ink-300")}>
                          {fmtInt(s.counts[f])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-3 py-4" data-chart-card="Incidents">
        <CardHeader className="px-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h2 className="text-sm font-semibold">Incidents</h2>
            <ScopeNote scope="whole-chain" />
          </div>
          <p className="mt-1 text-sm text-ink-300">{incidentTakeaway}</p>
          <p className="text-label text-ink-300">Events of type Incident from the research events file, in its own wording. Amounts can be a loss, a bounty paid or value at risk, as the note says. Sort any column.</p>
        </CardHeader>
        <CardContent className="px-0">
          <IncidentsTable events={incidents} />
        </CardContent>
      </Card>

      <Card className="gap-2 py-4">
        <CardHeader className="px-4">
          <h2 className="text-sm font-semibold">How to read this</h2>
        </CardHeader>
        <CardContent className="space-y-1.5 px-4 text-sm text-ink-300">
          <p>
            <strong className="font-medium text-ink-50">Not researched</strong> means security was never checked for that project. <strong className="font-medium text-ink-50">No published audit found</strong> means it was checked and no audit turned up in the sources consulted, which is not the same as unaudited.
          </p>
          <p>
            The security pass covered {fmtInt(factsAll.checked)} rows of the full list{chainRows > 0 ? `, including the ${chainRows === 1 ? "base-chain entry" : "base-chain entries"} for NEAR and Aurora` : ""}. The remaining {fmtInt(factsAll.notChecked)} rows were never checked and read as Not researched everywhere.
          </p>
          <p>This page publishes facts, not ratings. Audits, dated incidents and noted red flags are quoted from the research CSV with their source links in each project drawer. The chain-level checklist is independent of the project filters; the two facts cards follow them.</p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Name the route file imports. */
export default SecurityView;
