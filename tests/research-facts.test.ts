import { describe, expect, it } from "vitest";
import { auditedProjectsCount, fundingDisclosedFor } from "../src/lib/research-facts";

const SEC = "Security, Risk & Compliance";
const ECO = "Ecosystem, Funding & Education";

describe("research facts for unmeasured sectors", () => {
  const all = [
    { id: "a", audits: "BlockSec (2022); HackenProof bounty up to $300000" },
    { id: "b", audits: "Hacken Dec 2024 (5 findings)" },
    { id: "c", audits: "None found" },
    { id: "d", audits: null },
  ];
  it("counts whole-word mentions of the firm, so Hacken does not match HackenProof", () => {
    expect(auditedProjectsCount({ id: "hacken", name: "Hacken", sector: SEC }, all)).toBe(1);
    expect(auditedProjectsCount({ id: "hackenproof", name: "HackenProof", sector: SEC }, all)).toBe(1);
    expect(auditedProjectsCount({ id: "blocksec", name: "BlockSec", sector: SEC }, all)).toBe(1);
    expect(auditedProjectsCount({ id: "nym", name: "Nym", sector: SEC }, all)).toBe(0);
    expect(auditedProjectsCount({ id: "x", name: "BlockSec", sector: "Other" }, all)).toBeNull();
  });
  it("reads an ecosystem organisation's disclosed rounds from the investor aggregate", () => {
    const inv = [{ id: "near-foundation", name: "NEAR Foundation", totalDisclosed: 13_500_000, disclosedDeals: 2 }, { id: "q", name: "Quiet", totalDisclosed: 0, disclosedDeals: 0 }];
    expect(fundingDisclosedFor({ id: "near-foundation", name: "NEAR Foundation", sector: ECO }, inv)).toBe(13_500_000);
    expect(fundingDisclosedFor({ id: "q", name: "Quiet", sector: ECO }, inv)).toBeNull();
    expect(fundingDisclosedFor({ id: "near-foundation", name: "NEAR Foundation", sector: "Other" }, inv)).toBeNull();
  });
});
