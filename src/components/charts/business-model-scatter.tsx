"use client";

import { useMemo } from "react";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { ChartCard, EmptyState, TvlNote } from "@/components/atlas/chart-card";
import { TooltipFrame, TooltipRow, type TipProps } from "@/components/atlas/chart-tooltip";
import { CHAIN_COLOR, CHAIN_SHAPE } from "@/lib/colors";
import type { Scale } from "@/lib/filters";
import { fmtPct, fmtUsd, fmtUsdFull } from "@/lib/format";
import { NATIVE_CHAINS, type NativeChain, type Project } from "@/lib/types";

interface Point {
  /** Plotted coordinates: log10 of the dollar figure on the log scale, raw dollars on the linear scale. */
  x: number;
  y: number;
  /** TVL drives marker area; projects without TVL get the smallest marker. */
  z: number;
  p: Project;
}

const CAPTURE_LINES = [
  { r: 1, label: "100% capture" },
  { r: 0.5, label: "50%" },
  { r: 0.1, label: "10%" },
] as const;

/** Projects below this fee level are too small for capture ratios to mean much. */
const TAKEAWAY_MIN_FEES = 10_000;

const pow10Label = (v: number) => fmtUsd(Math.pow(10, v), { digits: 0 });
const usdLabel = (v: number) => fmtUsd(v, { digits: 0 });

function takeawayFor(plotted: Project[]): string {
  const sized = plotted.filter((p) => (p.fees ?? 0) >= TAKEAWAY_MIN_FEES && p.revenueCapture !== null).sort((a, b) => (a.revenueCapture as number) - (b.revenueCapture as number));
  if (sized.length >= 2) {
    const lo = sized[0];
    const hi = sized[sized.length - 1];
    return `Among the ${sized.length} projects with at least ${fmtUsd(TAKEAWAY_MIN_FEES, { digits: 0 })} in 30d fees, revenue capture runs from ${fmtPct(lo.revenueCapture)} (${lo.name}) to ${fmtPct(hi.revenueCapture)} (${hi.name}).`;
  }
  if (plotted.length > 0) {
    return `${plotted.length} project${plotted.length === 1 ? "" : "s"} report both fees and revenue; too few earn ${fmtUsd(TAKEAWAY_MIN_FEES, { digits: 0 })} or more in fees to compare capture.`;
  }
  return "No project in this selection reports both 30d fees and 30d revenue.";
}

interface Props {
  projects: Project[];
  scale: Scale;
  onScaleChange: (s: Scale) => void;
  onOpen: (id: string) => void;
}

