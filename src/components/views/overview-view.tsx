"use client";

import { useMemo } from "react";
import { ChartCard, TvlNote } from "@/components/atlas/chart-card";
import { MetricSegmented, NumericMetricSegmented } from "@/components/atlas/chart-metric";
import { Timeline } from "@/components/atlas/timeline";
import { ChainActivity } from "@/components/charts/chain-activity";
import { ChainOverTime } from "@/components/charts/chain-over-time";
import { MoversPanel } from "@/components/charts/movers-panel";
import { ConcentrationCurve, concentrationTable } from "@/components/charts/concentration-curve";
import { InsightsPanel } from "@/components/charts/insights-panel";
import { KpiTiles } from "@/components/charts/kpi-tiles";
import { NativeStackedBar, nativeStackRows, nativeStackTable } from "@/components/charts/native-stacked-bar";
import { SectorTreemap, sectorTreemapTable, useTreemapLevel } from "@/components/charts/sector-treemap";
import { events } from "@/lib/data";
import { useFilters } from "@/lib/filters";
import { fmtInt, fmtMetric, fmtPct, METRIC_LABEL } from "@/lib/format";
import { concentration, nativeShare, topNShare } from "@/lib/metrics";
import { TIMELINE_DEFAULT_START } from "@/lib/timeline";

