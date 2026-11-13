import { describe, expect, it } from "vitest";
import metaJson from "../src/data/generated/meta.json";
import { toProject } from "../src/lib/parse";
import projectsJson from "../src/data/generated/projects.json";
import { applies, coverageWhereApplies, fmtMetricValue, isMeasured, metricLabel, metricOf, projectMetrics, rankLeaders, SECTOR_METRICS, sectorDef, sectorMetricTotal, topLeaders, valueState } from "../src/lib/sector-metrics";
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
    // No fee listing, so revenue does not apply (the protocol's share of fees is unknown).
    expect(shown(mk("L", "Lending & Credit"))).toEqual(["totalDeposited", "borrowed", "tvl", "utilization", "borrowApy", "fees"]);
    expect(shown(mk("L2", "Lending & Credit", "Mainnet", { fees: 10 }))).toContain("revenue");
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

describe("applicability by how projects earn", () => {
  const has = (sector: string, id: Parameters<typeof applies>[1], extra: Partial<Project> = {}) => applies({ sector, token: "X", id: "p", extra: undefined, volume: 1, fees: 1, ...extra } as Project, id);
  it("TVL applies to DEXs, lending, liquid staking, yield, perps, RWA, bridges and prediction markets only", () => {
    for (const s of ["DEXs & Liquidity", "Lending & Credit", "Liquid Staking & Restaking", "Yield & Asset Management", "Perps, Options & Derivatives", "RWA & Tokenized Assets", "Bridges & Interoperability", "Prediction Markets"]) expect(has(s, "tvl"), s).toBe(true);
    for (const s of ["Launchpads", "Trading Tools & Bots", "Memecoins & Community", "Wallets & Custody"]) expect(has(s, "tvl"), s).toBe(false);
  });
  it("fees apply to the fee-earning sectors and not to memecoins, AI agents, NFTs, social, DAOs or stablecoins", () => {
    for (const s of ["DEXs & Liquidity", "Lending & Credit", "Liquid Staking & Restaking", "Yield & Asset Management", "Perps, Options & Derivatives", "Launchpads", "Bridges & Interoperability", "Prediction Markets", "Trading Tools & Bots"]) expect(has(s, "fees"), s).toBe(true);
    for (const s of ["Memecoins & Community", "AI Agents", "NFTs, Gaming & Collectibles", "Social & Identity", "DAOs, Governance & Public Goods", "Stablecoins & Payments", "RWA & Tokenized Assets", "Infrastructure & Dev Tools"]) expect(has(s, "fees"), s).toBe(false);
  });
  it("revenue applies only with a fee listing, and bridge volume only where the bridge swaps", () => {
    expect(has("DEXs & Liquidity", "revenue")).toBe(true);
    expect(has("DEXs & Liquidity", "revenue", { fees: null })).toBe(false);
    expect(has("Bridges & Interoperability", "volume")).toBe(true);
    expect(has("Bridges & Interoperability", "volume", { volume: null })).toBe(false);
    expect(has("DEXs & Liquidity", "volume", { volume: null })).toBe(true);
  });
});

