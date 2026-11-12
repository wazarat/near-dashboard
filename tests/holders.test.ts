import { describe, expect, it } from "vitest";
import { parseAuroraHolders, parseNearHolders } from "../scripts/fetch/holders";

describe("token holder counts", () => {
  it("reads NearBlocks and Aurora Blockscout holder counts", () => {
    expect(parseNearHolders({ holders: [{ count: "99423" }] })).toBe(99_423);
    expect(parseNearHolders({})).toBeNull();
    expect(parseAuroraHolders({ holders_count: "29498" })).toBe(29_498);
    expect(parseAuroraHolders({ holders_count: null })).toBeNull();
  });
});