export function OverviewView() {
  const { filtered, all, scale, range, state, setState, setFacet, openProject } = useFilters();
  const { tm, cc, mv, ins, tmSector } = state;
  const label = METRIC_LABEL[tm].toLowerCase();
  const n = filtered.length;

  const level = useTreemapLevel(filtered, tm, tmSector);
  const treemapTakeaway = useMemo(() => {
    if (n === 0) return "No projects match the current filters.";
    if (level.tiles.length === 0) return level.sector ? `No ${label} data in ${level.sector}.` : `No ${label} data in this selection.`;
    const valued = level.tiles.filter((t) => t.kind !== "untracked");
    const top = valued[0];
    if (level.mode === "sectors") {
      const majorityNative = valued.filter((t) => (t.nativeShare ?? 0) > 0.5).length;
      return `${top.name} is the largest sector by ${label} with ${fmtPct(level.total > 0 ? top.size / level.total : null)} of the selection; ${majorityNative} of ${valued.length} sectors with data are majority NEAR-native.`;
    }
    if (level.mode === "subcategories") {
      return `${level.sector} splits into ${valued.length} subcategories with ${label}; ${top.name} is the largest with ${fmtPct(level.total > 0 ? top.size / level.total : null)}.`;
    }
    const untracked = level.tiles.find((t) => t.kind === "untracked");
    return `${valued.length} project${valued.length === 1 ? "" : "s"} in ${level.sector} report ${label}; ${top.name} is the largest with ${fmtPct(level.total > 0 ? top.size / level.total : null)}${untracked ? `, and ${untracked.count} are not tracked for it` : ""}.`;
  }, [level, n, label]);

  const stackRows = useMemo(() => nativeStackRows(filtered), [filtered]);
  const stackTakeaway = useMemo(() => {
    if (n === 0) return "No projects match the current filters.";
    const natCount = filtered.filter((p) => p.chain === "NEAR native").length / n;
    const natTvl = nativeShare(filtered, "tvl");
    const natFees = nativeShare(filtered, "fees");
    const parts: string[] = [];
    if (natTvl !== null) parts.push(`hold ${fmtPct(natTvl)} of TVL`);
    if (natFees !== null) parts.push(`earn ${fmtPct(natFees)} of fees`);
    if (parts.length === 0) return `NEAR-native projects are ${fmtPct(natCount)} of the selection; no TVL or fee figures to compare against.`;
    return `NEAR-native projects are ${fmtPct(natCount)} of the selection but ${parts.join(" and ")}.`;
  }, [filtered, n]);

  const points = useMemo(() => concentration(filtered, cc), [filtered, cc]);
  const curveTakeaway = useMemo(() => {
    if (n === 0) return "No projects match the current filters.";
    if (points.length === 0) return `No ${METRIC_LABEL[cc]} data in this selection.`;
    if (points.length < 3) return `Only ${points.length} project${points.length === 1 ? "" : "s"} report${points.length === 1 ? "s" : ""} ${METRIC_LABEL[cc]}; ${points[0].name} is ${fmtPct(points[0].share)} of it.`;
    const top3 = topNShare(points, 3);
    const top10 = points.length >= 10 ? topNShare(points, 10) : null;
    return `Top 3 projects hold ${fmtPct(top3)} of ${METRIC_LABEL[cc]}${top10 !== null ? ` and the top 10 hold ${fmtPct(top10)}` : ""}; ${points[0].name} alone is ${fmtPct(points[0].share)}.`;
  }, [points, n, cc]);

  return (
    <div className="space-y-4">
      <KpiTiles projects={filtered} total={all.length} />

      <ChainOverTime range={range} />
      <ChainActivity range={range} />
      <MoversPanel projects={filtered} metric={mv} onMetricChange={(m) => void setState({ mv: m })} range={range} minSize={state.minSize} onMinSizeChange={(minSize) => void setState({ minSize })} onOpen={openProject} />

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          id="sectors"
          className="xl:col-span-2"
          title={level.sector ? `${level.sector} by ${label}` : `Sectors by ${label}`}
          takeaway={treemapTakeaway}
          info={`Each box is sized by ${label} for the current selection and coloured by the share of its projects classified as NEAR native. Money metrics come from DefiLlama (blank rows excluded, not zero); project counts, subcategories and the Native Chain classification come from the research CSVs. Click a sector to open it; inside, projects group by subcategory when a sector has three or more, otherwise they show one by one with the untracked ones in a single Not tracked box. Filtering to a sector is its own control in the breadcrumb.`}
          source="Research CSV sectors and subcategories, DefiLlama metrics"
          actions={<MetricSegmented value={tm} onChange={(m) => void setState({ tm: m })} ariaLabel="Treemap metric" />}
          footer={tm === "tvl" ? <TvlNote /> : undefined}
          table={sectorTreemapTable(level, tm)}
        >
          <SectorTreemap
            projects={filtered}
            metric={tm}
            sector={tmSector}
            onSectorChange={(s) => void setState({ tmSector: s })}
            onOpenProject={openProject}
            onFilterSector={(s) => setFacet("sector", [s])}
          />
        </ChartCard>
        <InsightsPanel projects={filtered} metric={ins} onMetricChange={(m) => void setState({ ins: m })} total={all.length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          id="native-vs-imported"
          title="Native vs imported"
          takeaway={stackTakeaway}
          info="100% stacked bars. Each row splits one metric across the six Native Chain classifications from the research CSVs. Projects counts every row in the selection; TVL, 30d volume, 30d fees and 30d revenue use DefiLlama figures and only the projects that report one."
          source="Research CSV Native Chain column, DefiLlama metrics"
          footer={<TvlNote />}
          table={nativeStackTable(stackRows)}
        >
          <NativeStackedBar projects={filtered} />
        </ChartCard>
        <ChartCard
          id="concentration"
          title="Concentration curve"
          takeaway={curveTakeaway}
          info={`Projects with a DefiLlama value for ${METRIC_LABEL[cc]}, ranked largest first, plotted as cumulative share of the selection total. Markers show the top 3 and top 10. The log toggle applies to the rank axis.`}
          source="DefiLlama protocol metrics"
          actions={<NumericMetricSegmented value={cc} onChange={(m) => void setState({ cc: m })} ariaLabel="Concentration metric" />}
          scale={scale}
          onScaleChange={(s) => void setState({ scale: s })}
          footer={cc === "tvl" ? <TvlNote /> : undefined}
          table={concentrationTable(points, cc)}
        >
          <ConcentrationCurve projects={filtered} metric={cc} scale={scale} onOpen={openProject} />
        </ChartCard>
      </div>

      <Timeline events={events} defaultStart={TIMELINE_DEFAULT_START} />

      <p className="text-label text-ink-300">
        Selection, {fmtInt(n)} of {fmtInt(all.length)} projects
        {tm !== "count" && level.mode === "sectors" && `, selection total by ${label} ${fmtMetric(tm, level.total || null)}`}
      </p>
    </div>
  );
}
