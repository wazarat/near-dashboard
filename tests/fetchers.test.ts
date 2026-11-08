import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectNewCatalog, parseCatalogDetail, parseCatalogList } from "../scripts/fetch/catalog";
import { mergeOverviewProtocols, parseBreakdown, parseChainTvl, parseOverviewProtocols, parseProtocols, parseProtocolTvl, sumBreakdown } from "../scripts/fetch/defillama";
import { aggregateDay, assetChain, assetLabel, mergeDayRows, trimRow, type ApiRow } from "../scripts/fetch/intents";
import { parseCharts } from "../scripts/fetch/nearblocks";
import { parseLlamaChart } from "../scripts/fetch/price";

const fx = (p: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", p), "utf8"));

describe("defillama parsers", () => {
  it("keeps only protocols on Near or Aurora with plain per-chain TVL", () => {
    const ps = parseProtocols(fx("defillama/protocols.json"));
    const slugs = ps.map((p) => p.slug);
    expect(slugs).toContain("near-intents");
    expect(slugs).toContain("trisolaris");
    expect(slugs).not.toContain("uniswap-v3");
    const lend = ps.find((p) => p.slug === "rhea-lend")!;
    expect(lend.tvlNear).toBeGreaterThan(100_000_000);
    expect(lend.tvlAurora).toBeNull();
    expect(lend.address).toBe("near:token.rhealab.near");
    const tri = ps.find((p) => p.slug === "trisolaris")!;
    expect(tri.tvlAurora).toBeGreaterThan(0);
    expect(tri.tvlNear).toBeNull();
  });
  it("merges overview-only protocols such as the chain fee row", () => {
    const base = parseProtocols(fx("defillama/protocols.json"));
    const fees = parseOverviewProtocols(fx("defillama/overview-fees-near.json"));
    const merged = mergeOverviewProtocols(base, [{ list: fees, kind: "fees" }]);
    const near = merged.find((p) => p.slug === "near")!;
    expect(near.name).toBe("Near");
    expect(near.kinds).toEqual(["fees"]);
    expect(merged.find((p) => p.slug === "near-intents")!.kinds).toEqual(["tvl", "fees"]);
  });
  it("breakdown -> name -> daily series, and the chain total is the sum", () => {
    const json = fx("defillama/overview-dexs-near.json");
    const bd = parseBreakdown(json);
    expect(Object.keys(bd)).toContain("NEAR Intents");
    const total = sumBreakdown(json);
    expect(total).toHaveLength(5);
    const last = total.at(-1)!;
    const sumNames = Object.values(bd).reduce((a, s) => a + (s.find(([d]) => d === last[0])?.[1] ?? 0), 0);
    expect(Math.abs(sumNames - last[1])).toBeLessThanOrEqual(Object.keys(bd).length);
  });
  it("protocol tvl per chain and chain tvl", () => {
    const s = parseProtocolTvl(fx("defillama/protocol-near-intents.json"), "near");
    // The fixture has two points on the same day; the parser keeps one value per date.
    expect(s).toHaveLength(4);
    expect(parseProtocolTvl(fx("defillama/protocol-near-intents.json"), "aurora")).toEqual([]);
    const c = parseChainTvl(fx("defillama/chain-tvl-near.json"));
    expect(c).toHaveLength(7);
    expect(c.at(-1)![0]).toBe("2026-11-08");
  });
});

describe("nearblocks", () => {
  it("parses every daily chart field with dates as YYYY-MM-DD", () => {
    const s = parseCharts(fx("nearblocks/charts.json"));
    expect(s.txns).toHaveLength(6);
    expect(s.txns.at(-1)).toEqual(["2026-11-07", 682432]);
    expect(s.activeAccounts.at(-1)![1]).toBe(77076);
    expect(s.price.at(-1)![1]).toBeCloseTo(3.7104, 3);
    expect(s.newAccounts.at(-1)![1]).toBe(5226);
  });
});

describe("price", () => {
  it("parses llama coin charts into daily points", () => {
    const s = parseLlamaChart(fx("price/llama-chart.json"));
    expect(s).toHaveLength(5); // six timestamps, two on the same UTC day
    expect(s[0][0]).toBe("2023-12-31");
  });
});

describe("catalog", () => {
  it("parses the list and the detail contracts, detects projects missing from the CSV", () => {
    const list = parseCatalogList(fx("catalog/projects.json"));
    expect(list.length).toBe(6);
    expect(list.find((p) => p.slug === "ref-finance")!.name).toBe("Rhea Finance");
    const det = parseCatalogDetail(fx("catalog/project-ref-finance.json"))!;
    expect(det.slug).toBe("ref-finance");
    expect(det.contracts).toEqual(["token.rhealab.near"]); // blank contract key ignored, RHEA token address kept
    const mp = parseCatalogDetail({ slug: "meta-pool", profile: { contracts: { "meta-pool.near": "", "": "" }, tokens: { stnear: { address: { near: "meta-pool.near" } }, meta: { address: { near: "meta-token.near" } } } } })!;
    expect(mp.contracts).toEqual(["meta-pool.near", "meta-token.near"]);
    expect(parseCatalogDetail(false)).toBeNull();
    const detected = detectNewCatalog(list, ["Rhea Finance"], [], [], "2026-11-08");
    expect(detected.some((d) => d.slug === "ref-finance")).toBe(false);
    expect(detected.length).toBe(5);
    expect(detected[0].source).toBe("catalog");
  });
});

describe("intents", () => {
  const rows: ApiRow[] = fx("intents/page.json");
  it("classifies asset chains and labels", () => {
    expect(assetChain("nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near")).toBe("eth");
    expect(assetChain("nep141:btc.omft.near")).toBe("btc");
    expect(assetChain("nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1")).toBe("near");
    expect(assetChain("nep141:wrap.near")).toBe("near");
    expect(assetLabel("nep141:btc.omft.near")).toBe("BTC");
    expect(assetLabel("nep141:wrap.near")).toBe("wNEAR");
    expect(assetChain("1cs_v1:btc:native:coin")).toBe("btc");
    expect(assetChain("1cs_v1:sol:spl:A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS")).toBe("sol");
    expect(assetChain("nep245:v2_1.omni.hot.tg:56_2CMMyVTGZkeyNZTSvS5sarzfir6g")).toBe("bsc");
    expect(assetChain("nep245:v2_1.omni.hot.tg:1117_")).toBe("tron");
    expect(assetChain("nep141:token.sweat")).toBe("near");
    expect(assetChain("nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near")).toBe("arb");
    expect(assetLabel("1cs_v1:btc:native:coin")).toBe("BTC (native)");
    expect(assetLabel("nep245:v2_1.omni.hot.tg:56_11111111111111111111")).toBe("BSC (native, HOT)");
  });
  it("aggregates a day: SUCCESS only in volume, statuses counted, routes and referrals grouped, hash is stable", () => {
    const trimmed = rows.map(trimRow).filter((r) => r[0] >= 1794096000); // 2026-11-07
    const day = aggregateDay("2026-11-07", trimmed, false);
    expect(day.rows).toBe(3);
    expect(day.statuses).toEqual({ SUCCESS: 2, REFUNDED: 1 });
    expect(day.volumeUsd).toBe(1101);
    expect(day.successCount).toBe(2);
    expect(day.uniqueRecipients).toBe(2);
    expect(day.routes["eth>near"].count).toBe(1);
    expect(day.routes["btc>sol"].usd).toBe(1000);
    expect(day.referrals["wallet-a"].count).toBe(1);
    expect(day.referrals["(none)"].count).toBe(1);
    expect(day.appFeeRecipients["fees.wallet-a.near"].count).toBe(1);
    expect(day.medianUsd).toBe(100.5);
    expect(aggregateDay("2026-11-07", trimmed, false).sha256).toBe(day.sha256);
  });
  it("merges rows by deposit address + memo without duplicates", () => {
    const t = rows.map(trimRow);
    const merged = mergeDayRows(t, [t[0], { ...t[1] } as typeof t[1]]);
    expect(merged).toHaveLength(4);
    expect(merged[0][0]).toBeLessThanOrEqual(merged[1][0]);
  });
});