describe("one leader ranking rule (docs/SECTOR-METRICS.md, section 1)", () => {
  const extra = (values: Record<string, number>) => ({ extra: { values, asOf: {}, from: {} } });
  const names = (sector: string, list: Project[]) => rankLeaders(sector, list).map((l) => l.project.name);

  it("sorts by the headline, then curated rank, then name, and leaves inactive projects out", () => {
    const list = [
      mk("Curated1", "DEXs & Liquidity", "Mainnet", { leaderRank: 1 }),
      mk("Big", "DEXs & Liquidity", "Mainnet", { volume: 1_000_000, leaderRank: 2 }),
      mk("Mid", "DEXs & Liquidity", "Mainnet", { volume: 50_000 }),
      mk("Dead", "DEXs & Liquidity", "Defunct", { volume: 9_000_000, leaderRank: 3 }),
      mk("Asleep", "DEXs & Liquidity", "Inactive", { volume: 8_000_000 }),
      mk("Zed", "DEXs & Liquidity"),
      mk("Alpha", "DEXs & Liquidity"),
      mk("Wallet", "Wallets & Custody", "Mainnet", { volume: 5 }),
    ];
    expect(names("DEXs & Liquidity", list)).toEqual(["Big", "Mid", "Curated1", "Alpha", "Zed"]);
    expect(rankLeaders("DEXs & Liquidity", list).map((l) => l.basis)).toEqual(["value", "value", "curated", "unranked", "unranked"]);
    // A card names only projects placed by a value or by curated rank.
    expect(topLeaders("DEXs & Liquidity", list).map((l) => l.project.name)).toEqual(["Big", "Mid", "Curated1"]);
  });

  it("drops values under 1% of the top one back to curated order", () => {
    const list = [
      mk("Top", "DEXs & Liquidity", "Mainnet", { volume: 1_000_000 }),
      mk("Tiny", "DEXs & Liquidity", "Mainnet", { volume: 100 }),
      mk("Router", "DEXs & Liquidity", "Mainnet", { leaderRank: 1 }),
      mk("Edge", "DEXs & Liquidity", "Mainnet", { volume: 10_000 }),
    ];
    expect(names("DEXs & Liquidity", list)).toEqual(["Top", "Edge", "Router", "Tiny"]);
  });

  it("ranks an unmeasured sector by its ranking facts in order, then curated rank", () => {
    const list = [
      mk("HOT", "Wallets & Custody", "Mainnet", { leaderRank: 1, live: { signers7d: 1_000_000 } as Project["live"] }),
      mk("Meteor", "Wallets & Custody", "Mainnet", { leaderRank: 2 }),
      mk("Trust", "Wallets & Custody", "Mainnet", extra({ referralVolume: 26_000_000 })),
    ];
    expect(names("Wallets & Custody", list)).toEqual(["Trust", "HOT", "Meteor"]);
    expect(rankLeaders("Wallets & Custody", list).map((l) => l.key)).toEqual(["referralVolume", "signers7d", null]);
    const ex = [mk("Bitget", "Exchanges & On/Off-Ramps", "Mainnet", { leaderRank: 2, ...extra({}) }), mk("Binance", "Exchanges & On/Off-Ramps", "Mainnet", { leaderRank: 1, live: { cexReserves: 500 } as Project["live"] })];
    expect(names("Exchanges & On/Off-Ramps", ex)).toEqual(["Binance", "Bitget"]);
    // No ranking fact: curated order.
    expect(names("Data & Analytics", [mk("B", "Data & Analytics", "Mainnet", { leaderRank: 2 }), mk("A", "Data & Analytics", "Mainnet", { leaderRank: 1 })])).toEqual(["A", "B"]);
  });

  it("takes totals and leaders from the same set, so an inactive project is in neither", () => {
    const list = [mk("Dew", "Yield & Asset Management", "Mainnet", { tvl: 250_000 }), mk("Aurora+", "Yield & Asset Management", "Inactive", { tvl: 2_300_000, leaderRank: 1 })];
    expect(names("Yield & Asset Management", list)).toEqual(["Dew"]);
    expect(sectorMetricTotal("Yield & Asset Management", list, "tvl")).toMatchObject({ total: 250_000, tracked: 1, applies: 1 });
    // Counts overlap across projects, so they carry the top value rather than a sum.
    const memes = [mk("BD", "Memecoins & Community", "Mainnet", { token: "BD", ...extra({ tokenHolders: 286_000 }) }), mk("SZ", "Memecoins & Community", "Mainnet", { token: "SZ", ...extra({ tokenHolders: 11_000 }) })];
    const t = sectorMetricTotal("Memecoins & Community", memes, "tokenHolders");
    expect(t.total).toBeNull();
    expect(t.top?.project.name).toBe("BD");
  });

  it("reads a bridge's volume as 30d volume and NFTs and AI agents by signers", () => {
    expect(metricLabel("Bridges & Interoperability", "volume")).toBe("30d volume");
    expect(metricLabel("DEXs & Liquidity", "volume")).toBe("30d DEX volume");
    expect(sectorDef("NFTs, Gaming & Collectibles").headline).toBe("signers7d");
    expect(sectorDef("AI Agents").headline).toBe("signers7d");
    expect(sectorDef("NFTs, Gaming & Collectibles").metrics).toContain("tokenHolders");
    expect(sectorDef("Validators & Node Operators").rankBy).toEqual(["validatorStake"]);
    expect(sectorDef("Security, Risk & Compliance").rankBy).toEqual(["auditedProjects"]);
    expect(sectorDef("Ecosystem, Funding & Education").rankBy).toEqual(["fundingDisclosed"]);
    expect(fmtMetricValue("validatorStake", 51_900_000)).toBe("51.9M NEAR");
    expect(fmtMetricValue("tvl", null)).toBe("Not tracked");
  });
});

describe("leaders on the built data", () => {
  const all = projectsJson as unknown as Project[];
  it("puts Rhea Finance first in DEXs and keeps Spin out of Perps", () => {
    expect(rankLeaders("DEXs & Liquidity", all)[0].project.name).toBe("Rhea Finance");
    expect(rankLeaders("Perps, Options & Derivatives", all).map((l) => l.project.name)).not.toContain("Spin");
    expect(rankLeaders("Yield & Asset Management", all).map((l) => l.project.name)).not.toContain("Aurora+");
  });
});
