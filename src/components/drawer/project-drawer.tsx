"use client";

import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { ChainChip, StatusBadge, TierBadge } from "@/components/atlas/badges";
import { ChangeCell } from "@/components/atlas/change-cell";
import { EstimateLabel } from "@/components/atlas/estimate-label";
import { HistoryChart } from "@/components/charts/history-chart";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { eventsByProject, projectById, roundsByProject } from "@/lib/data";
import { useFilters } from "@/lib/filters";
import { displayUrl, fmtDate, fmtEventDate, fmtInt, fmtMetric, fmtPct, fmtUsd, fmtUsdFull, METRIC_SHORT, xUrl } from "@/lib/format";
import { similarProjects } from "@/lib/metrics";
import type { Range } from "@/lib/ranges";
import type { MetricKey, MetricSource, NumericMetricKey, Project } from "@/lib/types";
import { CompareButton } from "@/components/compare/compare-button";
import { TALLY_CORRECT_URL, tallyCorrectUrl } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Flag } from "lucide-react";

function Field({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-0.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <dl className="space-y-1.5">{children}</dl>
    </section>
  );
}

export function Ext({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-foreground underline decoration-muted-foreground/50 underline-offset-2 hover:decoration-foreground">
      <span className="truncate">{children ?? displayUrl(href)}</span>
      <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
    </a>
  );
}

function Money({ v }: { v: number | null }) {
  return v === null ? <span className="text-muted-foreground">no data</span> : <span className="tabular">{fmtUsdFull(v)}</span>;
}

function Src({ p, k }: { p: Project; k: NumericMetricKey }) {
  const s: MetricSource = p.metricSource?.[k] ?? "none";
  if (s === "none") return null;
  const change = p.live?.change[k].d30;
  return (
    <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {s === "live" ? "daily" : "snapshot"}
      {s === "live" && change !== null && change !== undefined && (
        <>
          · 30d <ChangeCell value={change} />
        </>
      )}
    </span>
  );
}

export function ProjectDrawer() {
  const { state, openProject, all, range } = useFilters();
  const p = projectById(state.project);
  const open = Boolean(p);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && openProject(null)}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {p && <ProjectBody p={p} all={all} metric="tvl" range={range} onOpen={openProject} />}
      </SheetContent>
    </Sheet>
  );
}

