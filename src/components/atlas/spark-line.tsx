"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  points: Array<number | null> | null | undefined;
  width?: number;
  height?: number;
  stroke?: string;
  label: string;
  className?: string;
}

/** Tiny inline trend line: no axes, gaps at null, a dot on the last value. */
export function SparkLine({ points, width = 80, height = 20, stroke = "var(--ink-secondary)", label, className }: Props) {
  if (points === null || points === undefined) return <Skeleton className={className} style={{ width, height }} aria-label={`${label} loading`} />;
  const vals = points.filter((v): v is number => v !== null && Number.isFinite(v));
  if (vals.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const pad = 2;
  const n = points.length;
  const x = (i: number) => pad + (i / Math.max(1, n - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  let d = "";
  let pen = false;
  let last: { x: number; y: number } | null = null;
  points.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) {
      pen = false;
      return;
    }
    const px = x(i);
    const py = y(v);
    d += `${pen ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`;
    pen = true;
    last = { x: px, y: py };
  });
  const end = last as { x: number; y: number } | null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className={className}>
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {end && <circle cx={end.x} cy={end.y} r={2.2} fill={stroke} />}
    </svg>
  );
}
