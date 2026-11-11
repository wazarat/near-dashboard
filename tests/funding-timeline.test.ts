import { describe, expect, it } from "vitest";
import { fundingBreakdown, isFundingBucket, projectsInBucket, typesInBucket } from "../src/lib/funding";
import { toProject } from "../src/lib/parse";
import { countByType, splitTimeline } from "../src/lib/timeline";
import type { EcosystemEvent } from "../src/lib/types";

const mk = (name: string, funding: string) =>
  toProject({
    "Project/Company Name": name,
    "Sector/Category": "DEXs & Liquidity",
    "Native Chain": "NEAR native",
    "Native Chain Confidence": "High",
    "Traction Tier": "Not tracked",
    "TVL on NEAR + Aurora (USD)": "",
    "Security Risk Level": "Not researched",
    Description: "d",
    Status: "Mainnet",
    "Discovered Via": "DefiLlama",
    "Funding Type": funding,
    "Chain Presence": "NEAR",
  });

describe("fundingBreakdown", () => {
  const projects = [
    mk("A", "VC-backed"),
    mk("B", "VC-backed; Token-funded"),
    mk("C", "Grant/Program"),
    mk("D", "Not disclosed"),
    mk("E", "Not disclosed"),
    mk("F", "Not researched"),
    mk("G", ""),
    mk("H", "Something rare"),
  ];
  const b = fundingBreakdown(projects);

  it("keeps only disclosed funding in the bars and folds rare types into Other", () => {
    expect(b.rows.map((r) => [r.bucket, r.count])).toEqual([
      ["VC-backed", 2],
      ["Token-funded", 1],
      ["Grant/Program", 1],
      ["Other", 1],
    ]);
    expect(b.rows.map((r) => r.bucket)).not.toContain("Not disclosed");
    expect(b.rows.map((r) => r.bucket)).not.toContain("Not researched");
    expect(b.rows[0].share).toBeCloseTo(2 / 4);
  });

  it("writes the coverage sentence and its parts add up to the selection", () => {
    expect(b).toMatchObject({ total: 8, researched: 6, disclosed: 4, notDisclosed: 2, notResearched: 2 });
    expect(b.disclosed + b.notDisclosed + b.notResearched).toBe(b.total);
    expect(b.sentence).toBe("6 researched, 4 with disclosed funding, 2 not disclosed, 2 not researched");
    expect(fundingBreakdown([]).sentence).toBe("0 researched, 0 with disclosed funding, 0 not disclosed, 0 not researched");
  });
});

describe("funding type pop-up", () => {
  const projects = [mk("A", "VC-backed"), mk("B", "VC-backed; Token-funded"), mk("C", "Grant/Program"), mk("D", "Not disclosed"), mk("F", "Not researched"), mk("H", "Something rare"), mk("I", "Another rare one")];

  it("lists exactly the projects each bar counts, a project with two types under both", () => {
    for (const row of fundingBreakdown(projects).rows) expect(projectsInBucket(projects, row.bucket)).toHaveLength(row.count);
    expect(projectsInBucket(projects, "VC-backed").map((p) => p.name)).toEqual(["A", "B"]);
    expect(projectsInBucket(projects, "Token-funded").map((p) => p.name)).toEqual(["B"]);
    expect(projectsInBucket(projects, "Other").map((p) => p.name)).toEqual(["H", "I"]);
  });

  it("filters to the raw types inside a bucket, so Other can be filtered too", () => {
    expect(typesInBucket(projects, "VC-backed")).toEqual(["VC-backed"]);
    expect(typesInBucket(projects, "Other")).toEqual(["Another rare one", "Something rare"]);
  });

  it("opens only for a bar's name", () => {
    expect(isFundingBucket("VC-backed")).toBe(true);
    expect(isFundingBucket("Not disclosed")).toBe(false);
    expect(isFundingBucket("anything else")).toBe(false);
    expect(isFundingBucket(null)).toBe(false);
  });
});

describe("timeline split", () => {
  const ev = (date: string, type: EcosystemEvent["type"]): EcosystemEvent =>
    ({ id: date + type, date, monthOnly: false, type, title: "t", projects: [], projectIds: [], amount: null, amountNote: null, detail: null, sourceUrl: null }) as unknown as EcosystemEvent;
  const events = [ev("2021-06-01", "Funding"), ev("2023-12-31", "Incident"), ev("2024-01-01", "Milestone"), ev("2025-03-02", "Funding")];

  it("collapses events before the default start and keeps the rest in order", () => {
    const { shown, earlier } = splitTimeline(events, "2024-01-01");
    expect(earlier.map((e) => e.date)).toEqual(["2021-06-01", "2023-12-31"]);
    expect(shown.map((e) => e.date)).toEqual(["2024-01-01", "2025-03-02"]);
    expect(splitTimeline(events, "2020-01-01").earlier).toEqual([]);
  });

  it("counts by type in lane order", () => {
    expect(countByType(events, ["Incident", "Funding"])).toEqual([
      { type: "Incident", count: 1 },
      { type: "Funding", count: 2 },
    ]);
  });
});
