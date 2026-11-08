import { CHAIN_COLOR, CHAIN_SHORT, RISK_COLOR, STATUS_COLOR, TIER_COLOR, TIER_SHORT } from "@/lib/colors";
import type { NativeChain, RiskLevel, StatusGroup, Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

function Dot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ backgroundColor: color }} />;
}

export function ChainChip({ chain, className, short = true }: { chain: NativeChain; className?: string; short?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs text-foreground", className)}>
      <Dot color={CHAIN_COLOR[chain]} />
      {short ? CHAIN_SHORT[chain] : chain}
    </span>
  );
}

export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  const quiet = tier === "Not tracked" || tier === "Tracked, negligible";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs", quiet ? "text-muted-foreground" : "text-foreground", className)}
      title={tier === "Tracked, negligible" ? "Listed on DefiLlama but every figure is zero" : undefined}
    >
      <Dot color={TIER_COLOR[tier]} className={cn(tier === "Not tracked" && "rounded-sm")} />
      {TIER_SHORT[tier]}
    </span>
  );
}

const RISK_ICON: Record<RiskLevel, string> = { High: "▲", Medium: "◆", Low: "●", Unknown: "?", "Not researched": "–" };

export function RiskBadge({ risk, className }: { risk: RiskLevel; className?: string }) {
  const quiet = risk === "Unknown" || risk === "Not researched";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs", quiet ? "text-muted-foreground" : "text-foreground", risk === "Not researched" && "border-dashed", className)}
      title={risk === "Not researched" ? "Security was never checked for this project" : risk === "Unknown" ? "Checked; no audit or incident information found" : undefined}
    >
      <span aria-hidden="true" className="text-[10px] leading-none" style={{ color: RISK_COLOR[risk] }}>
        {RISK_ICON[risk]}
      </span>
      {risk}
    </span>
  );
}

export function StatusBadge({ group, status, className }: { group: StatusGroup; status?: string; className?: string }) {
  const quiet = group === "Unknown" || group === "Legacy listing";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs", quiet ? "text-muted-foreground" : "text-foreground", className)} title={status}>
      <Dot color={STATUS_COLOR[group]} />
      {group}
    </span>
  );
}

export function Swatch({ color, shape = "circle" }: { color: string; shape?: "circle" | "square" | "dash" }) {
  return (
    <span aria-hidden="true" className={cn("inline-block shrink-0", shape === "circle" && "size-2.5 rounded-full", shape === "square" && "size-2.5 rounded-[2px]", shape === "dash" && "h-0.5 w-3")} style={{ backgroundColor: color }} />
  );
}
