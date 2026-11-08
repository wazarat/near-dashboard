import { describe, expect, it } from "vitest";
import { aggregateInvestors, isAmountDisclosed, NameResolver, normalizeName, parseDate, parseMemoInsights, parseNumber, parsePresence, roundBucket, slugify, splitList, statusGroup, toEvent, toProject, toRound } from "../src/lib/parse";

const row = {
  "Project/Company Name": "Rhea Finance",
  Website: "https://app.rhea.finance",
  "Sector/Category": "DEXs & Liquidity",
  Subcategory: "DEX / lending / LST suite",
  "Native Chain": "NEAR native",
  "Native Chain Detail": "NEAR",
  "Native Chain Confidence": "High",
  "Traction Tier": "Tier 2 - Strong",
  "TVL on NEAR + Aurora (USD)": "23306044",
  "30d DEX Volume (USD)": "309,306,629",
  "30d Fees (USD)": "615715",
  "30d Revenue (USD)": "123794",
  "Funding Type": "VC-backed; Token-funded",
  "Amount Raised": "Ref Finance $4.8M (2022-02-17)",
  Token: "RHEA (replaced REF and BRRR)",
  "Security Risk Level": "High",
  Description: "Chain-abstracted liquidity platform",
  Status: "Mainnet",
  "Discovered Via": "NEAR Catalog; DefiLlama",
  "Chain Presence": "Aurora, NEAR",
  "TVL on NEAR (USD)": "23306044",
  "TVL on Aurora (USD)": "",
};

describe("parse helpers", () => {
  it("parseNumber treats blanks as null, strips separators, rejects junk", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("  ")).toBeNull();
    expect(parseNumber("$1,234.5")).toBe(1234.5);
    expect(() => parseNumber("n/a")).toThrow();
  });
  it("splitList, slugify, normalizeName", () => {
    expect(splitList("a; b ;;c")).toEqual(["a", "b", "c"]);
    expect(slugify("Rhea Lend (formerly Burrow)")).toBe("rhea-lend-formerly-burrow");
    expect(normalizeName("Rhea Lend (formerly Burrow)")).toBe("rhea lend");
  });
  it("statusGroup keeps legacy listings and defunct rows apart", () => {
    expect(statusGroup("Unknown (legacy 2021-23 listing)")).toBe("Legacy listing");
    expect(statusGroup("Defunct (DefiLlama dead URL)")).toBe("Defunct");
    expect(statusGroup("Unknown")).toBe("Unknown");
    expect(statusGroup("Inactive")).toBe("Inactive");
    expect(statusGroup("Building")).toBe("Building");
  });
  it("parseDate accepts month-only values", () => {
    expect(parseDate("2022-01")).toEqual({ date: "2022-01-01", monthOnly: true });
    expect(parseDate("2022-01-16")).toEqual({ date: "2022-01-16", monthOnly: false });
    expect(parseDate("")).toBeNull();
    expect(() => parseDate("Jan 2022")).toThrow();
  });
  it("presence and disclosure", () => {
    expect(parsePresence("Aurora, NEAR")).toEqual(["Aurora", "NEAR"]);
    expect(parsePresence("")).toEqual([]);
    expect(isAmountDisclosed("Amount undisclosed")).toBe(false);
    expect(isAmountDisclosed("$4.8M (2022)")).toBe(true);
  });
  it("roundBucket", () => {
    expect(roundBucket("Seed (as Ref Finance)")).toBe("Seed / pre-seed");
    expect(roundBucket("PIPE")).toBe("Public market");
    expect(roundBucket("Grant (25M AURORA)")).toBe("Grant");
    expect(roundBucket("Private token round")).toBe("Token sale");
    expect(roundBucket("Acquisition")).toBe("Acquisition");
  });
});

