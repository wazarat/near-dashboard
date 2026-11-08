/**
 * Chain-level security checklist for the three base layers the Atlas tracks.
 * Every line is taken from the "Security" section of the research memo
 * (data/near-traction-funding-security-2026-11-08.md); figures are quoted as
 * written there and nothing is added from other sources. `source` is the
 * attribution the memo itself gives for the line.
 */
export const CHAIN_RISK_STATUSES = ["good", "watch", "serious", "unknown"] as const;
export type ChainRiskStatus = (typeof CHAIN_RISK_STATUSES)[number];

export interface ChainRiskItem {
  id: string;
  label: string;
  status: ChainRiskStatus;
  detail: string;
  source?: string;
}

export interface ChainRiskEntity {
  id: string;
  name: string;
  /** One line on what the entity is, so the card reads without the memo. */
  summary: string;
  items: ChainRiskItem[];
}

/** Status colour and wording. The colour is never used alone: every status ships a glyph and its label. */
export const CHAIN_RISK_STATUS_META: Record<ChainRiskStatus, { label: string; color: string; description: string }> = {
  good: { label: "Good", color: "var(--status-good)", description: "Mitigated, or a positive finding." },
  watch: { label: "Watch", color: "var(--status-warning)", description: "Partial mitigation or an open question." },
  serious: { label: "Serious", color: "var(--status-serious)", description: "Material risk as recorded in the memo." },
  unknown: { label: "Unknown", color: "var(--risk-unknown)", description: "Not documented, or only unverified reports." },
};

export const chainRisk: ChainRiskEntity[] = [
  {
    id: "near-l1",
    name: "NEAR L1",
    summary: "The base chain, its validator set, protocol upgrades, liveness record and governance.",
    items: [
      {
        id: "validators",
        label: "Validator set",
        status: "good",
        detail: "352 validators, Nakamoto coefficient 9.",
        source: "Chainspect",
      },
      {
        id: "protocol",
        label: "Protocol upgrades",
        status: "good",
        detail: "Stateless validation (Nightshade 2.0) since Aug 2024, 600ms blocks since May 2025.",
      },
      {
        id: "liveness-jul-2025",
        label: "Liveness, Jul 3 2025",
        status: "watch",
        detail: "A 30-minute slowdown on Jul 3, 2025 as the validator set passed 256.",
        source: "Official postmortem",
      },
      {
        id: "liveness-aug-2025",
        label: "Liveness, Aug 18 2025",
        status: "unknown",
        detail: "A reported ~3-hour partial halt on Aug 18, 2025. Third-party status page only, unverified.",
        source: "Third-party status page (unverified)",
      },
      {
        id: "bounties",
        label: "Node bugs caught by bounty",
        status: "good",
        detail: "Two node-crash bugs caught through bounties, an oversized receipt (Nov 2024) and Zellic's \"Ping of Death\" ($150K bounty).",
        source: "Bug bounty disclosures",
      },
      {
        id: "inflation",
        label: "Inflation governance",
        status: "watch",
        detail: "Inflation cut from 5% to 2.5% in Oct 2025 by validator upgrade after an August community vote missed its 66.67% threshold. Chorus One refused to upgrade.",
      },
      {
        id: "chain-signatures",
        label: "Chain Signatures MPC",
        status: "watch",
        detail: "Launched Aug 2024 with 8 named operators (target 40+), running in Intel TDX enclaves. Audited by Kudelski with Trail of Bits reports.",
        source: "Kudelski, Trail of Bits",
      },
    ],
  },
  {
    id: "near-intents",
    name: "NEAR Intents",
    summary: "The cross-chain settlement layer that carries most of the ecosystem's volume.",
    items: [
      {
        id: "admin",
        label: "Admin powers",
        status: "serious",
        detail: "The DAO multisig can upgrade, pause and withdraw all funds.",
        source: "Hacken audit, Dec 2024",
      },
      {
        id: "shield",
        label: "Freeze capability",
        status: "watch",
        detail: "Its SHIELD layer froze $503K of Bitget hack proceeds in Sep 2026. Protective for victims, but it is a central power over user funds.",
      },
      {
        id: "bounty",
        label: "Bug bounty",
        status: "good",
        detail: "Bug bounty up to $300K on HackenProof.",
        source: "HackenProof",
      },
    ],
  },
  {
    id: "aurora",
    name: "Aurora",
    summary: "The EVM environment on NEAR. Not a rollup, so rollup-style monitoring does not apply.",
    items: [
      {
        id: "architecture",
        label: "Architecture and monitoring",
        status: "watch",
        detail: "Aurora Engine is a contract on NEAR, not a rollup, and has no L2BEAT page.",
      },
      {
        id: "upgrade-keys",
        label: "Upgrade keys",
        status: "unknown",
        detail: "Upgrade-key holders are not documented.",
      },
      {
        id: "halt-jul-2026",
        label: "Liveness, Jul 20 2026",
        status: "serious",
        detail: "Mainnet stopped producing blocks for several hours on Jul 20, 2026 with no published root cause.",
      },
    ],
  },
];
