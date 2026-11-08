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

/** Keeps the shareable state (metric, range, compare selection) when moving between pages. */
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
    <nav aria-label="Primary" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-1 text-sm">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href.replace(/\/$/, ""));
          return (
            <li key={item.href}>
              <Link
                href={`${item.href}${query}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active && "bg-accent text-foreground",
                )}
              >
                {item.label}
                {item.href === "/compare/" && compareCount > 0 && (
                  <span className="rounded bg-foreground px-1.5 py-px text-[10px] font-semibold text-background">{compareCount}</span>
                )}
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
