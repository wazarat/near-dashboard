"use client";

import { useMemo } from "react";
import { ChartCard, EmptyState } from "@/components/atlas/chart-card";
import { DataTable } from "@/components/explorer/data-table";
import { calls30Column, calls7Column, chainColumn, nameColumn, sectorColumn, signersColumn, tierColumn } from "@/components/explorer/project-columns";
import { fmtInt } from "@/lib/format";
import type { Project } from "@/lib/types";

/** Projects with onchain function calls but no TVL: activity the TVL lens misses. */
export function ActivityWithoutTvl({ projects, onOpen }: { projects: Project[]; onOpen: (id: string) => void }) {
  const rows = useMemo(
    () => projects.filter((p) => (p.tvl ?? 0) === 0 && ((p.live?.calls7d ?? 0) > 0 || (p.live?.signers7d ?? 0) > 0)).sort((a, b) => (b.live?.calls7d ?? 0) - (a.live?.calls7d ?? 0)),
    [projects],
  );
  const tracked = projects.filter((p) => p.contracts.length > 0).length;
  const takeaway = rows.length
    ? `${rows.length} of the ${tracked} projects with tracked accounts show function calls over the last 7 days without any TVL; ${rows[0].name} leads with ${fmtInt(rows[0].live?.calls7d)} calls.`
    : `None of the ${tracked} projects with tracked accounts shows activity without TVL in this selection.`;
  return (
    <ChartCard
      id="activity-without-tvl"
      title="Activity without TVL"
      takeaway={takeaway}
      info="Projects whose tracked NEAR accounts (data/contracts.csv) received FUNCTION_CALL receipts in the last 7 days per the NEAR BigQuery public dataset but report no TVL on DefiLlama. Wallets, games, payments and social apps show up here. Distinct signers are an estimate."
      table={{
        columns: [
          { key: "name", label: "Project" },
          { key: "sector", label: "Sector" },
          { key: "calls7d", label: "7d calls", align: "right" },
          { key: "calls30d", label: "30d calls", align: "right" },
          { key: "signers7d", label: "7d signers (est.)", align: "right" },
        ],
        rows: rows.map((p) => ({ name: p.name, sector: p.sector, calls7d: p.live?.calls7d, calls30d: p.live?.calls30d, signers7d: p.live?.signers7d })),
        filename: "activity-without-tvl.csv",
      }}
    >
      {rows.length === 0 ? <EmptyState message={takeaway} /> : <DataTable data={rows} columns={[nameColumn(onOpen), sectorColumn, chainColumn, tierColumn, calls7Column, calls30Column, signersColumn]} pageSize={10} dense getRowId={(p) => p.id} onRowClick={(p) => onOpen(p.id)} />}
    </ChartCard>
  );
}
