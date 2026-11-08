import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { MainNav, MainNavFallback } from "./main-nav";
import { SubmitProjectButton } from "./submit-project-button";
import { ThemeToggle } from "./theme-toggle";

/**
 * Page frame header (standard section 3): mark and product name on the left,
 * the page tabs, then "Submit a project" and the theme toggle. Nothing else.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-ink-700/40 bg-ink-950">
      <div className="mx-auto flex w-full max-w-atlas flex-col px-5 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60">
            <Image src="/mark.svg" alt="" width={28} height={28} priority className="size-7 object-contain" />
            <span className="flex flex-col leading-tight">
              <span className="font-display text-base font-semibold tracking-tight text-ink-50">CanHav Atlas</span>
              <span className="text-label text-ink-300">NEAR and Aurora</span>
            </span>
          </Link>
          <div className="hidden min-w-0 flex-1 xl:block">
            <Suspense fallback={<MainNavFallback />}>
              <MainNav />
            </Suspense>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <SubmitProjectButton />
            <ThemeToggle />
          </div>
        </div>
        <div className="-mx-5 border-t border-ink-700/40 px-5 sm:-mx-6 sm:px-6 xl:hidden">
          <Suspense fallback={<MainNavFallback />}>
            <MainNav />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
