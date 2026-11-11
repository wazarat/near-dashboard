"use client";

import { useLayoutEffect, useMemo, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";

/**
 * Category labels for horizontal bar charts, one line each (standard section 6). Recharts wraps a label
 * that is wider than the axis onto two lines; here each label stays on one line, right-aligned and centred on
 * its bar. The axis is as wide as the longest label needs, but never more than `maxShare` of the chart, so on a
 * phone a long name is shortened with an ellipsis instead of spilling over (the tooltip keeps the full name).
 */
export function useOneLineAxis(labels: readonly string[], { fontSize = 11, maxShare = 0.42, min = 56 }: { fontSize?: number; maxShare?: number; min?: number } = {}) {
  // `attach` is a callback ref for the chart's wrapper (a state setter, so nothing reads a ref during render).
  const [el, attach] = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState(0);
  const [font, setFont] = useState<string | null>(null);

  // The observer reports once on start and again on every resize; the page font is read with the first report.
  useLayoutEffect(() => {
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setFont(`${fontSize}px ${getComputedStyle(el).fontFamily}`);
      setBox(el.clientWidth);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, fontSize]);

  const measureText = useMemo(() => textMeasurer(font, fontSize), [font, fontSize]);
  const longest = useMemo(() => Math.max(0, ...labels.map((l) => measureText(l))), [labels, measureText]);
  const cap = box ? box * maxShare : Infinity;
  // Rounded up, so the longest label always fits (rounding to the nearest pixel cut it by an ellipsis).
  const width = Math.floor(Math.max(min, Math.min(Math.ceil(longest) + GAP, cap)));
  const room = width - GAP;

  const tick = (props: { x?: number | string; y?: number | string; payload?: { value?: unknown } }) => {
    const full = String(props.payload?.value ?? "");
    const text = fitText(full, room, measureText);
    return (
      <text x={Number(props.x)} y={Number(props.y)} textAnchor="end" dominantBaseline="central" className="recharts-text" style={{ fontSize }}>
        {text !== full && <title>{full}</title>}
        {text}
      </text>
    );
  };
  return { attach, width, tick };
}

type AxisTick = (props: { x?: number | string; y?: number | string; payload?: { value?: unknown } }) => ReactElement;

/**
 * The chart's wrapper with its own measurement, so a chart drawn twice (on the card and in the expanded view)
 * sizes each axis to its own width. The child receives the axis width and the tick to hand to recharts' YAxis.
 */
export function OneLineAxis({ labels, className, style, children, ...opts }: { labels: readonly string[]; className?: string; style?: CSSProperties; fontSize?: number; maxShare?: number; min?: number; children: (axis: { width: number; tick: AxisTick }) => ReactNode }) {
  const { attach, width, tick } = useOneLineAxis(labels, opts);
  return (
    <div ref={attach} className={className} style={style}>
      {children({ width, tick })}
    </div>
  );
}

/** Space between a label and its bar. */
const GAP = 8;

/** Text width in pixels: the canvas with the page font once it is known, a close estimate before (and in tests). */
function textMeasurer(font: string | null, fontSize: number): (s: string) => number {
  if (font && typeof document !== "undefined") {
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.font = font;
      return (s) => ctx.measureText(s).width;
    }
  }
  return (s) => s.length * fontSize * 0.56;
}

/** The label itself when it fits, else as much as fits followed by an ellipsis. Pure. */
export function fitText(s: string, room: number, measure: (s: string) => number): string {
  if (measure(s) <= room) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(`${s.slice(0, mid).trimEnd()}…`) <= room) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? `${s.slice(0, lo).trimEnd()}…` : "…";
}
