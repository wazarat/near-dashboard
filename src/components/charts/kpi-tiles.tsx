"use client";

import { ScopeNote } from "@/components/atlas/chart-card";
import { LegacySwitch, useLegacyOn } from "@/components/atlas/legacy-switch";
import { InfoTip } from "@/components/ui/info-tip";

import { meta, projects as allProjects } from "@/lib/data";
import { useActiveFilterCount } from "@/lib/filters";
import { fmtInt, fmtPct, fmtUsd, fmtUsdFull } from "@/lib/format";
import { countWith, nativeShare, sumMetric } from "@/lib/metrics";
import { coverageWhereApplies, isInactive, metricOf, type MetricId } from "@/lib/sector-metrics";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Tile {
  label: string;
  value: string;
  sub: string;
  /** A second line under the first, for a figure that would not fit beside it. */
  sub2?: string;
  info: string;
  full?: string;
  /** True when no project in the selection reports the metric; the tile goes quiet. */
  empty?: boolean;
}

/** NEAR Intents, counted once (accuracy rule 7). */
const INTENTS_ID = "near-intents";

const WHERE_HELP = "Tracked for X of Y where it applies counts, in Y, only projects whose sector uses the metric and that are not defunct or inactive. It leaves out the unmeasured sectors (wallets, infrastructure, exchanges, data and analytics, security, ecosystem and funding, validators, other), where the metric does not exist, rather than counting them as gaps. A blank value is never counted as zero.";

function coverageWhereLabel(tracked: number, applies: number): string {
  return `Tracked for ${tracked.toLocaleString("en-US")} of ${applies.toLocaleString("en-US")} where it applies`;
}

/** Sum of a registry metric over the active projects whose sector uses it, with its coverage. */
function sumOf(projects: Project[], id: MetricId): { total: number | null; tracked: number; applies: number } {
  const c = coverageWhereApplies(projects, id);
  let total: number | null = null;
  for (const p of projects) {
    if (isInactive(p)) continue;
    const v = metricOf(p, id);
    if (v !== null) total = (total ?? 0) + v;
  }
  return { total, ...c };
}

