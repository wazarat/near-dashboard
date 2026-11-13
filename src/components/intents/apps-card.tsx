"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { meta, projects } from "@/lib/data";
import { useFilters } from "@/lib/filters";
import { fmtDate, fmtInt, fmtUsd } from "@/lib/format";
import { SPECS } from "@/lib/query-specs";
import { HowCalculated } from "@/components/atlas/how-calculated";

/**
 * NEAR Intents volume per integrating app (docs/LIVE-DATA.md, requirement 6): the 1Click swaps that carried an
 * app's referral tag over the last complete Explorer days, through the verified rows of
 * data/intents-referrals.csv. Already counted in NEAR Intents' own volume, so never added to an app's DEX volume.
 */
export function AppsCard() {
  const r = meta.referralApps;
  const { openProject } = useFilters();
  if (!r || r.apps.length === 0) return null;
  const idOf = new Map(projects.map((p) => [p.name, p.id]));
  return (
    <Card className="gap-3 py-4" data-chart-card="Apps routing through NEAR Intents">
      <CardHeader className="px-4">
        <h3 className="inline-flex items-center gap-1 text-sm font-semibold">
          Apps routing through NEAR Intents
          <InfoTip label="About apps routing through NEAR Intents">
            1Click swaps whose referral tag belongs to a project in the atlas, summed over the last {r.days} complete days of NEAR Intents Explorer data{r.end ? ` to ${fmtDate(r.end)}` : ""}. App fees are each swap&apos;s amount in times the app fee it set, with the protocol&apos;s own buyback fee left out; they count as the app&apos;s revenue where DefiLlama reports none. A tag counts only after it has been matched to a project and checked, so the list grows as tags are labelled. This volume is already inside NEAR Intents&apos; own figure.
          </InfoTip>
        </h3>
        <p className="text-sm text-ink-300">
          {r.apps.length} apps in the atlas route {fmtUsd(r.apps.reduce((s, a) => s + a.usd, 0))} through 1Click over {r.days} days.
        </p>
      </CardHeader>
      <CardContent className="px-4" data-chart-body>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="intents-apps">
            <thead>
              <tr className="border-b border-ink-700/40 text-left text-xs text-ink-300">
                <th className="py-1.5 pr-3 font-normal">App</th>
                <th className="py-1.5 pr-3 text-right font-normal">30d volume via NEAR Intents</th>
                <th className="py-1.5 pr-3 text-right font-normal">30d swaps</th>
                <th className="py-1.5 text-right font-normal">30d app fees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/40">
              {r.apps.map((a) => {
                const id = idOf.get(a.project);
                return (
                  <tr key={a.project}>
                    <td className="max-w-[12rem] truncate py-1.5 pr-3">
                      {id ? (
                        <button type="button" onClick={() => openProject(id)} className="truncate text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60">
                          {a.project}
                        </button>
                      ) : (
                        a.project
                      )}
                    </td>
                    <td className="tabular py-1.5 pr-3 text-right text-ink-50">{fmtUsd(a.usd)}</td>
                    <td className="tabular py-1.5 pr-3 text-right text-ink-300">{fmtInt(a.count)}</td>
                    <td className="tabular py-1.5 text-right text-ink-300">{a.fees === null || a.fees === undefined ? <span className="text-label">Not computed</span> : fmtUsd(a.fees)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {r.feeDays !== undefined && r.feeDays < r.days && (
          <p className="mt-2 text-label text-ink-300">App fees need the fee rate on every swap, which the stored rows carry for {r.feeDays} of the {r.days} days, so they are not computed yet.</p>
        )}
      </CardContent>
      <HowCalculated
        className="mx-4"
        method={{ sentence: "NEAR Intents 1Click swap volume, swap counts and app fees over the last 30 complete days, per app in the atlas, through the referral tag each app sets on its swaps.", queries: [SPECS.intentsExplorer, SPECS.intentsDaily, SPECS.referralApps] }}
      />
    </Card>
  );
}
