"use client";

import { useMemo } from "react";
import { ChartCard, TvlNote } from "@/components/atlas/chart-card";
import { MetricSegmented, NumericMetricSegmented } from "@/components/atlas/chart-metric";
import { ChainActivity } from "@/components/charts/chain-activity";
import { ChainOverTime } from "@/components/charts/chain-over-time";
import { MoversPanel } from "@/components/charts/movers-panel";
import { ConcentrationCurve, concentrationTable } from "@/components/charts/concentration-curve";
import { EventTimeline, eventTable } from "@/components/charts/event-timeline";
import { InsightsPanel } from "@/components/charts/insights-panel";
import { KpiTiles } from "@/components/charts/kpi-tiles";
import { NativeStackedBar, nativeStackRows, nativeStackTable } from "@/components/charts/native-stacked-bar";
import { SectorTreemap, sectorTreemapRows, sectorTreemapTable } from "@/components/charts/sector-treemap";
import { events } from "@/lib/data";
import { useFilters } from "@/lib/filters";
import { fmtInt, fmtMetric, fmtMonthYear, fmtPct, METRIC_LABEL } from "@/lib/format";
import { concentration, nativeShare, topNShare } from "@/lib/metrics";
import { EVENT_TYPES } from "@/lib/types";

export function OverviewView() {
  const { filtered, all, scale, range, state, setState, setFacet, openProject } = useFilters();
  const { tm, cc, mv, ins } = state;
  const label = METRIC_LABEL[tm].toLowerCase();
  const n = filtered.length;

  const treemapRows = useMemo(() => sectorTreemapRows(filtered, tm), [filtered, tm]);
  const treemapTakeaway = useMemo(() => {
    if (n === 0) return "No projects match the current filters.";
    if (treemapRows.length === 0) return `No ${label} data in this selection.`;
    const total = treemapRows.reduce((a, r) => a + r.size, 0);
    const top = treemapRows[0];
    const majorityNative = treemapRows.filter((r) => (r.nativeShare ?? 0) > 0.5).length;
    return `${top.name} is the largest sector by ${label} with ${fmtPct(total > 0 ? top.size / total : null)} of the selection; ${majorityNative} of ${treemapRows.length} sectors with data are majority NEAR-native.`;
  }, [treemapRows, n, label]);

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

  const timelineTakeaway = useMemo(() => {
    if (events.length === 0) return "No events recorded.";
    const dates = events.map((e) => e.date).sort();
    const counts = EVENT_TYPES.map((t) => ({ t, c: events.filter((e) => e.type === t).length })).sort((a, b) => b.c - a.c);
    const withAmount = events.filter((e) => e.amount !== null).length;
    const incidents = counts.find((c) => c.t === "Incident")?.c ?? 0;
    return `${fmtInt(events.length)} events from ${fmtMonthYear(dates[0])} to ${fmtMonthYear(dates[dates.length - 1])}. ${counts[0].t} leads with ${counts[0].c}, ${incidents} are incidents, and ${withAmount} carry a USD amount.`;
  }, []);

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
          title={`Sectors by ${label}`}
          takeaway={treemapTakeaway}
          info={`Each box is a sector sized by ${label} for the current selection and coloured by the share of its projects classified as NEAR native. Money metrics come from DefiLlama (blank rows excluded, not zero); project counts and the Native Chain classification come from the research CSVs. Click a box to filter to that sector.`}
          actions={<MetricSegmented value={tm} onChange={(m) => void setState({ tm: m })} ariaLabel="Treemap metric" />}
          footer={tm === "tvl" ? <TvlNote /> : undefined}
          table={sectorTreemapTable(treemapRows, tm)}
        >
          <SectorTreemap projects={filtered} metric={tm} onSelect={(s) => setFacet("sector", [s])} />
        </ChartCard>
        <InsightsPanel projects={filtered} metric={ins} onMetricChange={(m) => void setState({ ins: m })} total={all.length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          id="native-vs-imported"
          title="Native vs imported"
          takeaway={stackTakeaway}
          info="100% stacked bars. Each row splits one metric across the six Native Chain classifications from the research CSVs. Projects counts every row in the selection; TVL, 30d volume, 30d fees and 30d revenue use DefiLlama figures and only the projects that report one."
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
          actions={<NumericMetricSegmented value={cc} onChange={(m) => void setState({ cc: m })} ariaLabel="Concentration metric" />}
          scale={scale}
          onScaleChange={(s) => void setState({ scale: s })}
          footer={cc === "tvl" ? <TvlNote /> : undefined}
          table={concentrationTable(points, cc)}
        >
          <ConcentrationCurve projects={filtered} metric={cc} scale={scale} onOpen={openProject} />
        </ChartCard>
      </div>

      <ChartCard
        id="timeline"
        title="Timeline"
        takeaway={timelineTakeaway}
        info="Every dated event from the research events CSV, one lane per type. Marker area follows the recorded Amount (USD); events without an amount use a fixed minimum size. Dates known only to the month sit on the first of that month and are labelled as month only."
        scope="whole-chain"
        table={eventTable(events)}
      >
        <EventTimeline events={events} />
      </ChartCard>

      <p className="text-label text-ink-300">
        Selection, {fmtInt(n)} of {fmtInt(all.length)} projects
        {tm !== "count" && `, selection total by ${label} ${fmtMetric(tm, treemapRows.reduce((a, r) => a + r.size, 0) || null)}`}
      </p>
    </div>
  );
}
