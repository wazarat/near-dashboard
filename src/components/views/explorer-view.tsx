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
  riskColumn,
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useFilters } from "@/lib/filters";

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

export function ExplorerView() {
  const { filtered, openProject } = useFilters();
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
      riskColumn,
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
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <h2 className="text-sm font-semibold">Explorer</h2>
          <p className="text-sm text-muted-foreground">Every project in the current selection with every research column. Click a name or row for the full record and its sources; use Columns to show more fields.</p>
        </CardHeader>
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
      </Card>
    </div>
  );
}

/** Name the route file imports. */
