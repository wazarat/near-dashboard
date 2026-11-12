import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseAuroraStats, parseNearStats } from "../scripts/fetch/chain-stats";
import { summariseDex } from "../scripts/fetch/geckoterminal";
import { parseHacks } from "../scripts/fetch/hacks";
import { nearblocksHeaders, parseFts } from "../scripts/fetch/nearblocks";
import { parseStablecoins } from "../scripts/fetch/stablecoins";
import { parseYields } from "../scripts/fetch/yields";
import { isContractId, joinGecko, joinHacks, joinStablecoins, joinTokens, joinYields, stablecoinTotals } from "../src/lib/extra-join";

const fx = (...p: string[]) => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", ...p), "utf8"));

describe("stablecoins (accuracy rule 9)", () => {
  const coins = parseStablecoins(fx("stablecoins", "stablecoins.json"));
  it("keeps USD-pegged coins on NEAR or Aurora and leaves other pegs out", () => {
    expect(coins.map((c) => c.symbol)).toEqual(["USDT", "USDC", "DAI", "FRAX", "TUSD", "USN"]);
    expect(coins.find((c) => c.symbol === "USDT")).toMatchObject({ near: 39_635_867, aurora: 1_375_683 });
  });
  it("counts a coin listed under two names once, on its primary row", () => {
    const map = [
      { project: "DAI by MakerDAO", id: "5", primary: true },
      { project: "DAI", id: "5", primary: false },
      { project: "USDT", id: "1", primary: true },
    ];
    const j = joinStablecoins(coins, map);
    expect(j.values.get("DAI by MakerDAO")?.stablecoinSupply).toBe(787_929 + 51_230);
    expect(j.values.has("DAI")).toBe(false);
    expect(j.countedOn.get("DAI")).toBe("DAI by MakerDAO");
    const sum = [...j.values.values()].reduce((s, v) => s + (v.stablecoinSupply ?? 0), 0);
    expect(sum).toBe(787_929 + 51_230 + 39_635_867 + 1_375_683);
    expect(stablecoinTotals(coins).near).toBe(coins.reduce((s, c) => s + (c.near ?? 0), 0));
  });
});

describe("yields and lending markets", () => {
  const pools = parseYields(fx("yields", "pools.json"), fx("yields", "lendborrow.json"));
  it("keeps NEAR and Aurora pools only, with the lending fields joined", () => {
    expect(pools.every((p) => p.chain === "Near" || p.chain === "Aurora")).toBe(true);
    expect(pools.filter((p) => p.totalSupplyUsd !== null).length).toBeGreaterThan(0);
  });
  it("gives Rhea Lend utilization and a borrow-weighted borrow APY, and Rhea LST its staking APY", () => {
    const v = joinYields(pools, new Map([["Rhea Lend (formerly Burrow)", ["rhea-lend"]], ["Rhea LST (rNEAR)", ["rhea-lst"]]]), new Map([["Rhea Lend (formerly Burrow)", "Lending & Credit"], ["Rhea LST (rNEAR)", "Liquid Staking & Restaking"]]));
    const lend = v.get("Rhea Lend (formerly Burrow)")!;
    const markets = pools.filter((p) => p.project === "rhea-lend" && p.totalSupplyUsd !== null);
    const supplied = markets.reduce((s, p) => s + (p.totalSupplyUsd as number), 0);
    const borrowed = markets.reduce((s, p) => s + (p.totalBorrowUsd as number), 0);
    expect(lend.utilization).toBeCloseTo(borrowed / supplied, 6);
    expect(lend.borrowApy).toBeGreaterThan(0);
    expect(lend.borrowApy).toBeLessThan(1);
    expect(v.get("Rhea LST (rNEAR)")?.stakingApy).toBeCloseTo(0.0443374, 4);
    expect(v.get("Rhea LST (rNEAR)")?.bestPoolApy).toBeUndefined();
  });
});

