"use client";

import { ActivityWithoutTvl } from "@/components/charts/activity-without-tvl";
import { BusinessModelScatter } from "@/components/charts/business-model-scatter";
import { Leaderboard } from "@/components/charts/leaderboard";
import { ListedVsLive } from "@/components/charts/listed-vs-live";
import { useFilters } from "@/lib/filters";

/** Traction page: who has measurable onchain activity, how fees turn into revenue, and which listings are live. */
export function TractionView() {
  const { filtered, range, scale, state, setState, openProject, setFacet } = useFilters();

  return (
    <div className="space-y-4">
      <Leaderboard
        projects={filtered}
        metric={state.lb}
        onMetricChange={(lb) => void setState({ lb })}
        range={range}
        cols={state.cols}
        onColsChange={(cols) => void setState({ cols })}
        onOpen={openProject}
      />
      <BusinessModelScatter projects={filtered} scale={scale} onScaleChange={(scale) => void setState({ scale })} onOpen={openProject} />
      <ActivityWithoutTvl projects={filtered} onOpen={openProject} />
      <ListedVsLive projects={filtered} onSelect={(via) => setFacet("via", [via])} />
    </div>
  );
}
