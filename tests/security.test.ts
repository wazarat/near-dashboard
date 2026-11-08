import { describe, expect, it } from "vitest";
import { toProject } from "../src/lib/parse";
import { securityAggregates, securityFacts } from "../src/lib/security";

const mk = (name: string, sector: string, risk: string, audits: string, incidents: string, redFlags: string, status = "Mainnet") =>
  toProject({
    "Project/Company Name": name,
    "Sector/Category": sector,
    "Native Chain": "NEAR native",
    "Native Chain Confidence": "High",
    "Traction Tier": "Not tracked",
    "TVL on NEAR + Aurora (USD)": "",
    "Security Risk Level": risk,
    Audits: audits,
    Incidents: incidents,
    "Red Flags": redFlags,
    Description: "d",
    Status: status,
    "Discovered Via": "DefiLlama",
    "Funding Type": "Not researched",
    "Chain Presence": "NEAR",
  });

const projects = [
  mk("A", "Lending", "High", "", "2024 exploit", "owner key", "Mainnet"),
  mk("B", "Lending", "Low", "Audited by X", "", ""),
  mk("C", "DEXs", "Unknown", "", "", ""),
  mk("D", "DEXs", "Not researched", "", "", "", "Defunct (DefiLlama dead URL)"),
  mk("E", "Wallets", "Medium", "Audit Y", "", "paused", "Inactive"),
];

describe("security facts", () => {
  it("derives facts from the structured columns and never from the rating word", () => {
    expect(securityFacts(projects[0])).toEqual(["No published audit found", "Past incident", "Noted red flag"]);
    expect(securityFacts(projects[1])).toEqual([]);
    expect(securityFacts(projects[2])).toEqual(["No published audit found"]);
    // Not researched: a blank audit is unknown, not a finding; a defunct status still counts.
    expect(securityFacts(projects[3])).toEqual(["Paused or shut down"]);
    expect(securityFacts(projects[4])).toEqual(["Paused or shut down", "Noted red flag"]);
  });

  it("aggregates by fact type and by sector without exposing a level", () => {
    const a = securityAggregates(projects);
    expect(a).toMatchObject({ total: 5, checked: 4, notChecked: 1, auditFound: 2 });
    expect(a.byFact).toEqual([
      { fact: "No published audit found", count: 2 },
      { fact: "Past incident", count: 1 },
      { fact: "Paused or shut down", count: 2 },
      { fact: "Noted red flag", count: 2 },
    ]);
    expect(a.bySector.map((s) => s.sector)).toEqual(["Lending", "DEXs", "Wallets"]);
    expect(a.bySector[0].counts["Past incident"]).toBe(1);
    expect(a.bySector[1]).toMatchObject({ projects: 2, checked: 1 });
    expect(JSON.stringify(a)).not.toMatch(/"High"|"Medium"|"Low"/);
  });
});
