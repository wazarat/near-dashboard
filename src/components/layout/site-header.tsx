import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AuthControls } from "@/components/auth/auth-controls";
import { SITE } from "@/lib/site";
import { MainNav, MainNavFallback } from "./main-nav";
import { SubmitProjectButton } from "./submit-project-button";
import { ThemeToggle } from "./theme-toggle";

/**
 * Page frame header (standard sections 1 and 3): the two-line lockup (the CanHav mark,
 * "CanHav Research", then the atlas name with its Beta tag), the page tabs, then "Submit a
 * project", the login control and the theme toggle, as on the Robinhood atlas. Ten tabs fit
 * between the lockup and the controls from 1360px; below that they drop to a second row that
 * scrolls sideways.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-ink-700/40 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto grid w-full max-w-atlas grid-cols-[1fr_auto] items-center gap-x-4 px-5 sm:px-6 lg:px-8 min-[1360px]:grid-cols-[auto_1fr_auto]">
        <Link
          href="/"
          aria-label={`${SITE.name}, ${SITE.atlas}, beta, home`}
          className="flex h-16 min-w-0 shrink-0 items-center gap-3 justify-self-start rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60"
        >
          <Image src="/mark.svg" alt="" width={44} height={44} priority className="size-11 shrink-0 object-contain" />
          <span className="flex min-w-0 flex-col justify-center gap-0.5">
            <span className="whitespace-nowrap font-display text-base font-semibold leading-tight tracking-tight text-ink-50">{SITE.name}</span>
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-[13px] leading-tight text-ink-300">{SITE.atlas}</span>
              <span className="rounded-full border border-electric-500/70 px-2 py-px text-[10px] font-semibold uppercase leading-3.5 tracking-[0.08em] text-electric-300">Beta</span>
            </span>
          </span>
        </Link>
        <div className="flex h-16 shrink-0 items-center justify-end gap-2 min-[1360px]:col-start-3" data-testid="header-actions">
          <SubmitProjectButton iconOnlyBelowSm />
          <AuthControls />
          <ThemeToggle />
        </div>
        <div
          className="col-span-2 -mx-5 min-w-0 border-t border-ink-700/40 px-5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 min-[1360px]:col-span-1 min-[1360px]:col-start-2 min-[1360px]:row-start-1 min-[1360px]:mx-0 min-[1360px]:justify-self-center min-[1360px]:border-t-0 min-[1360px]:px-0"
          data-testid="header-tabs"
        >
          <Suspense fallback={<MainNavFallback />}>
            <MainNav />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
