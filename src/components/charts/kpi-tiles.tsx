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

/** One project's share of a summed tile, listed in the tile's info pop-up. */
interface Contribution {
  id: string;
  name: string;
  value: number;
  /** Shown after the name, for a value that comes from a different source than the rest. */
  note?: string;
}

interface Breakdown {
  rows: Contribution[];
  /** Active projects in sectors that use the metric but with no figure yet. */
  missing: number;
}

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
  /** The projects the tile sums, listed with their values in the info pop-up. */
  breakdown?: Breakdown;
}

/** NEAR Intents, counted once (accuracy rule 7). */
const INTENTS_ID = "near-intents";

const WHERE_HELP = "The list below shows every project in the sum with its value. A blank value is never counted as zero.";

function trackedLabel(n: number): string {
  return `Tracked for ${n.toLocaleString("en-US")} ${n === 1 ? "project" : "projects"}`;
}

/** The projects with a value, largest first, so the list adds up to the tile. */
function contributions(projects: Project[], valueOf: (p: Project) => number | null, noteOf?: (p: Project) => string | undefined): Contribution[] {
  const rows: Contribution[] = [];
  for (const p of projects) {
    const v = valueOf(p);
    if (v !== null) rows.push({ id: p.id, name: p.name, value: v, note: noteOf?.(p) });
  }
  return rows.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

function missingWhereApplies(projects: Project[], id: MetricId): number {
  const c = coverageWhereApplies(projects, id);
  return c.applies - c.tracked;
}

/** Sum of a registry metric over the active projects, with the projects behind it. */
function sumOf(projects: Project[], id: MetricId): { total: number | null; breakdown: Breakdown } {
  const rows = contributions(projects, (p) => (isInactive(p) ? null : metricOf(p, id)));
  const total = rows.length ? rows.reduce((a, r) => a + r.value, 0) : null;
  return { total, breakdown: { rows, missing: missingWhereApplies(projects, id) } };
}

function BreakdownList({ breakdown, label }: { breakdown: Breakdown; label: string }) {
  const { rows, missing } = breakdown;
  return (
    <div className="mt-2.5 border-t border-ink-700/60 pt-2" data-testid="kpi-breakdown">
      <p className="mb-1 font-medium text-ink-50">
        {rows.length.toLocaleString("en-US")} {rows.length === 1 ? "project" : "projects"} in this sum
      </p>
      <ol className="max-h-44 overflow-y-auto pr-1 sm:max-h-60" aria-label={`Projects in ${label}`}>
        {rows.map((r) => (
          <li key={r.id} className="flex items-baseline justify-between gap-3 border-b border-ink-700/30 py-1 last:border-0">
            <span className="min-w-0 truncate text-ink-50" title={r.name}>
              {r.name}
              {r.note && <span className="text-ink-300"> ({r.note})</span>}
            </span>
            <span className="tabular shrink-0 text-ink-50" title={fmtUsdFull(r.value)}>
              {fmtUsd(r.value)}
            </span>
          </li>
        ))}
      </ol>
      {missing > 0 && (
        <p className="mt-1.5">
          {missing.toLocaleString("en-US")} more active {missing === 1 ? "project" : "projects"} in sectors that use this metric {missing === 1 ? "has" : "have"} no figure yet.
        </p>
      )}
    </div>
  );
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
  // NEAR Intents app fees count as revenue only for projects DefiLlama reports no revenue for (marked on the tile).
  const intentsRev = projects.reduce((a, p) => (!isInactive(p) && p.revenue === null && p.extra?.values.intentsAppFees !== undefined ? a + (p.extra.values.intentsAppFees ?? 0) : a), 0);
  const revDl = sumMetric(projects, "revenue");
  const rev = revDl === null && intentsRev === 0 ? null : (revDl ?? 0) + intentsRev;
  // Gas fees generated: Y is every active project with at least one mapped contract account.
  const withContracts = projects.filter((p) => !isInactive(p) && p.contracts.length > 0);
  const gasTracked = withContracts.filter((p) => p.extra?.values.gasGenerated !== undefined);
  const gasTotal = gasTracked.reduce((a, p) => a + (p.extra?.values.gasGenerated ?? 0), 0);
  const natTvl = nativeShare(projects, "tvl");
  const natFees = nativeShare(projects, "fees");
  const natCount = projects.filter((p) => p.chain === "NEAR native").length;
  const chainTvl = meta.chainTvl.near;
  const tracked = (key: "tvl" | "volume" | "fees" | "revenue") => countWith(projects, key);
  // Each summed tile lists the projects behind its total, so the count on the tile is the length of that list.
  // "missing" counts the active projects whose sector uses the metric but that have no figure (docs/LIVE-DATA.md, section 0).
  const sumBreakdown = (key: "tvl" | "volume" | "fees"): Breakdown => ({ rows: contributions(projects, (p) => p[key]), missing: missingWhereApplies(projects, key) });
  const tvlBd = sumBreakdown("tvl");
  const volBd = sumBreakdown("volume");
  const feesBd = sumBreakdown("fees");
  const revBd: Breakdown = {
    rows: contributions(
      projects,
      (p) => p.revenue ?? (!isInactive(p) && p.extra?.values.intentsAppFees !== undefined ? (p.extra.values.intentsAppFees ?? 0) : null),
      (p) => (p.revenue === null ? "NEAR Intents app fees" : undefined),
    ),
    missing: missingWhereApplies(projects, "revenue"),
  };
  const gasBd: Breakdown = { rows: contributions(gasTracked, (p) => p.extra?.values.gasGenerated ?? 0), missing: withContracts.length - gasTracked.length };
  const borrowed = sumOf(projects, "borrowed");
  const stable = sumOf(projects, "stablecoinSupply");
  const chainStable = meta.stablecoins ?? null;
  // Unfiltered, the tile is every USD stablecoin on the two chains, each coin once; under a filter, the selection's coins.
  const stableValue = filteredView || !chainStable ? stable.total : chainStable.near + chainStable.aurora;
  const intents = projects.find((p) => p.id === INTENTS_ID);
  const volExIntents = vol === null ? null : intents && intents.volume !== null ? vol - intents.volume : vol;
  const volExBd: Breakdown = { rows: volBd.rows.filter((r) => r.id !== INTENTS_ID), missing: 0 };

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
      sub: trackedLabel(tvlBd.rows.length),
      sub2: filteredView ? (allTvl && tvl !== null && tracked("tvl") > 0 ? `${fmtPct(tvl / allTvl)} of all summed TVL` : undefined) : chainTvl !== null ? `Chain TVL ${fmtUsd(chainTvl)}` : undefined,
      full: fmtUsdFull(tvl),
      empty: tracked("tvl") === 0,
      breakdown: tvlBd,
      info: `Sum of each protocol's TVL on NEAR and Aurora per DefiLlama. Double counts liquid staking and bridges; DefiLlama's default chain TVL excludes them (NEAR $174.9M, Aurora $3.8M on Nov 8, 2026). CEX reserves and borrowed funds are excluded. TVL applies to DEXs, lending, liquid staking, yield, perps, RWA, bridges and prediction markets; launchpads and trading tools hold no deposits of their own. ${WHERE_HELP}`,
    },
    {
      label: "30d DEX volume",
      value: fmtUsd(vol),
      sub: trackedLabel(volBd.rows.length),
      full: fmtUsdFull(vol),
      empty: tracked("volume") === 0,
      breakdown: volBd,
      sub2: "Including NEAR Intents",
      info: `30-day DEX and bridge volume per DefiLlama, NEAR Intents included and counted once. NEAR Intents alone is about 92% of the chain total, so most charts default to a log scale. Volume applies to DEXs, launchpads and trading tools, and to bridges only where they swap, which a DefiLlama volume listing shows. ${WHERE_HELP}`,
    },
    {
      label: "30d DEX volume without NEAR Intents",
      value: fmtUsd(volExIntents),
      sub: intents ? `NEAR Intents ${fmtUsd(intents.volume)} left out` : "NEAR Intents is not in the selection",
      full: fmtUsdFull(volExIntents),
      empty: volExIntents === null,
      breakdown: volExBd,
      info: "The same 30-day DEX volume with NEAR Intents taken out, so the rest of the ecosystem's trading is readable on its own. NEAR Intents is a Bridges and Interoperability project in this dataset, and DefiLlama lists it under both DEXs and bridges; it is counted once in the tile beside this one.",
    },
    {
      label: "30d fees",
      value: fmtUsd(fees),
      sub: trackedLabel(feesBd.rows.length),
      full: fmtUsdFull(fees),
      empty: tracked("fees") === 0,
      breakdown: feesBd,
      info: `30-day fees paid by users per DefiLlama. The sum also takes in any project outside those sectors that reports fees, such as the NEAR chain's own row. Fees apply to DEXs, lending, liquid staking, yield, perps, launchpads, bridges, prediction markets and trading tools. Memecoins, AI agents, NFTs and games, social, DAOs and stablecoins earn offchain or have no protocol fee, so they are not counted as gaps. ${WHERE_HELP}`,
    },
    {
      label: "30d revenue",
      value: fmtUsd(rev),
      sub: trackedLabel(revBd.rows.length),
      sub2: intentsRev > 0 ? `Includes ${fmtUsd(intentsRev)} of NEAR Intents app fees` : undefined,
      full: fmtUsdFull(rev),
      empty: rev === null,
      breakdown: revBd,
      info: `30-day protocol revenue per DefiLlama, the part of fees the protocol or its token keeps. Revenue applies only where the protocol keeps a share of fees, so it is looked for only in projects with a DefiLlama fee listing, whose methodology says what the protocol keeps. NEAR Intents app fees count as revenue only for a project DefiLlama reports no revenue for, and are marked in the list. ${WHERE_HELP}`,
    },
    {
      label: "Stablecoin supply",
      value: fmtUsd(stableValue),
      sub: !filteredView && chainStable ? `NEAR ${fmtUsd(chainStable.near)}, Aurora ${fmtUsd(chainStable.aurora)}` : trackedLabel(stable.breakdown.rows.length),
      full: fmtUsdFull(stableValue),
      empty: stableValue === null,
      // Unfiltered, the tile is the chain-wide supply rather than a sum over projects, so there is no list to show.
      breakdown: filteredView || !chainStable ? stable.breakdown : undefined,
      info: "USD-pegged stablecoins circulating on NEAR plus Aurora per DefiLlama's stablecoin dashboard, each coin counted once even where the dataset lists it under two names (DAI and DAI by MakerDAO). With a filter set, only the selected stablecoin projects count.",
    },
    {
      label: "Total borrowed",
      value: fmtUsd(borrowed.total),
      sub: trackedLabel(borrowed.breakdown.rows.length),
      full: fmtUsdFull(borrowed.total),
      empty: borrowed.total === null,
      breakdown: borrowed.breakdown,
      info: `Outstanding loans on NEAR and Aurora lenders per DefiLlama's borrowed view, summed. Not part of TVL, which counts only what is still deposited. ${WHERE_HELP}`,
    },
    ...(gasTracked.length
      ? [
          {
            label: "Gas fees generated",
            value: fmtUsd(gasTotal),
            sub: trackedLabel(gasTracked.length),
            sub2: "30 days, the contracts' 30% share",
            full: fmtUsdFull(gasTotal),
            empty: false,
            breakdown: gasBd,
            info: "The protocol pays a contract 30% of the gas burnt when receipts execute on it. This sums that share over the last 30 days for every project with mapped contract accounts in data/contracts.csv, from execution outcomes in the NEAR BigQuery public dataset at each day's NEAR price. It measures how much the contracts are used, not what the protocol earns, so it is never added to fees or revenue. The list below shows every project in the sum with its value.",
          },
        ]
      : []),
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
      <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-3", tiles.length === 10 && "xl:grid-cols-5")}>
      {tiles.map((t) => (
        <div key={t.label} data-kpi={t.label} className={cn("card-lit rounded-xl border border-ink-700/60 bg-ink-900 px-4 py-3.5", t.empty && "border-ink-700/40")}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-label uppercase tracking-wider text-ink-300">{t.label}</span>
            <InfoTip label={`About ${t.label}`} contentClassName={t.breakdown?.rows.length ? "w-80" : undefined}>
              {t.info}
              {t.breakdown && t.breakdown.rows.length > 0 && <BreakdownList breakdown={t.breakdown} label={t.label} />}
            </InfoTip>
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
