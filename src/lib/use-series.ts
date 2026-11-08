"use client";

import { useEffect, useState } from "react";
import { loadSeries } from "./data";
import type { SeriesFile } from "./types";

let cached: SeriesFile | null = null;

/** Lazily loads the 90-day per-project series once per page. */
export function useSeries(): SeriesFile | null {
  const [series, setSeries] = useState<SeriesFile | null>(cached);
  useEffect(() => {
    if (cached) return;
    let alive = true;
    void loadSeries().then((s) => {
      cached = s;
      if (alive) setSeries(s);
    });
    return () => {
      alive = false;
    };
  }, []);
  return series;
}
