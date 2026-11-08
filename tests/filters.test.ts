import { describe, expect, it } from "vitest";
import { applyFilters } from "../src/lib/filters";
import { generateInsights } from "../src/lib/insights";
import { concentration, nativeShare, topNShare } from "../src/lib/metrics";
import { toProject } from "../src/lib/parse";

const mk = (name: string, chain: string, tvl: string, fees = "", rev = "", via = "DefiLlama", presence = "NEAR") =>
  toProject({ "Project/Company Name": name, "Sector/Category": "DEXs & Liquidity", "Native Chain": chain, "Native Chain Confidence": "High", "Traction Tier": "Tier 3 - Emerging", "TVL on NEAR + Aurora (USD)": tvl, "30d Fees (USD)": fees, "30d Revenue (USD)": rev, "Security Risk Level": "Not researched", Description: "d", Status: "Mainnet", "Discovered Via": via, "Funding Type": "Not researched", "Chain Presence": presence });

const projects = [mk("A", "NEAR native", "90", "100", "50", "NEAR Catalog; DefiLlama"), mk("B", "Aurora native", "10", "", "", "Aurora ecosystem page", "Aurora"), mk("C", "Other EVM", "", "", "", "AwesomeNEAR", "")];

describe("applyFilters", () => {
  it("filters by multi-valued facets and search", () => {
    expect(applyFilters(projects, { via: ["DefiLlama"] }).map((p) => p.name)).toEqual(["A"]);
    expect(applyFilters(projects, { presence: ["Unknown"] }).map((p) => p.name)).toEqual(["C"]);
    expect(applyFilters(projects, { chain: ["Aurora native", "Other EVM"] })).toHaveLength(2);
    expect(applyFilters(projects, { q: "b" }).map((p) => p.name)).toEqual(["B"]);
    expect(applyFilters(projects, { status: ["Mainnet"] })).toHaveLength(3);
  });
});

describe("metrics and insights", () => {
  it("concentration and native share", () => {
    const c = concentration(projects, "tvl");
    expect(c.map((p) => p.name)).toEqual(["A", "B"]);
    expect(topNShare(c, 1)).toBeCloseTo(0.9);
    expect(nativeShare(projects, "tvl")).toBeCloseTo(0.9);
    expect(nativeShare(projects, "revenue")).toBe(1);
  });
  it("insights are computed and never empty", () => {
    const out = generateInsights(projects, "tvl");
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out.find((i) => i.id === "native")?.text).toContain("NEAR-native projects are 33%");
    expect(generateInsights([], "count")[0].id).toBe("empty");
  });
});