describe("GeckoTerminal (accuracy rule 6)", () => {
  const near = summariseDex("near", "rhea-finance", "Rhea Finance", fx("geckoterminal", "near-pools.json"));
  it("sums 24h volume and liquidity over the top pools", () => {
    expect(near.pools).toBe(5);
    expect(near.volume24h).toBeGreaterThan(0);
    const raw = fx("geckoterminal", "near-pools.json").data as Array<{ attributes: { name: string; volume_usd: { h24: string } } }>;
    const busiest = [...raw].sort((a, b) => Number(b.attributes.volume_usd.h24) - Number(a.attributes.volume_usd.h24))[0];
    expect(near.topPairs).toHaveLength(3);
    expect(near.topPairs[0]).toBe(busiest.attributes.name);
  });
  it("hides liquidity where the map says it is not DEX liquidity", () => {
    const intents = { ...near, dex: "near-intents", liquidity: 1_620_000_000 };
    const v = joinGecko([near, intents], [
      { network: "near", dex: "rhea-finance", project: "Rhea Finance", showLiquidity: true },
      { network: "near", dex: "near-intents", project: "NEAR Intents", showLiquidity: false },
    ]);
    expect(v.get("NEAR Intents")).toEqual({ dexVolume24h: near.volume24h });
    expect(v.get("Rhea Finance")?.dexLiquidity).toBe(near.liquidity);
  });
});

describe("NearBlocks tokens (accuracy rules 5 and 8)", () => {
  const tokens = parseFts(fx("nearblocks", "fts.json"));
  it("reads supply times price, lower-casing contracts", () => {
    expect(tokens[0]).toMatchObject({ contract: "usdt.tether-token.near", symbol: "USDt" });
    expect(tokens.every((t) => t.contract === t.contract.toLowerCase())).toBe(true);
  });
  it("matches a token to a project only by contract, never by symbol", () => {
    expect(isContractId("token.burrow.near")).toBe(true);
    expect(isContractId("0xFa94348467f64D5A457F75F8bc40495D33c65aBB")).toBe(true);
    expect(isContractId("17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1")).toBe(true);
    expect(isContractId("RHEA")).toBe(false);
    expect(isContractId("USDt")).toBe(false);
    expect(isContractId("neko")).toBe(false);
    expect(isContractId("earn.kaiching")).toBe(true);
    expect(isContractId("jambo-1679.meme-cooking.near")).toBe(true);
    expect(isContractId("aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near")).toBe(true);
    const v = joinTokens(tokens, [
      { project: "Symbol only", contract: "USDt", chain: "near" },
      { project: "USDT", contract: "usdt.tether-token.near", chain: "near" },
    ]);
    expect(v.has("Symbol only")).toBe(false);
    expect(v.get("USDT")?.tokenSupplyValue).toBe(tokens[0].supplyValue);
  });
  it("sends the NearBlocks key only when one is set", () => {
    expect(nearblocksHeaders({})).toEqual({});
    expect(nearblocksHeaders({ NEARBLOCKS_API_KEY: "k" })).toEqual({ Authorization: "Bearer k" });
  });
});

describe("chain stats and hacks", () => {
  it("reads NearBlocks and Aurora Blockscout lifetime stats", () => {
    expect(parseNearStats(fx("nearblocks", "stats.json"))).toEqual({ nodesOnline: 371, totalTxns: 5_480_988_011, tps: 25 });
    expect(parseAuroraStats(fx("blockscout", "stats.json"))).toEqual({ totalTxns: 82_121_950, totalAddresses: 12_608_928, totalBlocks: 224_228_799 });
    expect(parseNearStats({})).toBeNull();
  });
  it("keeps exploits on NEAR or Aurora and matches them to projects by name", () => {
    const hacks = parseHacks(fx("hacks", "hacks.json"));
    expect(hacks.map((h) => h.name)).toEqual(["Ref Finance", "Skyward Finance", "Rhea Lend", "Sweat Foundation"]);
    expect(hacks.find((h) => h.name === "Rhea Lend")).toMatchObject({ date: "2026-04-16", amount: 18_400_000 });
    const j = joinHacks(hacks, (n) => ({ "Ref Finance": "rhea-finance", "Rhea Lend": "rhea-lend-formerly-burrow" })[n] ?? null);
    expect(j.byProject.get("rhea-finance")?.[0].date).toBe("2021-08-15");
    expect(j.unmatched).toEqual(["Skyward Finance", "Sweat Foundation"]);
  });
});
