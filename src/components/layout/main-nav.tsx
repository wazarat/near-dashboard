"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CARRIED_PARAMS } from "@/lib/filters";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/", label: "Overview" },
  { href: "/sectors/", label: "Sectors" },
  { href: "/traction/", label: "Traction" },
  { href: "/intents/", label: "Intents" },
  { href: "/thesis/", label: "Thesis" },
  { href: "/funding/", label: "Funding" },
  { href: "/investors/", label: "Investors" },
  { href: "/security/", label: "Security" },
  { href: "/explorer/", label: "Explorer" },
  { href: "/compare/", label: "Compare" },
] as const;

/** Keeps the shareable state (range, scale, compare selection) when moving between pages. */
export function carriedQuery(params: URLSearchParams | null): string {
  if (!params) return "";
  const out = new URLSearchParams();
  for (const k of CARRIED_PARAMS) {
    const v = params.get(k);
    if (v) out.set(k, v);
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

function NavLinks({ query, compareCount }: { query: string; compareCount: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="overflow-x-auto">
      <ul className="flex h-10 items-stretch gap-1 text-sm xl:h-16">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href.replace(/\/$/, ""));
          return (
            <li key={item.href} className="flex">
              <Link
                href={`${item.href}${query}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex items-center whitespace-nowrap px-2.5 text-control text-ink-300 transition-colors hover:text-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60",
                  "after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent after:content-['']",
                  active && "text-ink-50 after:bg-electric-500",
                )}
              >
                {item.label}
                {item.href === "/compare/" && compareCount > 0 && <span className="ml-1 font-mono text-label text-ink-500">({compareCount})</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Rendered inside a Suspense boundary because it reads the query string. */
export function MainNav() {
  const params = useSearchParams();
  const compare = params?.get("compare");
  return <NavLinks query={carriedQuery(params)} compareCount={compare ? compare.split(",").filter(Boolean).length : 0} />;
}

export function MainNavFallback() {
  return <NavLinks query="" compareCount={0} />;
}
