"use client";

import { ActivityWithoutTvl } from "@/components/charts/activity-without-tvl";
import { BusinessModelScatter } from "@/components/charts/business-model-scatter";
import { Leaderboard } from "@/components/charts/leaderboard";
import { ListedVsLive } from "@/components/charts/listed-vs-live";
import { useFilters } from "@/lib/filters";

/** Traction page: who has measurable onchain activity, how fees turn into revenue, and which listings are live. */
export function TractionView() {
  const { filtered, projectsFor, rangeOf, setRange, scale, state, setState, openProject, setFacet } = useFilters();

  return (
    <div className="space-y-4">
      <Leaderboard
        projects={projectsFor("leaderboard")}
        metric={state.lb}
        onMetricChange={(lb) => void setState({ lb })}
        range={rangeOf("lr")}
        onRangeChange={(r) => setRange("lr", r)}
        cols={state.cols}
        onColsChange={(cols) => void setState({ cols })}
        onOpen={openProject}
      />
      <BusinessModelScatter projects={filtered} scale={scale} onScaleChange={(scale) => void setState({ scale })} onOpen={openProject} />
      <ActivityWithoutTvl projects={projectsFor("activity-without-tvl")} onOpen={openProject} />
      <ListedVsLive projects={projectsFor("listed-vs-live")} onSelect={(via) => setFacet("via", [via])} />
    </div>
  );
}
