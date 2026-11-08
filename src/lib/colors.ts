import type { EventType, NativeChain, RiskLevel, StatusGroup, Tier } from "./types";

/**
 * Every colour is a CSS variable defined in globals.css for light and dark,
 * so charts re-theme without re-rendering.
 */
export const CHAIN_COLOR: Record<NativeChain, string> = {
  "NEAR native": "var(--chain-near)",
  "Aurora native": "var(--chain-aurora)",
  "Other EVM": "var(--chain-other-evm)",
  "Other non-EVM": "var(--chain-other-nonevm)",
  "Centralized / off-chain": "var(--chain-cex)",
  "Octopus appchain": "var(--chain-octopus)",
};

export const CHAIN_SHAPE: Record<NativeChain, "circle" | "square" | "triangle" | "diamond" | "cross" | "star"> = {
  "NEAR native": "circle",
  "Aurora native": "diamond",
  "Other EVM": "square",
  "Other non-EVM": "triangle",
  "Centralized / off-chain": "cross",
  "Octopus appchain": "star",
};

export const CHAIN_SHORT: Record<NativeChain, string> = {
  "NEAR native": "NEAR native",
  "Aurora native": "Aurora native",
  "Other EVM": "Other EVM",
  "Other non-EVM": "Non-EVM",
  "Centralized / off-chain": "Centralized",
  "Octopus appchain": "Octopus",
};

export const TIER_COLOR: Record<Tier, string> = {
  "Tier 1 - Leader": "var(--tier-1)",
  "Tier 2 - Strong": "var(--tier-2)",
  "Tier 3 - Emerging": "var(--tier-3)",
  "Tracked, negligible": "var(--tier-negligible)",
  "Not tracked": "var(--tier-none)",
};

export const TIER_SHORT: Record<Tier, string> = {
  "Tier 1 - Leader": "Tier 1",
  "Tier 2 - Strong": "Tier 2",
  "Tier 3 - Emerging": "Tier 3",
  "Tracked, negligible": "Negligible",
  "Not tracked": "Not tracked",
};

export const RISK_COLOR: Record<RiskLevel, string> = {
  High: "var(--risk-high)",
  Medium: "var(--risk-medium)",
  Low: "var(--risk-low)",
  Unknown: "var(--risk-unknown)",
  "Not researched": "var(--risk-notresearched)",
};

export const STATUS_COLOR: Record<StatusGroup, string> = {
  Mainnet: "var(--status-good)",
  Testnet: "var(--cat-2)",
  Building: "var(--cat-3)",
  Inactive: "var(--status-warning)",
  "Legacy listing": "var(--cat-notresearched)",
  Defunct: "var(--status-critical)",
  Unknown: "var(--cat-notdisclosed)",
};

export const EVENT_COLOR: Record<EventType, string> = {
  Incident: "var(--event-incident)",
  Milestone: "var(--event-milestone)",
  Integration: "var(--event-integration)",
  Program: "var(--event-program)",
  Funding: "var(--event-funding)",
  Grant: "var(--event-grant)",
  Listing: "var(--event-listing)",
  Governance: "var(--event-governance)",
  Acquisition: "var(--event-acquisition)",
};

/** Lane order for the timeline. */
export const EVENT_ORDER: EventType[] = ["Incident", "Milestone", "Integration", "Listing", "Governance", "Program", "Grant", "Funding", "Acquisition"];

/** Fixed categorical order for funding types. Rare types fold into "Other". */
export const FUNDING_ORDER = ["VC-backed", "Token-funded", "Token/DAO treasury", "Grant/Program", "Corporate/parent", "Public company/subsidiary", "Acquired", "Other"] as const;

export function fundingColor(type: string): string {
  if (type === "Not researched") return "var(--cat-notresearched)";
  if (type === "Not disclosed") return "var(--cat-notdisclosed)";
  const i = (FUNDING_ORDER as readonly string[]).indexOf(type);
  return `var(--cat-${i === -1 ? 8 : i + 1})`;
}

export function fundingBucket(type: string): string {
  if (type === "Not researched" || type === "Not disclosed") return type;
  return (FUNDING_ORDER as readonly string[]).includes(type) ? type : "Other";
}

export const CAT = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)", "var(--cat-7)", "var(--cat-8)"];

export const SEQ = ["var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)", "var(--seq-5)", "var(--seq-6)"];

export function seqColor(t: number | null): string {
  if (t === null || !Number.isFinite(t)) return "var(--tier-none)";
  const i = Math.min(SEQ.length - 1, Math.max(0, Math.floor(t * SEQ.length)));
  return SEQ[i];
}

export const CHART = {
  grid: "var(--grid)",
  axis: "var(--axis)",
  muted: "var(--ink-muted)",
  secondary: "var(--ink-secondary)",
  surface: "var(--surface-chart)",
  background: "var(--background)",
  foreground: "var(--foreground)",
  price: "var(--series-price)",
  intents: "var(--series-intents)",
  usage: "var(--series-usage)",
};
