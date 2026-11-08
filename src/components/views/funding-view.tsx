"use client";

import { useMemo, useState } from "react";
import { FundingTypeBreakdown } from "@/components/charts/funding-type-breakdown";
import { MoneyCards } from "@/components/charts/money-cards";
import { RoundsOverTime } from "@/components/charts/rounds-over-time";
import { RoundsTable } from "@/components/charts/rounds-table";
import { rounds } from "@/lib/data";
import { useFilters } from "@/lib/filters";

/** Funding page: how projects are funded, the headline capital events, and every recorded round. */
export function FundingView() {
  const { filtered, setFacet, openProject, openInvestor } = useFilters();
  const [onlySelection, setOnlySelection] = useState(false);

  const visibleRounds = useMemo(() => {
    if (!onlySelection) return rounds;
    const ids = new Set(filtered.map((p) => p.id));
    return rounds.filter((r) => r.projectId !== null && ids.has(r.projectId));
  }, [filtered, onlySelection]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-5">
        <FundingTypeBreakdown className="xl:col-span-2" projects={filtered} onSelect={(bucket) => setFacet("funding", [bucket])} />
        <MoneyCards className="xl:col-span-3" onOpenProject={openProject} />
      </div>
      <RoundsOverTime rounds={visibleRounds} />
      <RoundsTable rounds={rounds} visible={visibleRounds} onlySelection={onlySelection} onOnlySelectionChange={setOnlySelection} onOpenProject={openProject} onOpenInvestor={openInvestor} />
    </div>
  );
}

