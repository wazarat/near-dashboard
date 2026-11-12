import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { otherTvlOf } from "../scripts/fetch/defillama";
import { parseCsv } from "../scripts/lib/csv";
import { mergeExtra, parseSeedRow } from "../src/lib/extra-metrics";

const seedRows = parseCsv(fs.readFileSync(path.join(__dirname, "..", "data", "near-live-metrics-2026-11-12.csv"), "utf8"));

describe("DefiLlama's other TVL views", () => {
  it("sums -borrowed and -staking over NEAR and Aurora, apart from TVL", () => {
    expect(otherTvlOf({ Near: 140, "Near-borrowed": 25, "Aurora-borrowed": 5, "Near-staking": 3, Aurora: 1 })).toEqual({ borrowed: 30, staking: 3 });
    expect(otherTvlOf({ Near: 140 })).toBeUndefined();
    expect(otherTvlOf(undefined)).toBeUndefined();
  });
});

describe("live-metrics snapshot", () => {
  it("covers the 468 non-legacy projects, all dated", () => {
    const parsed = seedRows.map((r) => parseSeedRow(r as Record<string, string>));
    expect(parsed.filter(Boolean)).toHaveLength(468);
    expect(new Set(parsed.map((s) => s?.asOf))).toEqual(new Set(["2026-11-12"]));
  });

  it("reads Rhea Lend's total deposited as TVL plus borrowed, and leaves blanks absent", () => {
    const row = seedRows.find((r) => r["Project/Company Name"] === "Rhea Lend (formerly Burrow)") as Record<string, string>;
    const s = parseSeedRow(row)!;
    expect(s.values.borrowed).toBe(25_029_218);
    expect(s.values.totalDeposited).toBe(165_475_161);
    expect(s.values.totalDeposited).toBe(140_445_943 + 25_029_218);
    expect(s.values).not.toHaveProperty("aggregatorVolume");
  });

  it("adds a stablecoin's NEAR and Aurora supply into one figure", () => {
    expect(parseSeedRow({ "Project/Company Name": "X", "As Of": "2026-11-12", "Stablecoin Supply on NEAR (USD)": "90", "Stablecoin Supply on Aurora (USD)": "10" })?.values.stablecoinSupply).toBe(100);
  });
});

describe("merging live and snapshot values", () => {
  const seed = { name: "L", asOf: "2026-11-12", values: { borrowed: 20, totalDeposited: 160, tokenHolders: 99 } };

  it("keeps snapshot values, each with its own date, when nothing live exists", () => {
    expect(mergeExtra(null, seed, 140)).toEqual({ values: { borrowed: 20, totalDeposited: 160, tokenHolders: 99 }, asOf: { borrowed: "2026-11-12", totalDeposited: "2026-11-12", tokenHolders: "2026-11-12" }, from: { borrowed: "snapshot", totalDeposited: "snapshot", tokenHolders: "snapshot" } });
  });

  it("lets a live value replace the snapshot, and recomputes total deposited from live TVL plus live borrowed", () => {
    const m = mergeExtra({ values: { borrowed: 25 }, asOf: "2026-11-11" }, seed, 143)!;
    expect(m.values).toEqual({ borrowed: 25, totalDeposited: 168, tokenHolders: 99 });
    expect(m.from).toEqual({ borrowed: "live", totalDeposited: "live", tokenHolders: "snapshot" });
    expect(m.asOf.totalDeposited).toBe("2026-11-11");
    expect(mergeExtra(null, null, 1)).toBeUndefined();
  });
});
