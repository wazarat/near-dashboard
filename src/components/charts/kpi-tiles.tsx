"use client";

import { ScopeNote } from "@/components/atlas/chart-card";
import { LegacySwitch, useLegacyOn } from "@/components/atlas/legacy-switch";
import { InfoTip } from "@/components/ui/info-tip";
import { NOT_TRACKED_HELP, coverageShort } from "@/lib/coverage";
import { meta } from "@/lib/data";
import { fmtInt, fmtPct, fmtUsd, fmtUsdFull } from "@/lib/format";
import { countWith, nativeShare, sumMetric } from "@/lib/metrics";
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

export function KpiTiles({ projects, total }: { projects: Project[]; total: number }) {
  const legacy = useLegacyOn("kpi");
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
  const coverage = (key: "tvl" | "volume" | "fees" | "revenue") => coverageShort(tracked(key), n);

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
      sub2: chainTvl !== null ? `Chain TVL ${fmtUsd(chainTvl)}` : undefined,
      full: fmtUsdFull(tvl),
      empty: tracked("tvl") === 0,
      info: `Sum of each protocol's TVL on NEAR and Aurora per DefiLlama. Double counts liquid staking and bridges; DefiLlama's default chain TVL excludes them (NEAR $174.9M, Aurora $3.8M on Nov 8, 2026). CEX reserves are excluded. ${NOT_TRACKED_HELP}`,
    },
    {
      label: "30d DEX volume",
      value: fmtUsd(vol),
      sub: coverage("volume"),
      full: fmtUsdFull(vol),
      empty: tracked("volume") === 0,
      info: `30-day DEX and bridge volume per DefiLlama. NEAR Intents alone is about 92% of the chain total, so most charts default to a log scale. ${NOT_TRACKED_HELP}`,
    },
    {
      label: "30d fees",
      value: fmtUsd(fees),
      sub: coverage("fees"),
      full: fmtUsdFull(fees),
      empty: tracked("fees") === 0,
      info: `30-day fees paid by users per DefiLlama. ${NOT_TRACKED_HELP}`,
    },
    {
      label: "30d revenue",
      value: fmtUsd(rev),
      sub: coverage("revenue"),
      full: fmtUsdFull(rev),
      empty: tracked("revenue") === 0,
      info: `30-day protocol revenue per DefiLlama, the part of fees the protocol or its token keeps. ${NOT_TRACKED_HELP}`,
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => (
        <div key={t.label} className={cn("card-lit rounded-xl border border-ink-700/60 bg-ink-900 px-4 py-3.5", t.empty && "border-ink-700/40")}>
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
