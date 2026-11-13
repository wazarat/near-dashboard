"use client";

import { useEffect, useRef } from "react";
import { Brush, Line, LineChart, ResponsiveContainer } from "recharts";
import { useChartFrame } from "./chart-frame";
import { fmtDateShort } from "@/lib/format";

/**
 * One brush for a card of several panels (standard section 6). It draws a
 * small preview series and writes the chosen index window into the chart
 * frame, which every panel slices by. Rendered only inside the expand dialog.
 */
export function RangeBrush({ dates, preview, color = "var(--cat-1)", label = "Zoom into a period" }: { dates: string[]; preview: Array<number | null>; color?: string; label?: string }) {
  const frame = useChartFrame(44);
  // A new range (7d, 30d, 90d, All) gives a different set of dates, so a zoom chosen on the old set is dropped
  // rather than slicing the new one by stale positions.
  const windowKey = `${dates[0] ?? ""}|${dates.length}`;
  const lastKey = useRef(windowKey);
  const { setBrushRange } = frame;
  useEffect(() => {
    if (lastKey.current === windowKey) return;
    lastKey.current = windowKey;
    setBrushRange(null);
  }, [windowKey, setBrushRange]);
  if (!frame.brush || dates.length < 3) return null;
  const rows = dates.map((d, i) => ({ date: d, v: preview[i] ?? null }));
  return (
    <div className="mt-3" aria-label={label}>
      <div key={windowKey} style={{ height: 56 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 2, right: 8, bottom: 0, left: 8 }}>
            <Line type="monotone" dataKey="v" stroke={color} dot={false} strokeWidth={1} isAnimationActive={false} connectNulls={false} />
            <Brush
              dataKey="date"
              height={30}
              travellerWidth={8}
              tickFormatter={fmtDateShort}
              stroke="var(--axis)"
              fill="var(--surface-chart)"
              startIndex={frame.brushRange?.[0]}
              endIndex={frame.brushRange?.[1]}
              onChange={(r) => {
                if (r.startIndex === undefined || r.endIndex === undefined) return;
                frame.setBrushRange(r.startIndex === 0 && r.endIndex === rows.length - 1 ? null : [r.startIndex, r.endIndex]);
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-label text-ink-300">Drag the handles to zoom every panel into a period.</p>
    </div>
  );
}
