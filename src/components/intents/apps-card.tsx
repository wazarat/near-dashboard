"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { meta, projects } from "@/lib/data";
import { useFilters } from "@/lib/filters";
import { fmtDate, fmtInt, fmtUsd } from "@/lib/format";

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
            1Click swaps whose referral tag belongs to a project in the atlas, summed over the last {r.days} complete days of NEAR Intents Explorer data{r.end ? ` to ${fmtDate(r.end)}` : ""}. A tag counts only after it has been matched to a project and checked, so the list grows as tags are labelled. App fees per app are Not tracked, since the Explorer reports them by fee recipient, not by referral. This volume is already inside NEAR Intents&apos; own figure.
          </InfoTip>
        </h3>
        <p className="text-sm text-ink-300">
          {r.apps.length} apps in the atlas route {fmtUsd(r.apps.reduce((s, a) => s + a.usd, 0))} through 1Click over {r.days} days.
        </p>
      </CardHeader>
      <CardContent className="px-4">
        <ul className="divide-y divide-ink-700/40 text-sm" data-testid="intents-apps">
          {r.apps.map((a) => {
            const id = idOf.get(a.project);
            return (
              <li key={a.project} className="flex items-baseline justify-between gap-3 py-1.5">
                {id ? (
                  <button type="button" onClick={() => openProject(id)} className="min-w-0 truncate text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60">
                    {a.project}
                  </button>
                ) : (
                  <span className="min-w-0 truncate">{a.project}</span>
                )}
                <span className="tabular shrink-0 text-ink-300">
                  <span className="text-ink-50">{fmtUsd(a.usd)}</span> · {fmtInt(a.count)} swaps
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
