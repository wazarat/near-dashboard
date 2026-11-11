import { describe, expect, it } from "vitest";
import { hasTakeaway, points } from "@/lib/takeaways";

describe("card takeaways", () => {
  it("splits a summary at semicolons and sentence ends, keeping every figure whole", () => {
    expect(points("NEAR chain TVL $170.3M (-31.8% over the last 30 days), 30d volume $4.1B, 30d fees $6.3M; Aurora TVL $3.7M.").points).toEqual([
      "NEAR chain TVL $170.3M (-31.8% over the last 30 days), 30d volume $4.1B, 30d fees $6.3M",
      "Aurora TVL $3.7M",
    ]);
    expect(points("Top 3 projects hold 61% of TVL and the top 10 hold 98%; Rhea Lend (formerly Burrow) alone is 28%.").points).toEqual(["Top 3 projects hold 61% of TVL and the top 10 hold 98%", "Rhea Lend (formerly Burrow) alone is 28%"]);
    expect(points("141 events from Apr 2021 to Nov 2026. Funding leads with 36, 25 are incidents, and 72 carry a USD amount.").points).toEqual(["141 events from Apr 2021 to Nov 2026", "Funding leads with 36, 25 are incidents, and 72 carry a USD amount"]);
  });

  it("never changes a number", () => {
    const text = "Over the last 30d, Rhea LST (rNEAR) rose 53.2% while LiNEAR Protocol fell 64.0% in tvl (25 projects pass the size filter).";
    const digits = (s: string) => s.replace(/[^0-9.%$]/g, "");
    expect(digits(points(text).points.join(" "))).toBe(digits(text).replace(/\.$/, ""));
  });

  it("returns nothing for an empty summary", () => {
    expect(points("").points).toEqual([]);
    expect(hasTakeaway(points(""))).toBe(false);
    expect(hasTakeaway(points("One point."))).toBe(true);
  });
});
