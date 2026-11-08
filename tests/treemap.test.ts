import { describe, expect, it } from "vitest";
import { toProject } from "../src/lib/parse";
import { fitLabel, labelColor, seqHex, subcategoryCount, treemapLevel, type SeqPalette } from "../src/lib/treemap";

const palette: SeqPalette = { seq: ["#dbe7ff", "#b3ccff", "#7fa9ff", "#3d7bff", "#2563eb", "#1e40af"], none: "#6b7164", textDark: "#0c1500", textLight: "#eef0f7" };

const mk = (name: string, sector: string, sub: string | null, chain: string, tvl: string) =>
  toProject({
    "Project/Company Name": name,
    "Sector/Category": sector,
    Subcategory: sub ?? "",
    "Native Chain": chain,
    "Native Chain Confidence": "High",
    "Traction Tier": tvl ? "Tier 3 - Emerging" : "Not tracked",
    "TVL on NEAR + Aurora (USD)": tvl,
    "Security Risk Level": "Not researched",
    Description: "d",
    Status: "Mainnet",
    "Discovered Via": "DefiLlama",
    "Funding Type": "Not researched",
    "Chain Presence": "NEAR",
  });

// Lending has three subcategories (one project with none), DEXs has one.
const projects = [
  mk("L1", "Lending", "Money market", "NEAR native", "100"),
  mk("L2", "Lending", "Money market", "Aurora native", "50"),
  mk("L3", "Lending", "CDP", "NEAR native", "30"),
  mk("L4", "Lending", "Credit", "NEAR native", ""),
  mk("L5", "Lending", null, "NEAR native", "20"),
  mk("D1", "DEXs", "AMM", "NEAR native", "500"),
  mk("D2", "DEXs", "AMM", "Other EVM", ""),
  mk("D3", "DEXs", null, "NEAR native", ""),
];

describe("treemapLevel", () => {
  it("lists sectors sized by the metric and coloured by native share at the top level", () => {
    const level = treemapLevel(projects, "tvl", null, palette);
    expect(level.mode).toBe("sectors");
    expect(level.breadcrumb).toEqual(["All sectors"]);
    expect(level.tiles.map((t) => [t.name, t.size, t.count, t.withData])).toEqual([
      ["DEXs", 500, 3, 1],
      ["Lending", 200, 5, 4],
    ]);
    const lending = level.tiles[1];
    expect(lending.nativeShare).toBeCloseTo(0.8);
    expect(lending.fill).toBe(seqHex(0.8, palette));
    expect(level.total).toBe(700);
  });

  it("groups a sector with three or more subcategories, Unclassified included", () => {
    expect(subcategoryCount(projects.filter((p) => p.sector === "Lending"))).toBe(3);
    const level = treemapLevel(projects, "tvl", "Lending", palette);
    expect(level.mode).toBe("subcategories");
    expect(level.breadcrumb).toEqual(["All sectors", "Lending"]);
    expect(level.tiles.map((t) => [t.name, t.size])).toEqual([
      ["Money market", 150],
      ["CDP", 30],
      ["Unclassified", 20],
    ]);
    // Credit has no TVL, so it carries no tile at the TVL metric but does by count.
    const byCount = treemapLevel(projects, "count", "Lending", palette);
    expect(byCount.tiles.map((t) => t.name)).toContain("Credit");
  });

  it("shows project tiles plus one Not tracked tile when a sector has fewer than three subcategories", () => {
    const level = treemapLevel(projects, "tvl", "DEXs", palette);
    expect(level.mode).toBe("projects");
    expect(level.tiles.map((t) => t.kind)).toEqual(["project", "untracked"]);
    expect(level.tiles[0]).toMatchObject({ name: "D1", projectId: "d1", size: 500 });
    expect(level.tiles[1]).toMatchObject({ name: "Not tracked", count: 2, withData: 0, fill: palette.none });
    expect(level.tiles[1].size).toBeCloseTo(15);
    const byCount = treemapLevel(projects, "count", "DEXs", palette);
    expect(byCount.tiles.map((t) => t.kind)).toEqual(["project", "project", "project"]);
  });

  it("returns an empty level for a sector with no data", () => {
    expect(treemapLevel([], "tvl", null, palette).tiles).toEqual([]);
    expect(treemapLevel(projects, "fees", "DEXs", palette).tiles.map((t) => t.kind)).toEqual(["untracked"]);
  });
});

describe("treemap labels", () => {
  it("picks dark text on light tiles and light text on dark tiles", () => {
    expect(labelColor("#dbe7ff")).toBe("dark");
    expect(labelColor("#b3ccff")).toBe("dark");
    expect(labelColor("#3d7bff")).toBe("light");
    expect(labelColor("#1e40af")).toBe("light");
    expect(labelColor("#eef0f7")).toBe("dark");
    expect(labelColor("#0a0c14")).toBe("light");
  });

  it("hides labels on tiles that cannot fit them, wraps to two lines and ellipsises the rest", () => {
    expect(fitLabel("Lending", 40, 28)).toBeNull();
    expect(fitLabel("Lending", 80, 18)).toBeNull();
    expect(fitLabel("Lending", 80, 40)).toEqual(["Lending"]);
    // 90 px wide fits 12 characters per line at the 11 px label size.
    expect(fitLabel("Exchanges and on-ramps", 90, 40)).toEqual(["Exchanges", "and on-ramps"]);
    const clipped = fitLabel("Infrastructure and developer tooling for everyone", 90, 40) as string[];
    expect(clipped).toEqual(["Infrastruct…", "and…"]);
    expect(clipped.every((l) => l.length <= 12)).toBe(true);
    expect(fitLabel("Infrastructure and developer tooling", 90, 24)).toEqual(["Infrastruct…"]);
    expect(fitLabel("Lending and Credit", 200, 40)).toEqual(["Lending and Credit"]);
  });
});
