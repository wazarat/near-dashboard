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
      <main className={cn("mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6", ids.length > 0 && "pb-24")}>{children}</main>
      <CompareTray />
      <InvestorDrawer />
      <ProjectDrawer />
      <SectorDrawer />
    </>
  );
}
