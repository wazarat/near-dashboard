import { describe, expect, it } from "vitest";
import { sharedAccounts } from "../src/lib/data-checks";
import { referralsByProject, referralTotals, unmatchedReferrals, type ReferralDay } from "../src/lib/referrals";

const day = (date: string, referrals: Record<string, { count: number; usd: number }>, partial = false) => ({ date, partial, referrals });

describe("NEAR Intents volume per app", () => {
  const days = [
    day("2026-11-01", { lifi: { count: 2, usd: 100 }, "(none)": { count: 9, usd: 900 } }),
    day("2026-11-02", { lifi: { count: 1, usd: 50 }, swapkit: { count: 3, usd: 300 }, "(other)": { count: 1, usd: 5 } }),
    day("2026-11-03", { lifi: { count: 7, usd: 700 } }, true),
  ];
  it("sums complete days only and leaves the untagged and other buckets out", () => {
    const t = referralTotals(days, 30);
    expect(t.days).toBe(2);
    expect(t.end).toBe("2026-11-02");
    expect(t.rows).toEqual([
      { key: "swapkit", count: 3, usd: 300, fees: null },
      { key: "lifi", count: 3, usd: 150, fees: null },
    ]);
  });
  it("credits a project only through verified tags", () => {
    const t = referralTotals(days, 30).rows;
    const m = referralsByProject(t, [
      { referral: "lifi", project: "LI.FI", verified: true },
      { referral: "swapkit", project: "SwapKit", verified: false },
    ]);
    expect(m.get("LI.FI")).toEqual({ usd: 150, count: 3, fees: null, tags: ["lifi"] });
    expect(m.has("SwapKit")).toBe(false);
  });
});

describe("NEAR Intents app fees per app", () => {
  const withFees: ReferralDay[] = [
    { date: "2026-11-01", referrals: { lifi: { count: 2, usd: 100 } }, referralFees: { lifi: 0.5 } },
    { date: "2026-11-02", referrals: { lifi: { count: 1, usd: 50 }, rango: { count: 1, usd: 10 } }, referralFees: { lifi: 0.25 } },
  ];
  it("sums fees when every day in the window carries them, and gives null otherwise", () => {
    const t = referralTotals(withFees, 30);
    expect(t.feeDays).toBe(2);
    expect(t.rows.find((r) => r.key === "lifi")?.fees).toBeCloseTo(0.75, 9);
    expect(t.rows.find((r) => r.key === "rango")?.fees).toBe(0);
    const mixed = referralTotals([...withFees, { date: "2026-11-03", referrals: { lifi: { count: 1, usd: 1 } } }], 30);
    expect(mixed.feeDays).toBe(2);
    expect(mixed.rows.find((r) => r.key === "lifi")?.fees).toBeNull();
  });
  it("lists the largest tags no verified row maps, for labelling", () => {
    const t = referralTotals(withFees, 30).rows;
    expect(unmatchedReferrals(t, [{ referral: "lifi", project: "LI.FI", verified: true }]).map((r) => r.key)).toEqual(["rango"]);
    expect(unmatchedReferrals(t, [{ referral: "lifi", project: "LI.FI", verified: false }]).map((r) => r.key)).toEqual(["lifi", "rango"]);
  });
});

describe("one account, one project", () => {
  it("lists an account mapped to two projects for review", () => {
    const f = sharedAccounts([
      { project: "Rhea Lend", account: "token.rhealab.near" },
      { project: "Rhea Finance", account: "token.rhealab.near" },
      { project: "Rhea Finance", account: "v2.ref-finance.near" },
    ]);
    expect(f).toHaveLength(1);
    expect(f[0].message).toContain("Rhea Finance and Rhea Lend");
  });
});
