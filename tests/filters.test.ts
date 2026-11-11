import { describe, expect, it } from "vitest";
import { CARRIED_PARAMS, FACETS, RANGE_KEYS, activeFilterCount, applyFilters, cardRange, cardRangeWrite, filterParsers } from "../src/lib/filters";
import { generateInsights } from "../src/lib/insights";
import { concentration, nativeShare, topNShare } from "../src/lib/metrics";
import { toProject } from "../src/lib/parse";

const mk = (name: string, chain: string, tvl: string, fees = "", rev = "", via = "DefiLlama", presence = "NEAR") =>
  toProject({ "Project/Company Name": name, "Sector/Category": "DEXs & Liquidity", "Native Chain": chain, "Native Chain Confidence": "High", "Traction Tier": "Tier 3 - Emerging", "TVL on NEAR + Aurora (USD)": tvl, "30d Fees (USD)": fees, "30d Revenue (USD)": rev, "Security Risk Level": "Not researched", Description: "d", Status: "Mainnet", "Discovered Via": via, "Funding Type": "Not researched", "Chain Presence": presence });

const projects = [mk("A", "NEAR native", "90", "100", "50", "NEAR Catalog; DefiLlama"), mk("B", "Aurora native", "10", "", "", "Aurora ecosystem page", "Aurora"), mk("C", "Other EVM", "", "", "", "AwesomeNEAR", "")];
const legacy = toProject({ ...{ "Project/Company Name": "L", "Sector/Category": "DEXs & Liquidity", "Native Chain": "NEAR native", "Native Chain Confidence": "Low", "Traction Tier": "Not tracked", "TVL on NEAR + Aurora (USD)": "", "Security Risk Level": "Not researched", Description: "d", Status: "Unknown (legacy 2021-23 listing)", "Discovered Via": "AwesomeNEAR", "Funding Type": "Not researched", "Chain Presence": "NEAR" } });

describe("applyFilters", () => {
  it("filters by multi-valued facets and search", () => {
    expect(applyFilters(projects, { via: ["DefiLlama"] }).map((p) => p.name)).toEqual(["A"]);
    expect(applyFilters(projects, { presence: ["Unknown"] }).map((p) => p.name)).toEqual(["C"]);
    expect(applyFilters(projects, { chain: ["Aurora native", "Other EVM"] })).toHaveLength(2);
    expect(applyFilters(projects, { q: "b" }).map((p) => p.name)).toEqual(["B"]);
    expect(applyFilters(projects, { status: ["Mainnet"] })).toHaveLength(3);
  });

  it("shows legacy listings by default and hides exactly them with legacy=hide", () => {
    const all = [...projects, legacy];
    expect(legacy.statusGroup).toBe("Legacy listing");
    expect(applyFilters(all, {})).toHaveLength(4);
    expect(applyFilters(all, { legacy: "show" })).toHaveLength(4);
    expect(applyFilters(all, { legacy: "hide" }).map((p) => p.name)).toEqual(["A", "B", "C"]);
    expect(applyFilters(all, { legacy: "hide", status: ["Legacy listing"] })).toHaveLength(0);
  });

  it("counts the legacy switch as an active filter and carries it between pages", () => {
    const base = { q: "", sector: [], chain: [], presence: [], tier: [], status: [], funding: [], via: [], legacy: "show" as const };
    expect(activeFilterCount(base)).toBe(0);
    expect(activeFilterCount({ ...base, legacy: "hide" })).toBe(1);
    expect(activeFilterCount({ ...base, q: "x", sector: ["a", "b"] })).toBe(3);
    expect(CARRIED_PARAMS).toContain("legacy");
    expect(CARRIED_PARAMS).not.toContain("metric");
  });

  it("has no global metric and no security risk facet; each chart owns a metric key", () => {
    const keys = Object.keys(filterParsers);
    expect(keys).not.toContain("metric");
    expect(keys).not.toContain("risk");
    expect(FACETS.map((f) => f.key)).not.toContain("risk");
    for (const k of ["tm", "cc", "mv", "ins", "sb", "sg", "lb", "cm", "sm"]) expect(keys).toContain(k);
    expect(filterParsers.tm.defaultValue).toBe("count");
    expect(filterParsers.cc.defaultValue).toBe("tvl");
    expect(filterParsers.cm.defaultValue).toBe("tvl");
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

describe("per-card time range", () => {
  const none = { range: "30d" as const, cr: null, ar: null, mr: null, lr: null, hr: null, xr: null, ir: null, rr: null };

  it("gives every card its own key, none of them carried from page to page", () => {
    expect(RANGE_KEYS).toEqual(["cr", "ar", "mr", "lr", "hr", "xr", "ir", "rr"]);
    for (const k of RANGE_KEYS) {
      expect(filterParsers).toHaveProperty(k);
      expect(CARRIED_PARAMS as readonly string[]).not.toContain(k);
    }
  });

  it("opens every card at 30d", () => {
    for (const k of RANGE_KEYS) expect(cardRange(none, k)).toBe("30d");
  });

  it("drives only the card whose key is set", () => {
    const state = { ...none, cr: "7d" as const };
    expect(cardRange(state, "cr")).toBe("7d");
    for (const k of RANGE_KEYS.filter((k) => k !== "cr")) expect(cardRange(state, k)).toBe("30d");
  });

  it("falls back to the old global key, so a link shared before the change opens as it did", () => {
    const old = { ...none, range: "90d" as const };
    for (const k of RANGE_KEYS) expect(cardRange(old, k)).toBe("90d");
    expect(cardRange({ ...old, mr: "all" }, "mr")).toBe("all");
    expect(cardRange({ ...old, mr: "all" }, "cr")).toBe("90d");
  });

  it("writes the card's key, and clears it when the pick is what the card shows without one", () => {
    expect(cardRangeWrite(none, "ar", "90d")).toEqual({ ar: "90d" });
    expect(cardRangeWrite(none, "ar", "30d")).toEqual({ ar: null });
    expect(cardRangeWrite({ range: "90d" }, "ar", "30d")).toEqual({ ar: "30d" });
    expect(cardRangeWrite({ range: "90d" }, "ar", "90d")).toEqual({ ar: null });
  });
});
