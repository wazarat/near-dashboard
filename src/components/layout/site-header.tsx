import Link from "next/link";
import { Suspense } from "react";
import { DataFreshness } from "@/components/atlas/data-freshness";
import { MainNav, MainNavFallback } from "./main-nav";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link href="/" className="block text-lg font-semibold leading-tight tracking-tight sm:text-xl">
              NEAR Ecosystem Atlas
            </Link>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Independent research by CanHav Research, built for NEAR Hackathon 2026</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <DataFreshness className="hidden sm:inline-flex" />
            <ThemeToggle />
          </div>
        </div>
        <Suspense fallback={<MainNavFallback />}>
          <MainNav />
        </Suspense>
      </div>
    </header>
  );
}
