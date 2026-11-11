"use client";

import { useMemo } from "react";
import { DataTable, type ProjectColumnDef } from "@/components/explorer/data-table";
import { DownloadCsv } from "@/components/explorer/download-csv";
import { NewlyDetectedCard } from "@/components/explorer/newly-detected";
import {
  amountColumn,
  auditsColumn,
  captureColumn,
  chainColumn,
  chainDetailColumn,
  descriptionColumn,
  feesColumn,
  fundingColumn,
  incidentsColumn,
  investorsColumn,
  nameColumn,
  otherTractionColumn,
  presenceColumn,
  redFlagsColumn,
  revenueColumn,
  sectorColumn,
  statusColumn,
  subcategoryColumn,
  tierColumn,
  tokenColumn,
  tvlAuroraColumn,
  tvlColumn,
  tvlNearColumn,
  viaColumn,
  volumeColumn,
  websiteColumn,
  xColumn,
} from "@/components/explorer/project-columns";
import { ScopeNote, TvlNote } from "@/components/atlas/chart-card";
import { MetricSegmented } from "@/components/atlas/chart-metric";
import { SectorTreemap } from "@/components/charts/sector-treemap";
import { ExplorerSearch } from "@/components/explorer/explorer-search";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { useFilters, type ExplorerViewMode } from "@/lib/filters";
import { METRIC_LABEL } from "@/lib/format";

/** Columns hidden until the reader picks them from the chooser. */
const INITIAL_VISIBILITY: Record<string, boolean> = {
  subcategory: false,
  chainDetail: false,
  presence: false,
  tvlNear: false,
  tvlAurora: false,
  otherTraction: false,
  investors: false,
  amountRaised: false,
  token: false,
  audits: false,
  incidents: false,
  redFlags: false,
  description: false,
  website: false,
  x: false,
};

const VIEW_OPTIONS: Array<{ value: ExplorerViewMode; label: string }> = [
  { value: "map", label: "Map" },
  { value: "table", label: "Table" },
];

/**
 * Explorer: every project in the selection as a table (the default) or as the sector map
 * (?view=map), the Overview treemap with its zoom over the same list, so the two views always agree.
 */
export function ExplorerView() {
  const { filtered, openProject, state, setState, setFacet } = useFilters();
  const { view, tm, tmSector } = state;
  const columns = useMemo<ProjectColumnDef[]>(
    () => [
      nameColumn(openProject),
      sectorColumn,
      subcategoryColumn,
      chainColumn,
      chainDetailColumn,
      presenceColumn,
      tierColumn,
      statusColumn,
      tvlColumn,
      tvlNearColumn,
      tvlAuroraColumn,
      volumeColumn,
      feesColumn,
      revenueColumn,
      captureColumn,
      otherTractionColumn,
      fundingColumn,
      investorsColumn,
      amountColumn,
      tokenColumn,
      auditsColumn,
      incidentsColumn,
      redFlagsColumn,
      viaColumn,
      descriptionColumn,
      websiteColumn,
      xColumn,
    ],
    [openProject],
  );

  return (
    <div className="space-y-4">
      <NewlyDetectedCard />
      <Card className="gap-3 py-4" data-testid="explorer-card">
        <CardHeader className="gap-3 px-4">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="min-w-[min(15rem,100%)] flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h2 className="text-sm font-semibold">Explorer</h2>
                <ScopeNote />
              </div>
              <p className="mt-1 text-sm text-ink-300">
                {view === "map"
                  ? `Every project in the current selection, grouped by sector and sized by ${METRIC_LABEL[tm].toLowerCase()}. Click a sector to open it, then a project for the full record and its sources.`
                  : "Every project in the current selection with every research column. Click a name or row for the full record and its sources; use Columns to show more fields."}
              </p>
            </div>
            <div className="flex max-w-full flex-wrap items-center gap-2">
              {view === "map" && <MetricSegmented value={tm} onChange={(m) => void setState({ tm: m })} ariaLabel="Map metric" />}
              <Segmented value={view} onChange={(v) => void setState({ view: v })} options={VIEW_OPTIONS} ariaLabel="Explorer view" role="tablist" />
            </div>
          </div>
          <ExplorerSearch count={filtered.length} />
        </CardHeader>
        {view === "map" ? (
          <CardContent className="space-y-2 px-4" data-testid="explorer-map">
            <SectorTreemap
              projects={filtered}
              metric={tm}
              sector={tmSector}
              onSectorChange={(s) => void setState({ tmSector: s })}
              onOpenProject={openProject}
              onFilterSector={(s) => setFacet("sector", [s])}
              height={480}
            />
            {tm === "tvl" && filtered.length > 0 && (
              <p className="text-xs text-ink-300">
                <TvlNote />
              </p>
            )}
          </CardContent>
        ) : (
          <CardContent className="px-0">
            <DataTable
              data={filtered}
              columns={columns}
              chooser
              dense
              pageSize={50}
              initialSorting={[{ id: "tvl", desc: true }]}
              initialVisibility={INITIAL_VISIBILITY}
              onRowClick={(p) => openProject(p.id)}
              getRowId={(p) => p.id}
              toolbar={<DownloadCsv rows={filtered} />}
              footer={<p>Not tracked means DefiLlama does not report the metric for the project, never zero. Not researched means the field was never checked.</p>}
            />
          </CardContent>
        )}
      </Card>
    </div>
  );
}

/** Name the route file imports. */
