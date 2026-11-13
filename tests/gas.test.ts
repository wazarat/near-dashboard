import { describe, expect, it } from "vitest";
import { CONTRACT_GAS_SHARE, gasTotals, priceOn, type GasFile } from "../src/lib/gas";

describe("gas fees generated per project", () => {
  it("10 NEAR burnt at $2 gives $20 paid by users and $6 to the contract", () => {
    const file: GasFile = { "app.near": [["2026-11-12", 10, 500]] };
    const t = gasTotals(file, ["app.near"], [["2026-11-12", 2]]);
    expect(t).toMatchObject({ nearBurnt: 10, days: 1, end: "2026-11-12" });
    expect(t?.paidUsd).toBeCloseTo(20, 9);
    expect(t?.generatedUsd).toBeCloseTo(6, 9);
    expect(CONTRACT_GAS_SHARE).toBe(0.3);
  });
  it("sums the project's accounts per day at each day's price, over the last 30 days only", () => {
    const file: GasFile = {
      "a.near": [["2026-10-01", 100, 1], ["2026-11-11", 1, 1], ["2026-11-12", 2, 1]],
      "b.near": [["2026-11-12", 3, 1]],
      "other.near": [["2026-11-12", 1000, 1]],
    };
    const t = gasTotals(file, ["a.near", "b.near"], [["2026-11-11", 2], ["2026-11-12", 3]]);
    // Oct 1 is outside the 30 days to Nov 12; Nov 11 is 1 NEAR at $2, Nov 12 is 5 NEAR at $3.
    expect(t?.nearBurnt).toBe(6);
    expect(t?.paidUsd).toBeCloseTo(17, 9);
    expect(t?.generatedUsd).toBeCloseTo(5.1, 9);
  });
  it("uses the latest earlier price for a day with none, and gives null with no data", () => {
    expect(priceOn([["2026-11-10", 2], ["2026-11-12", 3]], "2026-11-11")).toBe(2);
    expect(priceOn([["2026-11-10", 2]], "2026-11-09")).toBeNull();
    expect(gasTotals({}, ["a.near"], [["2026-11-12", 2]])).toBeNull();
  });
});
