"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { meta } from "@/lib/data";
import { fmtInt, fmtPct, fmtUsd, fmtUsdFull } from "@/lib/format";
import { countWith, nativeShare, sumMetric } from "@/lib/metrics";
import type { Project } from "@/lib/types";

interface Tile {
  label: string;
  value: string;
  sub: string;
  info: string;
  full?: string;
}

export function KpiTiles({ projects, total }: { projects: Project[]; total: number }) {
  const n = projects.length;
  const tvl = sumMetric(projects, "tvl");
  const vol = sumMetric(projects, "volume");
  const fees = sumMetric(projects, "fees");
  const rev = sumMetric(projects, "revenue");
  const natTvl = nativeShare(projects, "tvl");
  const natFees = nativeShare(projects, "fees");
  const natCount = projects.filter((p) => p.chain === "NEAR native").length;
  const chainTvl = meta.chainTvl.near;

  const tiles: Tile[] = [
    {
      label: "Projects",
      value: fmtInt(n),
      sub: n === total ? `${natCount} NEAR-native` : `of ${fmtInt(total)} · ${natCount} NEAR-native`,
      info: `Projects matching the current filters. The full list has ${fmtInt(total)} rows assembled from NEAR Catalog, AwesomeNEAR, the Aurora and near.org ecosystem pages, DefiLlama and news research.`,
    },
    {
      label: "Summed TVL",
      value: fmtUsd(tvl),
      sub: `${countWith(projects, "tvl")} of ${n} report TVL${chainTvl !== null ? ` · chain TVL ${fmtUsd(chainTvl)}` : ""}`,
      full: fmtUsdFull(tvl),
      info: "Sum of each protocol's TVL on NEAR and Aurora per DefiLlama. Double counts liquid staking and bridges; DefiLlama's default chain TVL excludes them (NEAR $174.9M, Aurora $3.8M on Nov 8, 2026). CEX reserves are excluded. Blank rows are excluded, not treated as zero.",
    },
    {
      label: "30d DEX volume",
      value: fmtUsd(vol),
      sub: `${countWith(projects, "volume")} of ${n} report volume`,
      full: fmtUsdFull(vol),
      info: "30-day DEX and bridge volume per DefiLlama. NEAR Intents alone is about 92% of the chain total, so most charts default to a log scale.",
    },
    {
      label: "30d fees",
      value: fmtUsd(fees),
      sub: `${countWith(projects, "fees")} of ${n} report fees`,
      full: fmtUsdFull(fees),
      info: "30-day fees paid by users per DefiLlama.",
    },
    {
      label: "30d revenue",
      value: fmtUsd(rev),
      sub: `${countWith(projects, "revenue")} of ${n} report revenue`,
      full: fmtUsdFull(rev),
      info: "30-day protocol revenue per DefiLlama: the part of fees the protocol or its token keeps.",
    },
    {
      label: "NEAR-native TVL share",
      value: fmtPct(natTvl),
      sub: natTvl === null ? "no TVL data" : `natives earn ${fmtPct(natFees)} of fees`,
      info: "Share of summed TVL held by projects classified as NEAR native, against their share of 30-day fees. The reverse of most imported-liquidity chains.",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{t.label}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={`About ${t.label}`}>
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs leading-relaxed">{t.info}</TooltipContent>
            </Tooltip>
          </div>
          <div className="mt-1 text-2xl font-semibold leading-none tracking-tight" title={t.full}>
            {t.value}
          </div>
          <div className="mt-1.5 truncate text-xs text-muted-foreground">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}
