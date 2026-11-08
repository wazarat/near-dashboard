"use client";

import { createContext, useContext, useId, type ReactNode } from "react";
import { sanitizeId } from "@/lib/chart-frame";

/**
 * What a chart knows about the card around it (standard section 6). The
 * ChartCard provides it for the inline chart and again, with `expanded`
 * and `brush` on, for the same chart rendered inside the expand dialog.
 */
export interface ChartFrame {
  expanded: boolean;
  /** Time-series charts render a Brush when true. */
  brush: boolean;
  /** Level charts start the y axis at zero instead of fitting it. */
  startAtZero: boolean;
  /** Index window chosen on a shared RangeBrush, for multi-panel cards. */
  brushRange: [number, number] | null;
  setBrushRange: (r: [number, number] | null) => void;
}

const DEFAULT_FRAME: ChartFrame = { expanded: false, brush: false, startAtZero: false, brushRange: null, setBrushRange: () => {} };

export const ChartFrameContext = createContext<ChartFrame>(DEFAULT_FRAME);

export function ChartFrameProvider({ value, children }: { value: ChartFrame; children: ReactNode }) {
  return <ChartFrameContext.Provider value={value}>{children}</ChartFrameContext.Provider>;
}

/** The pixel height a chart should use: its base height inline, larger in the dialog. */
export function frameHeight(frame: ChartFrame, baseHeight: number, expandedHeight = Math.round(baseHeight * 1.9)): number {
  return frame.expanded ? expandedHeight : baseHeight;
}

/**
 * The frame plus the height, for components rendered inside a ChartCard.
 * A chart that renders its own ChartCard sits above the provider, so it
 * takes the frame from the card's render-function children instead.
 */
export function useChartFrame(baseHeight: number, expandedHeight = Math.round(baseHeight * 1.9)): ChartFrame & { height: number } {
  const frame = useContext(ChartFrameContext);
  return { ...frame, height: frameHeight(frame, baseHeight, expandedHeight) };
}

/** A DOM-safe id for an SVG pattern, unique per render so a chart shown twice never shares one. */
export function useSvgId(base: string): string {
  const id = useId();
  return `${base}-${sanitizeId(id)}`;
}
