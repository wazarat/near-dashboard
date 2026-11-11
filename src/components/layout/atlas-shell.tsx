"use client";

import { FilterBar } from "@/components/filters/filter-bar";
import { CompareTray } from "@/components/compare/compare-tray";
import { InvestorModal } from "@/components/drawer/investor-modal";
import { ProjectModal } from "@/components/drawer/project-modal";
import { SectorModal } from "@/components/drawer/sector-modal";
import { useCompare } from "@/lib/compare";
import { cn } from "@/lib/utils";

export function AtlasShell({ children }: { children: React.ReactNode }) {
  const { ids } = useCompare();
  return (
    <>
      <FilterBar />
      <main className={cn("mx-auto w-full max-w-atlas flex-1 px-5 py-8 sm:px-6 lg:px-8", ids.length > 0 && "pb-28")}>{children}</main>
      <CompareTray />
      <InvestorModal />
      <ProjectModal />
      <SectorModal />
    </>
  );
}
