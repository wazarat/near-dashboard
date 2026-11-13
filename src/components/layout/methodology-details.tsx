"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * The footer's Methodology section as a dropdown, closed by default. A link to #methodology (the footer link, the
 * About page, a shared URL) opens it and scrolls to it, so the section is never hidden behind a link that points at it.
 */
export function MethodologyDetails({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const reveal = () => {
      const el = ref.current;
      if (!el) return;
      el.open = true;
      el.scrollIntoView({ block: "start" });
    };
    if (window.location.hash === "#methodology") reveal();
    const onHash = () => window.location.hash === "#methodology" && reveal();
    // A click on a link to the section when the hash is already #methodology fires no hashchange, so clicks are caught too.
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('a[href="#methodology"]')) reveal();
    };
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
    };
  }, []);
  return (
    <details ref={ref} id="methodology" aria-labelledby="methodology-title" className="group text-sm text-ink-300">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60 [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden="true" className="size-5 -rotate-90 text-ink-300 transition-transform group-open:rotate-0" />
        <h2 id="methodology-title" className="text-title text-ink-50">
          Methodology
        </h2>
      </summary>
      {children}
    </details>
  );
}
