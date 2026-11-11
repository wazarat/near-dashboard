"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useFilters } from "@/lib/filters";

/**
 * The Explorer's own wide search box. It writes the same `q` URL key as the filter bar,
 * debounced, so both boxes always show the same text and match the same fields. `/` focuses it.
 */
export function ExplorerSearch({ count, trailing }: { count: number; /** Controls pushed to the right end of the search row. */ trailing?: React.ReactNode }) {
  const { state, setState } = useFilters();
  const [text, setText] = useState(state.q);
  const [seenQ, setSeenQ] = useState(state.q);
  const ref = useRef<HTMLInputElement>(null);

  // Follow edits made in the filter bar (adjusting state during render, not in an effect).
  if (state.q !== seenQ) {
    setSeenQ(state.q);
    setText(state.q);
  }

  useEffect(() => {
    if (text === state.q) return;
    const t = setTimeout(() => void setState({ q: text }), 200);
    return () => clearTimeout(t);
  }, [text, state.q, setState]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
      <div className="relative w-full sm:w-auto sm:max-w-xl sm:flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" aria-hidden />
        <Input
          ref={ref}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search projects by name, description, token or X handle"
          aria-label="Explorer search"
          title="Searches name, description, X handle, subcategory and token. Press / to focus."
          className="h-10 rounded-lg border-ink-700/60 bg-ink-900 pl-9 text-sm"
          data-testid="explorer-search"
        />
      </div>
      <span className="tabular text-sm text-ink-300" data-testid="explorer-count">
        {count.toLocaleString("en-US")} {count === 1 ? "project" : "projects"}
      </span>
      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}
