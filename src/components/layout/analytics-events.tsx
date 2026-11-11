"use client";

import { usePathname } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";
import { useEffect, useRef } from "react";
import { useAccess } from "@/lib/access";
import { projectById } from "@/lib/data";
import { authOf, FILTER_KEYS, trackChartExpand, trackFilterUse, trackInvestorOpen, trackProjectOpen, trackSectorOpen, trackTabView, type FilterKey } from "@/lib/track";

/**
 * Page-level analytics events read from the URL (src/lib/track.ts): a tab view per page; a project,
 * sector or investor open whenever its key points at a new one (a shared link included); a chart
 * expand; and a filter use the first time a reader changes each filter on a page. Values a link
 * arrived with are not counted as filter use. Only closed-set values leave the page: a sector's
 * name from the fixed sector list, a chart's id, a filter's key, never what was typed or which
 * investor was opened.
 */
const URL_KEYS = Object.fromEntries([...FILTER_KEYS, "project", "sectorDrawer", "investor", "expand"].map((k) => [k, parseAsString]));

export function AnalyticsEvents() {
  const access = useAccess();
  const pathname = usePathname();
  const [params] = useQueryStates(URL_KEYS);
  const auth = authOf(access);
  const ready = access.loaded;

  // tab_view, once auth is known. Only a new page counts, not a later change of auth on the same page.
  useEffect(() => {
    if (ready) trackTabView(pathname, auth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, ready]);

  const project = params.project;
  useEffect(() => {
    if (!ready || !project) return;
    const p = projectById(project);
    if (p) trackProjectOpen(p.sector, auth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, ready]);

  const sector = params.sectorDrawer;
  useEffect(() => {
    if (ready && sector) trackSectorOpen(sector, auth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sector, ready]);

  const investor = params.investor;
  useEffect(() => {
    if (ready && investor) trackInvestorOpen(pathname, auth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investor, ready]);

  const expand = params.expand;
  useEffect(() => {
    if (ready && expand) trackChartExpand(expand, auth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expand, ready]);

  // filter_use: compare each filter with the values the page started with; count each filter once per page view.
  const baseline = useRef<{ path: string; values: Map<string, string>; used: Set<string> } | null>(null);
  const filterValues = FILTER_KEYS.map((k) => params[k] ?? "").join("|");
  useEffect(() => {
    const now = new Map<string, string>(FILTER_KEYS.map((k) => [k, params[k] ?? ""]));
    const b = baseline.current;
    if (!b || b.path !== pathname) {
      baseline.current = { path: pathname, values: now, used: new Set() };
      return;
    }
    for (const k of FILTER_KEYS as readonly FilterKey[]) {
      if (now.get(k) !== b.values.get(k) && !b.used.has(k)) {
        b.used.add(k);
        trackFilterUse(k, pathname);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, filterValues]);

  return null;
}
