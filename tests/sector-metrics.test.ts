import { describe, expect, it } from "vitest";
import metaJson from "../src/data/generated/meta.json";
import { toProject } from "../src/lib/parse";
import { coverageWhereApplies, isMeasured, metricOf, projectMetrics, SECTOR_METRICS, sectorDef, valueState } from "../src/lib/sector-metrics";
import { isStaleAt } from "../src/lib/freshness";
import type { Project } from "../src/lib/types";

const mk = (name: string, sector: string, status = "Mainnet", over: Partial<Project> = {}): Project => ({
  ...toProject({
    "Project/Company Name": name,
    "Sector/Category": sector,
    "Native Chain": "NEAR native",
    "Native Chain Confidence": "High",
    "Traction Tier": "Not tracked",
    "TVL on NEAR + Aurora (USD)": "",
    "Security Risk Level": "Not researched",
    Description: "d",
    Status: status,
    "Discovered Via": "DefiLlama",
    "Funding Type": "Not researched",
    "Chain Presence": "NEAR",
  }),
  ...over,
});

describe("sector metric registry", () => {
  it("has an entry for every sector in the data, with the spec's measured split", () => {
    for (const s of (metaJson as { sectors: string[] }).sectors) expect(SECTOR_METRICS, s).toHaveProperty([s]);
    expect(Object.values(SECTOR_METRICS).filter((d) => d.measured)).toHaveLength(16);
    expect(Object.values(SECTOR_METRICS).filter((d) => !d.measured)).toHaveLength(8);
    for (const d of Object.values(SECTOR_METRICS)) if (d.measured) expect(d.metrics[0]).toBe(d.headline);
    expect(isMeasured("Wallets & Custody")).toBe(false);
    expect(sectorDef("Lending & Credit").headline).toBe("totalDeposited");
    expect(sectorDef("Lending & Credit").metrics).not.toContain("volume");
  });

  it("gives each value one of the five states", () => {
    const dex = mk("D", "DEXs & Liquidity", "Mainnet", { volume: 1200, tvl: 0, fees: null });
    expect(valueState(dex, "volume").state).toBe("value");
    expect(valueState(dex, "tvl").state).toBe("zero-by-design");
    expect(valueState(dex, "fees").state).toBe("not-tracked");
    expect(valueState(dex, "borrowed").state).toBe("not-applicable");
    const dead = mk("X", "DEXs & Liquidity", "Defunct", { volume: 50 });
    expect(dead.statusGroup).toBe("Defunct");
    expect(valueState(dead, "volume")).toMatchObject({ state: "inactive", value: 50 });
    // Not-applicable rows never reach the project pop-up.
    const shown = (p: Project) => projectMetrics(p).filter((m) => m.state !== "not-applicable").map((m) => m.id);
    expect(shown(mk("L", "Lending & Credit"))).toEqual(["totalDeposited", "borrowed", "tvl", "utilization", "borrowApy", "fees", "revenue"]);
    // Token metrics only apply to a project with a token.
    expect(shown(mk("T", "Lending & Credit", "Mainnet", { token: "BRRR" }))).toContain("tokenHolders");
    // NEAR Intents' GeckoTerminal liquidity is a model, so it never shows (accuracy rule 6).
    expect(valueState(mk("NEAR Intents", "DEXs & Liquidity", "Mainnet", { id: "near-intents" }), "dexLiquidity").state).toBe("not-applicable");
    // A stablecoin listed under two names shows its supply on one row only (accuracy rule 9).
    const dup = mk("DAI", "Stablecoins & Payments", "Mainnet", { extra: { values: {}, asOf: {}, from: {}, countedOn: { stablecoinSupply: "DAI by MakerDAO" } } });
    expect(valueState(dup, "stablecoinSupply")).toMatchObject({ state: "not-applicable", reason: "Counted once, on DAI by MakerDAO." });
  });

  it("never shows supply times price for a stablecoin (accuracy rule 5)", () => {
    const extra = { values: { tokenSupplyValue: 525_000_000 }, asOf: {}, from: {} };
    expect(metricOf(mk("USDt", "Stablecoins & Payments", "Mainnet", { extra }), "tokenSupplyValue")).toBeNull();
    expect(metricOf(mk("MEME", "Memecoins & Community", "Mainnet", { extra }), "tokenSupplyValue")).toBe(525_000_000);
  });

  it("counts coverage only where the metric applies and the project is active", () => {
    const list = [
      mk("A", "DEXs & Liquidity", "Mainnet", { volume: 5 }),
      mk("B", "DEXs & Liquidity", "Mainnet", { volume: null }),
      mk("C", "DEXs & Liquidity", "Defunct", { volume: 9 }),
      mk("W", "Wallets & Custody", "Mainnet", { volume: 7 }),
    ];
    expect(coverageWhereApplies(list, "volume")).toEqual({ tracked: 1, applies: 2 });
  });

  it("calls a value older than three days old (accuracy rule 4)", () => {
    expect(isStaleAt("2026-11-08", "2026-11-11")).toBe(false);
    expect(isStaleAt("2026-11-07", "2026-11-11")).toBe(true);
  });
});
