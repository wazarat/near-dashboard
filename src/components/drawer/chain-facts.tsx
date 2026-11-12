"use client";

import { InfoTip } from "@/components/ui/info-tip";
import { meta } from "@/lib/data";
import { fmtDate, fmtInt, fmtUsd } from "@/lib/format";
import type { Project } from "@/lib/types";

/** Which projects are the chains themselves (docs/LIVE-DATA.md, unmeasured sectors: chain stats appear on these two cards only). */
export const CHAIN_PROJECTS: Record<string, "near" | "aurora"> = { "near-protocol": "near", aurora: "aurora" };

function Row({ label, info, value }: { label: string; info: string; value: string | null }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 text-sm" data-testid="chain-fact">
      <dt className="inline-flex items-start gap-1 text-ink-300">
        <span>{label}</span>
        <InfoTip label={`About ${label}`}>{info}</InfoTip>
      </dt>
      <dd className="tabular min-w-0">{value ?? <span className="text-label text-ink-300">Not tracked</span>}</dd>
    </div>
  );
}

/**
 * Chain-level facts on the NEAR Protocol and Aurora pop-ups: 30-day gas fees, transactions and DEX volume from
 * the chain series, plus the explorers' lifetime counts. A day a source reports as 0 where that cannot be true
 * is left out of the sums (src/lib/chain-gaps.ts), so a missed day never reads as a flat $0.
 */
export function ChainFacts({ p }: { p: Project }) {
  const which = CHAIN_PROJECTS[p.id];
  const f = meta.chainFacts;
  if (!which || !f) return null;
  const c = f[which];
  const usd = (v: number | null) => (v === null ? null : fmtUsd(v));
  const int = (v: number | null) => (v === null ? null : fmtInt(v));
  const window = f.windowEnd ? ` over the 30 days to ${fmtDate(f.windowEnd)}` : "";
  const stats = f.statsAsOf ? `, read ${fmtDate(f.statsAsOf)}` : "";
  return (
    <>
      <Row label="30d gas fees" info={`The chain's own gas fees${window}, from DefiLlama's chain fee summary. Days reported as 0 are gaps and left out.`} value={usd(c.gasFees30d)} />
      <Row label="30d transactions" info={`Daily transactions${window}, from ${which === "near" ? "NearBlocks" : "Aurora Blockscout"}.`} value={int(c.txns30d)} />
      <Row label="30d DEX volume" info={`DEX volume on the chain${window}, summed across every DEX DefiLlama lists${which === "near" ? ", NEAR Intents included" : ""}.`} value={usd(c.volume30d)} />
      {which === "near" && "nodesOnline" in c && <Row label="Nodes online" info={`Validator and RPC nodes NearBlocks sees online${stats}.`} value={int(c.nodesOnline)} />}
      <Row label="Lifetime transactions" info={`Every transaction since the chain started, per ${which === "near" ? "NearBlocks" : "Aurora Blockscout"}${stats}.`} value={int(c.totalTxns)} />
      {which === "aurora" && "totalAddresses" in c && <Row label="Lifetime addresses" info={`Addresses that ever transacted on Aurora, per Aurora Blockscout${stats}.`} value={int(c.totalAddresses)} />}
    </>
  );
}
