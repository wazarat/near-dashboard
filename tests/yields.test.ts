import { describe, expect, it } from "vitest";
import { keepLastLend } from "../scripts/fetch/yields";
import type { YieldPoolSnap } from "../src/lib/extra-types";

const pool = (id: string, supply: number | null): YieldPoolSnap => ({ pool: id, project: "burrow", chain: "Near", symbol: "USDC", tvlUsd: 10, apy: 5, totalSupplyUsd: supply, totalBorrowUsd: supply === null ? null : supply / 2, apyBaseBorrow: supply === null ? null : 7 });

describe("yields when /lendBorrow fails", () => {
  it("keeps the last good lending figures with their date", () => {
    const prev = { asOf: "2026-11-12", pools: [pool("a", 100), pool("b", 50)] };
    const out = keepLastLend([pool("a", null), pool("c", null)], prev);
    expect(out.lendAsOf).toBe("2026-11-12");
    expect(out.pools[0]).toMatchObject({ pool: "a", totalSupplyUsd: 100, totalBorrowUsd: 50, apyBaseBorrow: 7, apy: 5 });
    expect(out.pools[1]).toMatchObject({ pool: "c", totalSupplyUsd: null });
  });
  it("carries an older lendAsOf forward, and does nothing without a previous file", () => {
    expect(keepLastLend([pool("a", null)], { asOf: "2026-11-13", lendAsOf: "2026-11-10", pools: [pool("a", 1)] }).lendAsOf).toBe("2026-11-10");
    expect(keepLastLend([pool("a", null)], null)).toEqual({ pools: [pool("a", null)], lendAsOf: null });
  });
});
