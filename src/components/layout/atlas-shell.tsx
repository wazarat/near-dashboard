"use client";

import { FilterBar } from "@/components/filters/filter-bar";
import { ProjectDrawer } from "@/components/drawer/project-drawer";
import { SectorDrawer } from "@/components/drawer/sector-drawer";

export function AtlasShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FilterBar />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6">{children}</main>
      <ProjectDrawer />
      <SectorDrawer />
    </>
  );
}