describe("toProject", () => {
  it("maps the 32-column row, splits funding types and chain presence", () => {
    const p = toProject(row);
    expect(p.id).toBe("rhea-finance");
    expect(p.volume).toBe(309306629);
    expect(p.tvlAurora).toBeNull();
    expect(p.presence).toEqual(["Aurora", "NEAR"]);
    expect(p.fundingTypes).toEqual(["VC-backed", "Token-funded"]);
    expect(p.discoveredViaList).toEqual(["NEAR Catalog", "DefiLlama"]);
    expect(p.revenueCapture).toBeCloseTo(123794 / 615715);
    expect(p.hasTraction).toBe(true);
    expect(p.metricSource.tvl).toBe("snapshot");
  });
  it("rejects unknown enum values", () => {
    expect(() => toProject({ ...row, "Native Chain": "Solana native" })).toThrow(/Native Chain/);
  });
});

describe("resolver, events, rounds, investors", () => {
  const projects = [toProject(row), toProject({ ...row, "Project/Company Name": "Rhea Lend (formerly Burrow)" })];
  const resolver = new NameResolver(projects, [{ alias: "Burrow", project: "Rhea Lend (formerly Burrow)" }]);
  it("resolves exact, alias and normalized names", () => {
    expect(resolver.resolve("Rhea Finance")).toBe("rhea-finance");
    expect(resolver.resolve("Burrow")).toBe("rhea-lend-formerly-burrow");
    expect(resolver.resolve("rhea lend")).toBe("rhea-lend-formerly-burrow");
    expect(resolver.resolve("Aptos")).toBeNull();
  });
  it("toEvent keeps month-only dates and dedupes project ids", () => {
    const e = toEvent({ Date: "2022-01", "Event Type": "Funding", Title: "NEAR raises", Projects: "Burrow; Rhea Lend (formerly Burrow); Aptos", "Amount (USD)": "150000000" }, 2, resolver);
    expect(e.date).toBe("2022-01-01");
    expect(e.monthOnly).toBe(true);
    expect(e.projectIds).toEqual(["rhea-lend-formerly-burrow"]);
    expect(e.projects).toHaveLength(3);
  });
  it("toRound and aggregateInvestors", () => {
    const r1 = toRound({ Project: "Rhea Finance", "Round Type": "Seed (as Ref Finance)", Date: "2022-02-17", "Amount (USD)": "4800000", "Lead Investors": "Jump Crypto", "Other Investors": "Alameda Research; Dragonfly Capital", "NEAR Related": "Yes", Confidence: "Sourced" }, 2, resolver);
    const r2 = toRound({ Project: "Rhea Lend (formerly Burrow)", "Round Type": "Seed (as Burrow)", Date: "2022-03-30", "Amount (USD)": "", "Lead Investors": "Dragonfly Capital; Jump Crypto", "Other Investors": "Gate.io (28 institutional investors)", "NEAR Related": "Yes", Confidence: "Aggregator only (re-verify)" }, 3, resolver);
    expect(r1.sourced).toBe(true);
    expect(r2.sourced).toBe(false);
    expect(r2.amount).toBeNull();
    const inv = aggregateInvestors([r1, r2]);
    const jump = inv.find((i) => i.id === "jump-crypto")!;
    expect(jump.deals).toBe(2);
    expect(jump.leads).toBe(2);
    expect(jump.totalDisclosed).toBe(4800000);
    expect(jump.disclosedDeals).toBe(1);
    expect(inv.find((i) => i.name === "Gate.io")?.deals).toBe(1);
    expect(inv.some((i) => /institutional/.test(i.name))).toBe(false);
  });
  it("parseMemoInsights reads the numbered list", () => {
    const md = "# Memo\n\n## Ecosystem insights (from the dataset)\n\n1. One app is the chain. NEAR Intents does 92%.\n2. Natives hold everything. Text.\n\n## Caveats\n3. not an insight";
    const out = parseMemoInsights(md);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ n: 1, title: "One app is the chain", text: "One app is the chain. NEAR Intents does 92%." });
  });
});
