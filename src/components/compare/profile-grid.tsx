"use client";

import type { ReactNode } from "react";
import { ChainChip, StatusBadge, TierBadge } from "@/components/atlas/badges";
import { ChartCard, EmptyState } from "@/components/atlas/chart-card";
import { Button } from "@/components/ui/button";
import { CAT } from "@/lib/colors";
import { roundsByProject } from "@/lib/data";
import { fmtUsd } from "@/lib/format";
import type { Project } from "@/lib/types";

export function profileTakeaway(projects: Project[]): string {
  if (projects.length === 0) return "No projects selected.";
  const sectors = new Set(projects.map((p) => p.sector)).size;
  const chains = new Set(projects.map((p) => p.chain)).size;
  const tokens = projects.filter((p) => p.token).length;
  const vc = projects.filter((p) => p.fundingTypes.includes("VC-backed")).length;
  const audited = projects.filter((p) => p.audits).length;
  const researched = projects.filter((p) => p.risk !== "Not researched").length;
  return `${sectors === 1 ? `All in ${projects[0].sector}` : `${sectors} sectors`}, ${chains === 1 ? `all ${projects[0].chain}` : `${chains} native chains`}; ${tokens} of ${projects.length} have a token, ${vc} are VC-backed, ${audited} list an audit and ${researched} had security checked.`;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-300">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

const Muted = ({ children }: { children: ReactNode }) => <span className="text-ink-300">{children}</span>;

interface Props {
  projects: Project[];
  onOpen: (id: string) => void;
}

/** One card per project: the qualitative profile that the numbers above cannot show. */
export function ProfileGrid({ projects, onOpen }: Props) {
  return (
    <ChartCard scope="selection" id="compare-profile" title="Profile side by side" takeaway={profileTakeaway(projects)} info="Sector, chain, status, funding, token, security and discovery fields from the research CSVs (data/near-ecosystem-*.csv); round counts from the funding rounds file. 'Not researched' means the field was never checked; 'Not disclosed' or 'Unknown' means it was checked and nothing was found.">
      {projects.length === 0 ? (
        <EmptyState message="No projects selected." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {projects.map((p, i) => {
            const rounds = roundsByProject.get(p.id) ?? [];
            const disclosed = rounds.filter((r) => r.amount !== null).reduce((a, r) => a + (r.amount as number), 0);
            return (
              <article key={p.id} className="rounded-md border p-3 text-xs" style={{ borderTopWidth: 3, borderTopColor: CAT[i] }} aria-label={`${p.name} profile`}>
                <h4 className="text-sm font-semibold">{p.name}</h4>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <TierBadge tier={p.tier} />
                  <StatusBadge group={p.statusGroup} status={p.status} />
                </div>
                <dl className="mt-3 space-y-2">
                  <Row label="Sector">
                    {p.sector}
                    {p.subcategory && <Muted> · {p.subcategory}</Muted>}
                  </Row>
                  <Row label="Native chain">
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <ChainChip chain={p.chain} short={false} />
                      {p.chainDetail && <Muted>{p.chainDetail}</Muted>}
                    </span>
                  </Row>
                  <Row label="Status">
                    {p.status}
                    {p.statusGroup === "Legacy listing" && <Muted> · status unknown (legacy directory)</Muted>}
                  </Row>
                  <Row label="Funding type">
                    <span className={p.fundingType === "Not researched" ? "text-ink-300" : undefined}>{p.fundingType}</span>
                    {rounds.length > 0 && (
                      <Muted>
                        {" "}
                        · {rounds.length} recorded round{rounds.length === 1 ? "" : "s"}
                        {disclosed > 0 ? ` (${fmtUsd(disclosed)} disclosed)` : ""}
                      </Muted>
                    )}
                  </Row>
                  <Row label="Amount raised">{p.amountRaised ?? <Muted>{p.fundingType === "Not researched" ? "not researched" : "not disclosed"}</Muted>}</Row>
                  <Row label="Token">{p.tokenRaw ?? <Muted>none recorded</Muted>}</Row>
                  <Row label="Security checked">{p.risk === "Not researched" ? <Muted>not researched</Muted> : "yes"}</Row>
                  <Row label="Audits">{p.audits ?? <Muted>{p.risk === "Not researched" ? "not researched" : "no published audit found"}</Muted>}</Row>
                  <Row label="Incidents">{p.incidents ?? <Muted>{p.risk === "Not researched" ? "not researched" : "none recorded"}</Muted>}</Row>
                  <Row label="Discovered via">{p.discoveredVia}</Row>
                </dl>
                <Button variant="outline" size="sm" className="mt-3 h-7 text-xs" onClick={() => onOpen(p.id)}>
                  Open full record
                </Button>
              </article>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}
