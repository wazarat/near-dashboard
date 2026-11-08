"use client";

import { FilterBar } from "@/components/filters/filter-bar";
import { CompareTray } from "@/components/compare/compare-tray";
import { InvestorDrawer } from "@/components/drawer/investor-drawer";
import { ProjectDrawer } from "@/components/drawer/project-drawer";
import { SectorDrawer } from "@/components/drawer/sector-drawer";
import { useCompare } from "@/lib/compare";
import { cn } from "@/lib/utils";

export function AtlasShell({ children }: { children: React.ReactNode }) {
  const { ids } = useCompare();
  return (
    <>
      <FilterBar />
      <main className={cn("mx-auto w-full max-w-atlas flex-1 px-5 py-8 sm:px-6 lg:px-8", ids.length > 0 && "pb-28")}>{children}</main>
      <CompareTray />
      <InvestorDrawer />
      <ProjectDrawer />
      <SectorDrawer />
    </>
  );
}
