import { PlainState } from "@/components/ui/plain-state";
import { CHAIN_SHORT, TIER_SHORT, statusGroupLabel } from "@/lib/colors";
import type { NativeChain, StatusGroup, Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Tier, native-chain and status labels are plain text (CanHav Atlas UI
 * standard, section 1). The component names stay so call sites read the same;
 * only chart legends keep a colour swatch. There is no risk label anywhere.
 */

export function ChainChip({ chain, className, short = true }: { chain: NativeChain; className?: string; short?: boolean }) {
  return (
    <PlainState tone="strong" className={className} title={short ? chain : undefined}>
      {short ? CHAIN_SHORT[chain] : chain}
    </PlainState>
  );
}

export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  const quiet = tier === "Not tracked" || tier === "Tracked, negligible";
  return (
    <PlainState tone={quiet ? "neutral" : "strong"} className={className} title={tier === "Tracked, negligible" ? "Listed on DefiLlama but every figure is zero" : tier}>
      {TIER_SHORT[tier]}
    </PlainState>
  );
}

export function StatusBadge({ group, status, className }: { group: StatusGroup; status?: string; className?: string }) {
  const quiet = group === "Unknown" || group === "Legacy listing";
  return (
    <PlainState tone={quiet ? "neutral" : "strong"} className={className} title={status}>
      {statusGroupLabel(group)}
    </PlainState>
  );
}

export function Swatch({ color, shape = "circle" }: { color: string; shape?: "circle" | "square" | "dash" }) {
  return (
    <span aria-hidden="true" className={cn("inline-block shrink-0", shape === "circle" && "size-2.5 rounded-full", shape === "square" && "size-2.5 rounded-[2px]", shape === "dash" && "h-0.5 w-3")} style={{ backgroundColor: color }} />
  );
}
