"use client";

import { AssetsCards } from "@/components/intents/assets";
import { CoverageCard } from "@/components/intents/coverage-card";
import { IntentsKpis } from "@/components/intents/kpi";
import { RatesChart } from "@/components/intents/rates-chart";
import { ReferralsCards } from "@/components/intents/referrals";
import { ChainsCards, RoutesChart } from "@/components/intents/routes";
import { VolumeChart } from "@/components/intents/volume-chart";
import { WeeklyChart } from "@/components/intents/weekly-chart";
import { intentsData } from "@/lib/data";
import { useFilters } from "@/lib/filters";

export function IntentsView() {
  const { range, scale, setState } = useFilters();

  return (
    <div className="space-y-4">
      <IntentsKpis data={intentsData} />
      <VolumeChart data={intentsData} range={range} scale={scale} onScaleChange={(s) => void setState({ scale: s })} />
      <WeeklyChart data={intentsData} />
      <RatesChart data={intentsData} range={range} />
      <RoutesChart data={intentsData} />
      <ChainsCards data={intentsData} />
      <AssetsCards data={intentsData} />
      <ReferralsCards data={intentsData} />
      <CoverageCard data={intentsData} />
    </div>
  );
}
