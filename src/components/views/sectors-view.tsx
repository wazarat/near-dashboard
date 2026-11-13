"use client";

import { useMemo } from "react";
import { ChartCard, TvlNote } from "@/components/atlas/chart-card";
import { MetricSegmented } from "@/components/atlas/chart-metric";
import { SectorBars, sectorBarRows, sectorBarTable } from "@/components/charts/sector-bars";
import { SectorGrid, sectorCards, sectorCardTable } from "@/components/charts/sector-grid";
import { TierBySector, tierRows, tierTable } from "@/components/charts/tier-by-sector";
import { useFilters } from "@/lib/filters";
import { fmtInt, fmtMetric, fmtPct, METRIC_LABEL } from "@/lib/format";
import { SPECS } from "@/lib/query-specs";

export function SectorsView() {
  const { projectsFor, scale, state, setState, openSector, openProject } = useFilters();
  const { sb, sg } = state;
  const label = METRIC_LABEL[sb].toLowerCase();
  const cardLabel = METRIC_LABEL[sg].toLowerCase();
  // Each card follows its own legacy-listing switch.
  const barProjects = projectsFor("sector-bars");
  const tierProjects = projectsFor("tier-by-sector");
  const cardProjects = projectsFor("sector-cards");

  const barRows = useMemo(() => sectorBarRows(barProjects, sb), [barProjects, sb]);
  const barTakeaway = useMemo(() => {
    if (barProjects.length === 0) return "No projects match the current filters.";
    const total = barRows.reduce((a, r) => a + r.total, 0);
    const withData = barRows.filter((r) => r.total > 0).length;
    if (withData === 0) return `No ${label} data in this selection.`;
    const top = barRows[0];
    const topShare = total > 0 ? top.total / total : null;
    if (sb === "count") {
      return `${top.sector} has the most projects (${fmtInt(top.total)}, ${fmtPct(topShare)} of the selection) across ${barRows.length} sectors.`;
    }
    return `${top.sector} leads ${label} with ${fmtMetric(sb, top.total)} (${fmtPct(topShare)} of the selection); ${withData} of ${barRows.length} sectors report any ${label}.`;
  }, [barRows, barProjects.length, sb, label]);

  const tiers = useMemo(() => tierRows(tierProjects), [tierProjects]);
  const tierTakeaway = useMemo(() => {
    const n = tierProjects.length;
    if (n === 0) return "No projects match the current filters.";
    const tracked = tiers.reduce((a, r) => a + r.tracked, 0);
    const t1 = tiers.reduce((a, r) => a + r["Tier 1 - Leader"], 0);
    const t1Sectors = tiers.filter((r) => r["Tier 1 - Leader"] > 0);
    const lead = [...t1Sectors].sort((a, b) => b["Tier 1 - Leader"] - a["Tier 1 - Leader"])[0];
    const base = `${fmtInt(tracked)} of ${fmtInt(n)} projects (${fmtPct(tracked / n)}) have a DefiLlama listing`;
    if (t1 === 0) return `${base}; no Tier 1 leaders in this selection.`;
    return `${base}; the ${t1} Tier 1 leader${t1 === 1 ? "" : "s"} sit${t1 === 1 ? "s" : ""} in ${t1Sectors.length} sector${t1Sectors.length === 1 ? "" : "s"}, most in ${lead.sector} (${lead["Tier 1 - Leader"]}).`;
  }, [tiers, tierProjects.length]);

  const cards = useMemo(() => sectorCards(cardProjects, sg), [cardProjects, sg]);
  const gridTakeaway = useMemo(() => {
    if (cardProjects.length === 0) return "No projects match the current filters.";
    const sized = cards.filter((c) => c.count >= 5 && c.nativeShare !== null);
    if (sized.length < 2) return `${cards.length} sector${cards.length === 1 ? "" : "s"} in the selection.`;
    const byNative = [...sized].sort((a, b) => (b.nativeShare as number) - (a.nativeShare as number));
    const most = byNative[0];
    const least = byNative[byNative.length - 1];
    return `Among ${sized.length} sectors with five or more projects, ${most.sector} is the most NEAR-native (${fmtPct(most.nativeShare)}) and ${least.sector} the least (${fmtPct(least.nativeShare)}).`;
  }, [cards, cardProjects.length]);

  return (
    <div className="space-y-4">
      <ChartCard
        id="sector-bars"
        method={{ sentence: "Every sector in the selection ranked by the chosen metric, summed over its projects.", queries: [SPECS.llamaProtocolTvl, SPECS.llamaProtocolFlows, SPECS.snapshotCsv, SPECS.sectorTotals] }}
        title={`Sectors by ${label}`}
        takeaway={barTakeaway}
        info={`All sectors in the current selection ranked by ${label}. Money metrics are summed from DefiLlama (blank rows excluded); project counts come from the research CSVs. Sectors with no data are hidden on the log scale. Click a bar or a sector name to open the sector pop-up.`}
        actions={<MetricSegmented value={sb} onChange={(m) => void setState({ sb: m })} ariaLabel="Sector bars metric" />}
        scale={sb === "count" ? undefined : scale}
        onScaleChange={(s) => void setState({ scale: s })}
        footer={sb === "tvl" ? <TvlNote /> : undefined}
        table={sectorBarTable(barRows, sb)}
        legacyCard="sector-bars"
      >
        <SectorBars projects={barProjects} metric={sb} scale={scale} onSelect={openSector} />
      </ChartCard>

      <ChartCard
        id="tier-by-sector"
        method={{ sentence: "How many projects in each sector sit in each traction tier, where a tier is set by TVL, 30-day volume and 30-day fees.", queries: [SPECS.llamaProtocolTvl, SPECS.llamaProtocolFlows, SPECS.snapshotCsv, SPECS.tierCounts] }}
        title="Traction tier by sector"
        takeaway={tierTakeaway}
        info="Project counts per traction tier within each sector. Tiers come from the research CSVs. Tier 1 to 3 rank projects with measurable DefiLlama traction, Tracked negligible means a DefiLlama listing with every figure at zero, TBD means no listing yet so the tier is to be determined. Click a bar to open the sector pop-up."
        table={tierTable(tiers)}
        legacyCard="tier-by-sector"
      >
        <TierBySector projects={tierProjects} onSelect={openSector} />
      </ChartCard>

      <ChartCard
        id="sector-cards"
        method={{ sentence: "One card per sector with its project count, NEAR-native share, projects with measurable traction and the chosen metric.", queries: [SPECS.llamaProtocolTvl, SPECS.llamaProtocolFlows, SPECS.snapshotCsv, SPECS.sectorCards] }}
        title="Sector cards"
        takeaway={gridTakeaway}
        info={`One card per sector in the selection, with project count, NEAR-native share, projects with any measurable traction and the summed ${cardLabel}. Counts and the Native Chain classification come from the research CSVs; money metrics from DefiLlama. Ranked leaders come from the research leaders CSV and do not change with the filters.`}
        actions={<MetricSegmented value={sg} onChange={(m) => void setState({ sg: m })} ariaLabel="Sector cards metric" />}
        footer={sg === "tvl" ? <TvlNote /> : undefined}
        table={sectorCardTable(cards, sg)}
        legacyCard="sector-cards"
      >
        <SectorGrid projects={cardProjects} metric={sg} onSelect={openSector} onOpen={openProject} />
      </ChartCard>
    </div>
  );
}