export function KpiTiles({ projects, total }: { projects: Project[]; total: number }) {
  const legacy = useLegacyOn("kpi");
  // With a filter set, the TVL tile compares the selection with the same sum over every project, not with the chain total.
  const filteredView = useActiveFilterCount() > 0;
  const allTvl = sumMetric(allProjects, "tvl");
  const n = projects.length;
  const tvl = sumMetric(projects, "tvl");
  const vol = sumMetric(projects, "volume");
  const fees = sumMetric(projects, "fees");
  const rev = sumMetric(projects, "revenue");
  const natTvl = nativeShare(projects, "tvl");
  const natFees = nativeShare(projects, "fees");
  const natCount = projects.filter((p) => p.chain === "NEAR native").length;
  const chainTvl = meta.chainTvl.near;
  const tracked = (key: "tvl" | "volume" | "fees" | "revenue") => countWith(projects, key);
  // "Tracked for X of Y where it applies" (docs/LIVE-DATA.md, section 0): Y counts only projects whose sector uses
  // the metric and that are not Defunct or Inactive, so a wallet without fees is not counted as a gap.
  const coverage = (key: MetricId) => {
    const c = coverageWhereApplies(projects, key);
    return coverageWhereLabel(c.tracked, c.applies);
  };
  const borrowed = sumOf(projects, "borrowed");
  const stable = sumOf(projects, "stablecoinSupply");
  const chainStable = meta.stablecoins ?? null;
  // Unfiltered, the tile is every USD stablecoin on the two chains, each coin once; under a filter, the selection's coins.
  const stableValue = filteredView || !chainStable ? stable.total : chainStable.near + chainStable.aurora;
  const intents = projects.find((p) => p.id === INTENTS_ID);
  const volExIntents = vol === null ? null : intents && intents.volume !== null ? vol - intents.volume : vol;

  const tiles: Tile[] = [
    {
      label: "Projects",
      value: fmtInt(n),
      sub: n === total ? `${natCount} NEAR-native` : `of ${fmtInt(total)}, ${natCount} NEAR-native`,
      info: `Projects matching the current filters. The full list has ${fmtInt(total)} rows assembled from NEAR Catalog, AwesomeNEAR, the Aurora and near.org ecosystem pages, DefiLlama and news research.`,
    },
    {
      label: "Summed TVL",
      value: fmtUsd(tvl),
      sub: coverage("tvl"),
      sub2: filteredView ? (allTvl && tvl !== null && tracked("tvl") > 0 ? `${fmtPct(tvl / allTvl)} of all summed TVL` : undefined) : chainTvl !== null ? `Chain TVL ${fmtUsd(chainTvl)}` : undefined,
      full: fmtUsdFull(tvl),
      empty: tracked("tvl") === 0,
      info: `Sum of each protocol's TVL on NEAR and Aurora per DefiLlama. Double counts liquid staking and bridges; DefiLlama's default chain TVL excludes them (NEAR $174.9M, Aurora $3.8M on Nov 8, 2026). CEX reserves and borrowed funds are excluded. TVL applies to DEXs, lending, liquid staking, yield, perps, RWA, bridges and prediction markets; launchpads and trading tools hold no deposits of their own. ${WHERE_HELP}`,
    },
    {
      label: "30d DEX volume",
      value: fmtUsd(vol),
      sub: coverage("volume"),
      full: fmtUsdFull(vol),
      empty: tracked("volume") === 0,
      sub2: "Including NEAR Intents",
      info: `30-day DEX and bridge volume per DefiLlama, NEAR Intents included and counted once. NEAR Intents alone is about 92% of the chain total, so most charts default to a log scale. Volume applies to DEXs, launchpads and trading tools, and to bridges only where they swap, which a DefiLlama volume listing shows. ${WHERE_HELP}`,
    },
    {
      label: "30d DEX volume without NEAR Intents",
      value: fmtUsd(volExIntents),
      sub: intents ? `NEAR Intents ${fmtUsd(intents.volume)} left out` : "NEAR Intents is not in the selection",
      full: fmtUsdFull(volExIntents),
      empty: volExIntents === null,
      info: "The same 30-day DEX volume with NEAR Intents taken out, so the rest of the ecosystem's trading is readable on its own. NEAR Intents is a Bridges and Interoperability project in this dataset, and DefiLlama lists it under both DEXs and bridges; it is counted once in the tile beside this one.",
    },
    {
      label: "30d fees",
      value: fmtUsd(fees),
      sub: coverage("fees"),
      full: fmtUsdFull(fees),
      empty: tracked("fees") === 0,
      info: `30-day fees paid by users per DefiLlama. The sum also takes in any project outside those sectors that reports fees, such as the NEAR chain's own row. Fees apply to DEXs, lending, liquid staking, yield, perps, launchpads, bridges, prediction markets and trading tools. Memecoins, AI agents, NFTs and games, social, DAOs and stablecoins earn offchain or have no protocol fee, so they are not counted as gaps. ${WHERE_HELP}`,
    },
    {
      label: "30d revenue",
      value: fmtUsd(rev),
      sub: coverage("revenue"),
      full: fmtUsdFull(rev),
      empty: tracked("revenue") === 0,
      info: `30-day protocol revenue per DefiLlama, the part of fees the protocol or its token keeps. Revenue applies only where the protocol keeps a share of fees, so Y counts projects with a DefiLlama fee listing, whose methodology says what the protocol keeps. ${WHERE_HELP}`,
    },
    {
      label: "Stablecoin supply",
      value: fmtUsd(stableValue),
      sub: !filteredView && chainStable ? `NEAR ${fmtUsd(chainStable.near)}, Aurora ${fmtUsd(chainStable.aurora)}` : coverageWhereLabel(stable.tracked, stable.applies),
      full: fmtUsdFull(stableValue),
      empty: stableValue === null,
      info: "USD-pegged stablecoins circulating on NEAR plus Aurora per DefiLlama's stablecoin dashboard, each coin counted once even where the dataset lists it under two names (DAI and DAI by MakerDAO). With a filter set, only the selected stablecoin projects count.",
    },
    {
      label: "Total borrowed",
      value: fmtUsd(borrowed.total),
      sub: coverageWhereLabel(borrowed.tracked, borrowed.applies),
      full: fmtUsdFull(borrowed.total),
      empty: borrowed.total === null,
      info: `Outstanding loans on NEAR and Aurora lenders per DefiLlama's borrowed view, summed. Not part of TVL, which counts only what is still deposited. ${WHERE_HELP}`,
    },
    {
      label: "NEAR-native TVL share",
      value: fmtPct(natTvl),
      sub: natTvl === null ? "No project in the selection reports TVL" : `NEAR-native fee share ${fmtPct(natFees)}`,
      empty: natTvl === null,
      info: "Share of summed TVL held by projects classified as NEAR native, against their share of 30-day fees. The reverse of most imported-liquidity chains.",
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <ScopeNote legacy={legacy} />
        <LegacySwitch card="kpi" label="the KPI tiles" className="ml-auto" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.label} data-kpi={t.label} className={cn("card-lit rounded-xl border border-ink-700/60 bg-ink-900 px-4 py-3.5", t.empty && "border-ink-700/40")}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-label uppercase tracking-wider text-ink-300">{t.label}</span>
            <InfoTip label={`About ${t.label}`}>{t.info}</InfoTip>
          </div>
          <div className={cn("tabular mt-1.5 font-display text-stat tracking-tight", t.empty ? "text-ink-300" : "text-ink-50")} title={t.full}>
            {t.value}
          </div>
          <div className="mt-1 text-label leading-snug text-ink-300" data-testid="kpi-sub">
            {t.sub}
          </div>
          {t.sub2 && <div className="text-label leading-snug text-ink-300">{t.sub2}</div>}
        </div>
      ))}
      </div>
    </div>
  );
}