function ProjectBody({ p, all, metric, range, onOpen }: { p: Project; all: Project[]; metric: MetricKey; range: Range; onOpen: (id: string) => void }) {
  const similar = similarProjects(all, p, metric, 5);
  const related = eventsByProject.get(p.id) ?? [];
  const rounds = roundsByProject.get(p.id) ?? [];
  const sources = [
    { label: "Discovery source", url: p.sourceUrl },
    ...p.tractionSources.map((u) => ({ label: "Traction source", url: u })),
    { label: "Funding source", url: p.fundingSourceUrl },
    { label: "Security source", url: p.securitySourceUrl },
  ].filter((s): s is { label: string; url: string } => Boolean(s.url));
  const hasActivity = p.live && (p.live.calls7d !== null || p.live.signers7d !== null);

  return (
    <>
      <SheetHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <TierBadge tier={p.tier} />
          <ChainChip chain={p.chain} short={false} />
          <StatusBadge group={p.statusGroup} status={p.status} />
        </div>
        <SheetTitle className="text-xl">{p.name}</SheetTitle>
        <SheetDescription>{p.description}</SheetDescription>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {p.website && <Ext href={p.website} />}
          {p.xHandle && <Ext href={xUrl(p.xHandle)}>{p.xHandle}</Ext>}
          <CompareButton id={p.id} />
          {TALLY_CORRECT_URL && (
            <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
              <a href={tallyCorrectUrl(TALLY_CORRECT_URL, p.name, typeof window === "undefined" ? "" : window.location.href)} target="_blank" rel="noopener noreferrer">
                <Flag className="size-3.5" /> Suggest a correction
              </a>
            </Button>
          )}
        </div>
      </SheetHeader>

      <div className="space-y-5 px-4 pb-8">
        <Section title="Overview">
          <Field label="Sector">
            {p.sector}
            {p.subcategory && <span className="text-muted-foreground"> · {p.subcategory}</span>}
          </Field>
          <Field label="Native chain">
            {p.chain}
            {p.chainDetail && <span className="text-muted-foreground"> · {p.chainDetail}</span>}
            <span className="text-muted-foreground"> · {p.chainConfidence.toLowerCase()} confidence</span>
          </Field>
          <Field label="Chain presence">{p.presence.length ? p.presence.join(", ") : <span className="text-muted-foreground">unknown</span>}</Field>
          <Field label="Status">
            {p.status}
            {p.statusGroup === "Legacy listing" && <span className="text-muted-foreground"> · AwesomeNEAR marks every listing active, so the real status is unknown</span>}
          </Field>
          <Field label="Discovered via">{p.discoveredVia}</Field>
          {p.leaderRank !== null && (
            <Field label="Sector rank">
              #{p.leaderRank} in {p.sector}
            </Field>
          )}
        </Section>

        <Separator />

        <Section title="Traction">
          <Field label="Tier">
            {p.tier}
            {p.live && p.snapshot.tier !== p.tier && <span className="text-muted-foreground"> · was {p.snapshot.tier.replace(/ - .*/, "")} in the {fmtDate(p.snapshot.asOf)} snapshot</span>}
          </Field>
          <Field label="TVL">
            <Money v={p.tvl} />
            <Src p={p} k="tvl" />
            {(p.tvlNear !== null || p.tvlAurora !== null) && p.tvlNear !== p.tvl && (
              <span className="ml-2 text-xs text-muted-foreground">
                NEAR {fmtUsd(p.tvlNear)} · Aurora {fmtUsd(p.tvlAurora)}
              </span>
            )}
          </Field>
          <Field label="30d DEX volume">
            <Money v={p.volume} />
            <Src p={p} k="volume" />
          </Field>
          <Field label="30d fees">
            <Money v={p.fees} />
            <Src p={p} k="fees" />
          </Field>
          <Field label="30d revenue">
            <Money v={p.revenue} />
            <Src p={p} k="revenue" />
          </Field>
          <Field label="Revenue capture">{p.revenueCapture === null ? <span className="text-muted-foreground">no data</span> : `${fmtPct(p.revenueCapture)} of fees`}</Field>
          {p.live?.cexReserves !== null && p.live?.cexReserves !== undefined && (
            <Field label="CEX reserves on NEAR">
              <span className="tabular">{fmtUsdFull(p.live.cexReserves)}</span>
              <span className="ml-2 text-xs text-muted-foreground">excluded from TVL</span>
            </Field>
          )}
          <Field label="Other signal">{p.otherTraction}</Field>
          {!p.hasTraction && <p className="text-xs text-muted-foreground">DefiLlama lists no TVL, volume, fee or revenue figure for this project. Blank means no data, not zero.</p>}
          {p.live && p.live.slugs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Daily figures cover complete UTC days up to {fmtDate(p.live.asOf)} and sum {p.live.slugs.length === 1 ? "one DefiLlama listing" : `${p.live.slugs.length} DefiLlama listings`} ({p.live.slugs.join(", ")}).
            </p>
          )}
        </Section>

        {hasActivity && p.live && (
          <>
            <Separator />
            <Section title="Activity">
              <Field label="7d function calls">{p.live.calls7d === null ? <span className="text-muted-foreground">no data yet</span> : <span className="tabular">{fmtInt(p.live.calls7d)}</span>}</Field>
              <Field label="30d function calls">{p.live.calls30d === null ? <span className="text-muted-foreground">no data yet</span> : <span className="tabular">{fmtInt(p.live.calls30d)}</span>}</Field>
              <Field label="Distinct signers (7d)">
                {p.live.signers7d === null ? (
                  <span className="text-muted-foreground">no data yet</span>
                ) : (
                  <EstimateLabel note="Distinct signer accounts summed per day from BigQuery receipt_actions to the tracked accounts. One person can use many accounts, and relayers or intents hide the end user.">
                    <span className="tabular">{fmtInt(p.live.signers7d)}</span>
                  </EstimateLabel>
                )}
              </Field>
              <Field label="Tracked accounts">
                <ul className="space-y-0.5">
                  {p.contracts.map((c) => (
                    <li key={c.accountId} className="text-xs">
                      <Ext href={`https://nearblocks.io/address/${c.accountId}`}>{c.accountId}</Ext>
                      <span className="text-muted-foreground">
                        {" "}
                        · {c.role} · {c.verified}
                      </span>
                    </li>
                  ))}
                </ul>
              </Field>
              <p className="text-xs text-muted-foreground">Counts FUNCTION_CALL receipts to the accounts above in the NEAR BigQuery public dataset{p.live.activityAsOf ? `, up to ${fmtDate(p.live.activityAsOf)}` : ""}.</p>
            </Section>
          </>
        )}

        {p.live && (
          <>
            <Separator />
            <Section title="History">
              <HistoryChart projectId={p.id} range={range} metric={metric} />
            </Section>
          </>
        )}

        <Separator />

        <Section title="Funding">
          <Field label="Funding type">
            {p.fundingType}
            {p.fundingType === "Not researched" && <span className="text-muted-foreground"> · never checked</span>}
            {p.fundingType === "Not disclosed" && <span className="text-muted-foreground"> · checked, nothing found</span>}
          </Field>
          <Field label="Investors">{p.investors}</Field>
          <Field label="Amount raised">{p.amountRaised}</Field>
          <Field label="Token">{p.tokenRaw}</Field>
        </Section>

        {rounds.length > 0 && (
          <>
            <Separator />
            <Section title="Rounds">
              {rounds.map((r) => (
                <div key={r.id} className={`text-sm ${r.sourced ? "" : "text-muted-foreground"}`}>
                  <span className="text-muted-foreground">{r.date ? fmtEventDate(r.date, r.monthOnly) : "undated"}</span> · {r.roundType} · <span className="tabular">{r.amount === null ? "undisclosed" : fmtUsd(r.amount)}</span>
                  {r.investors.length > 0 && <span className="text-muted-foreground"> · {r.investors.join(", ")}</span>}
                  {!r.sourced && <span className="ml-1 font-mono text-label text-ink-500">{r.confidence}</span>}
                  {r.sourceUrl && (
                    <>
                      {" "}
                      <Ext href={r.sourceUrl}>source</Ext>
                    </>
                  )}
                </div>
              ))}
            </Section>
          </>
        )}

        <Separator />

        <Section title="Security">
          {p.risk === "Not researched" ? (
            <p className="text-sm text-ink-300">Security was not researched for this project.</p>
          ) : (
            <>
              <Field label="Audits">{p.audits ?? <span className="text-ink-300">No published audit found in the sources checked</span>}</Field>
              <Field label="Incidents">{p.incidents ?? <span className="text-ink-300">None recorded</span>}</Field>
              <Field label="Red flags">{p.redFlags ?? <span className="text-ink-300">None noted</span>}</Field>
            </>
          )}
        </Section>

        {related.length > 0 && (
          <>
            <Separator />
            <Section title="Events">
              {related.map((e) => (
                <div key={e.id} className="text-sm">
                  <span className="text-muted-foreground">{fmtEventDate(e.date, e.monthOnly)}</span> · {e.type} · {e.sourceUrl ? <Ext href={e.sourceUrl}>{e.title}</Ext> : e.title}
                </div>
              ))}
            </Section>
          </>
        )}

        <Separator />

        <Section title="Sources">
          {sources.length === 0 && <p className="text-sm text-muted-foreground">No source URLs recorded.</p>}
          {sources.map((s, i) => (
            <Field key={`${s.url}-${i}`} label={s.label}>
              <Ext href={s.url} />
            </Field>
          ))}
        </Section>

        {similar.length > 0 && (
          <>
            <Separator />
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Similar projects <span className="normal-case tracking-normal">(same sector, closest by {METRIC_SHORT[metric].toLowerCase()})</span>
              </h4>
              <ul className="divide-y rounded-md border">
                {similar.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => onOpen(s.id)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">{s.name}</span>
                        <ChainChip chain={s.chain} />
                      </span>
                      <span className="tabular text-muted-foreground">{metric === "count" ? s.tier.replace(/ - .*/, "") : fmtMetric(metric, s[metric])}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </>
  );
}
