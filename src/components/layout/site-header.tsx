import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AuthControls } from "@/components/auth/auth-controls";
import { SITE } from "@/lib/site";
import { MainNav, MainNavFallback } from "./main-nav";
import { SubmitProjectButton } from "./submit-project-button";
import { ThemeToggle } from "./theme-toggle";

/**
 * Page frame header (standard sections 1 and 3). Row one is the two-line lockup (the CanHav
 * mark, "CanHav Research", then the atlas name with its Beta tag) and, on the right, "Submit a
 * project", the login control and the theme toggle. Row two is the page tabs. Ten tabs do not
 * fit beside the lockup inside the container, so they keep their own row at every width.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-ink-700/40 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-atlas flex-col px-5 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-4">
          <Link
            href="/"
            aria-label={`${SITE.name}, ${SITE.atlas}, beta, home`}
            className="flex min-w-0 shrink-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60"
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
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <SubmitProjectButton iconOnlyBelowSm />
            <AuthControls />
            <ThemeToggle />
          </div>
        </div>
        <div className="-mx-5 border-t border-ink-700/40 px-5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <Suspense fallback={<MainNavFallback />}>
            <MainNav />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
