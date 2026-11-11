"use client";

import { usePathname } from "next/navigation";
import { LoginDialog, PendingActionReplay } from "@/components/auth/login-dialog";
import { LoginWall } from "@/components/auth/login-wall";
import { FilterBar } from "@/components/filters/filter-bar";
import { CompareTray } from "@/components/compare/compare-tray";
import { FundingTypeModal } from "@/components/drawer/funding-type-modal";
import { InvestorModal } from "@/components/drawer/investor-modal";
import { ProjectModal } from "@/components/drawer/project-modal";
import { SectorModal } from "@/components/drawer/sector-modal";
import { useAccess } from "@/lib/access";
import { AnalyticsEvents } from "./analytics-events";
import { useCompare } from "@/lib/compare";
import { cn } from "@/lib/utils";

export function AtlasShell({ children }: { children: React.ReactNode }) {
  const { ids } = useCompare();
  const pathname = usePathname();
  // On a walled page the login pop-up is the only thing on top; a detail pop-up from the URL waits for login.
  const walled = !useAccess().can({ path: pathname });
  return (
    <>
      <FilterBar />
      <main className={cn("mx-auto w-full max-w-atlas flex-1 px-5 py-8 sm:px-6 lg:px-8", ids.length > 0 && "pb-28")}>
        <LoginWall pathname={pathname}>{children}</LoginWall>
      </main>
      <CompareTray />
      {!walled && (
        <>
          <FundingTypeModal />
          <InvestorModal />
          <ProjectModal />
          <SectorModal />
        </>
      )}
      <LoginDialog />
      <PendingActionReplay />
      <AnalyticsEvents />
    </>
  );
}