export function BusinessModelScatter({ projects, scale, onScaleChange, onOpen }: Props) {
  const plotted = useMemo(() => projects.filter((p) => p.fees !== null && p.revenue !== null && p.fees > 0 && p.revenue > 0), [projects]);
  const feesOnly = useMemo(() => projects.filter((p) => p.fees !== null && p.fees > 0 && (p.revenue === null || p.revenue === 0)).length, [projects]);

  const { pts, xDomain, yDomain } = useMemo(() => {
    const tf = (v: number) => (scale === "log" ? Math.log10(v) : v);
    const pts: Point[] = plotted.map((p) => ({ x: tf(p.fees as number), y: tf(p.revenue as number), z: p.tvl ?? 0, p }));
    if (pts.length === 0) return { pts, xDomain: [0, 1] as [number, number], yDomain: [0, 1] as [number, number] };
    const xs = pts.map((d) => d.x);
    const ys = pts.map((d) => d.y);
    if (scale === "log") {
      return {
        pts,
        xDomain: [Math.floor(Math.min(...xs)), Math.ceil(Math.max(...xs))] as [number, number],
        yDomain: [Math.floor(Math.min(...ys)), Math.ceil(Math.max(...ys))] as [number, number],
      };
    }
    return { pts, xDomain: [0, Math.max(...xs) * 1.1] as [number, number], yDomain: [0, Math.max(...ys) * 1.1] as [number, number] };
  }, [plotted, scale]);

  const chainsPresent = NATIVE_CHAINS.filter((c) => plotted.some((p) => p.chain === c));
  const logTicks = (d: [number, number]) => Array.from({ length: d[1] - d[0] + 1 }, (_, i) => d[0] + i);

  return (
    <ChartCard
      id="business-model"
      title="Business model, fees against revenue"
      takeaway={takeawayFor(plotted)}
      info="Each mark is a project with both 30-day fees and 30-day revenue on DefiLlama (research snapshot, refreshed daily once history exists). Diagonal lines mark 10%, 50% and 100% revenue capture, i.e. revenue divided by fees. Colour and shape both encode Native Chain; marker area tracks TVL. Axes are log by default because fees span several orders of magnitude."
      scale={scale}
      onScaleChange={onScaleChange}
      footer={<TvlNote />}
      table={{
        columns: [
          { key: "name", label: "Project" },
          { key: "chain", label: "Native chain" },
          { key: "fees", label: "30d fees", align: "right", format: (v) => fmtUsdFull(v as number) },
          { key: "revenue", label: "30d revenue", align: "right", format: (v) => fmtUsdFull(v as number) },
          { key: "capture", label: "Revenue capture", align: "right", format: (v) => fmtPct(v as number | null) },
          { key: "tvl", label: "TVL", align: "right", format: (v) => fmtUsd(v as number | null) },
        ],
        rows: plotted.map((p) => ({ name: p.name, chain: p.chain, fees: p.fees, revenue: p.revenue, capture: p.revenueCapture, tvl: p.tvl })),
        filename: "fees-vs-revenue.csv",
        caption: "Projects with both 30-day fees and 30-day revenue",
      }}
    >
      {pts.length === 0 ? (
        <EmptyState message="No projects with both fees and revenue in this selection." />
      ) : (
        <div>
          <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
            {chainsPresent.map((c) => (
              <li key={c} className="inline-flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <Mark cx={6} cy={6} r={4.5} shape={CHAIN_SHAPE[c]} fill={CHAIN_COLOR[c]} />
                </svg>
                {c}
              </li>
            ))}
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block size-3 rounded-full border border-dashed border-muted-foreground" />
              area = TVL
            </li>
          </ul>
          <div className="h-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 24, bottom: 16, left: 8 }}>
                <CartesianGrid stroke="var(--grid)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={xDomain}
                  ticks={scale === "log" ? logTicks(xDomain) : undefined}
                  tickFormatter={scale === "log" ? pow10Label : usdLabel}
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                  label={{ value: `30d fees${scale === "log" ? " (log)" : ""}`, position: "insideBottom", offset: -8, fontSize: 10, fill: "var(--ink-muted)" }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={yDomain}
                  ticks={scale === "log" ? logTicks(yDomain) : undefined}
                  tickFormatter={scale === "log" ? pow10Label : usdLabel}
                  width={56}
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                  label={{ value: `30d revenue${scale === "log" ? " (log)" : ""}`, angle: -90, position: "insideLeft", offset: 4, fontSize: 10, fill: "var(--ink-muted)" }}
                />
                <ZAxis type="number" dataKey="z" range={[36, 500]} />
                <Tooltip cursor={false} content={<ScatterTip />} />
                {CAPTURE_LINES.map(({ r, label }) => {
                  let seg: [{ x: number; y: number }, { x: number; y: number }] | null = null;
                  if (scale === "log") {
                    const off = Math.log10(r);
                    const x1 = Math.max(xDomain[0], yDomain[0] - off);
                    const x2 = Math.min(xDomain[1], yDomain[1] - off);
                    if (x2 > x1) seg = [{ x: x1, y: x1 + off }, { x: x2, y: x2 + off }];
                  } else {
                    const x2 = Math.min(xDomain[1], yDomain[1] / r);
                    if (x2 > 0) seg = [{ x: 0, y: 0 }, { x: x2, y: r * x2 }];
                  }
                  if (!seg) return null;
                  return <ReferenceLine key={label} segment={seg} stroke="var(--axis)" strokeDasharray={r === 1 ? undefined : "4 4"} ifOverflow="hidden" label={{ value: label, position: "insideTopRight", fontSize: 10, fill: "var(--ink-muted)" }} />;
                })}
                {chainsPresent.map((c) => (
                  <Scatter
                    key={c}
                    name={c}
                    data={pts.filter((d) => d.p.chain === c)}
                    fill={CHAIN_COLOR[c]}
                    shape={renderMark}
                    isAnimationActive={false}
                    onClick={(d) => {
                      const pt = (d as { payload?: Point } | undefined)?.payload;
                      if (pt?.p) onOpen(pt.p.id);
                    }}
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {pts.length} project{pts.length === 1 ? "" : "s"} with both fees and revenue{feesOnly > 0 && `; ${feesOnly} more report fees but no revenue and are not plotted`}. Click a mark to open the project; the table view lists the same rows.
          </p>
        </div>
      )}
    </ChartCard>
  );
}

type Shape = (typeof CHAIN_SHAPE)[NativeChain];

/** One marker, drawn around (cx, cy) with "radius" r; the shape follows the project's native chain. */
function Mark({ cx, cy, r, shape, fill }: { cx: number; cy: number; r: number; shape: Shape; fill: string }) {
  const common = { fill, fillOpacity: 0.85, stroke: "var(--background)", strokeWidth: 1.5 };
  switch (shape) {
    case "square":
      return <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} {...common} />;
    case "diamond": {
      const d = r * 1.25;
      return <polygon points={`${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}`} {...common} />;
    }
    case "triangle":
      return <polygon points={`${cx},${cy - r * 1.2} ${cx + r * 1.15},${cy + r * 0.8} ${cx - r * 1.15},${cy + r * 0.8}`} {...common} />;
    case "cross": {
      const w = r * 0.45;
      const a = r * 1.15;
      return <path d={`M${cx - w},${cy - a} H${cx + w} V${cy - w} H${cx + a} V${cy + w} H${cx + w} V${cy + a} H${cx - w} V${cy + w} H${cx - a} V${cy - w} H${cx - w} Z`} {...common} />;
    }
    case "star": {
      const pts = Array.from({ length: 10 }, (_, k) => {
        const ang = -Math.PI / 2 + (k * Math.PI) / 5;
        const rad = k % 2 === 0 ? r * 1.35 : r * 0.6;
        return `${cx + rad * Math.cos(ang)},${cy + rad * Math.sin(ang)}`;
      });
      return <polygon points={pts.join(" ")} {...common} />;
    }
    default:
      return <circle cx={cx} cy={cy} r={r} {...common} />;
  }
}

interface ShapeProps {
  cx?: number;
  cy?: number;
  size?: number;
  payload?: Point;
  fill?: string;
}

function ChainMark({ cx, cy, size, payload, fill }: ShapeProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  const r = Math.max(4, Math.sqrt((size ?? 64) / Math.PI));
  return <Mark cx={cx} cy={cy} r={r} shape={CHAIN_SHAPE[payload.p.chain]} fill={fill ?? CHAIN_COLOR[payload.p.chain]} />;
}

const renderMark = (props: unknown) => <ChainMark {...(props as ShapeProps)} />;

function ScatterTip({ active, payload }: TipProps<Point>) {
  if (!active || !payload?.length) return null;
  const { p } = payload[0].payload;
  return (
    <TooltipFrame title={p.name}>
      <TooltipRow label={p.sector} color={CHAIN_COLOR[p.chain]} value={p.chain} />
      <TooltipRow label="30d fees" value={fmtUsdFull(p.fees)} />
      <TooltipRow label="30d revenue" value={fmtUsdFull(p.revenue)} />
      <TooltipRow label="Revenue capture" value={fmtPct(p.revenueCapture)} />
      <TooltipRow label="TVL" value={fmtUsd(p.tvl)} />
      <div className="pt-1 text-muted-foreground">Click to open</div>
    </TooltipFrame>
  );
}
