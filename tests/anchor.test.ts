import { describe, expect, it } from "vitest";
import { latestAnchor, nearblocksTxUrl, shortHash, verifyCommands } from "../src/lib/anchor";
import { socialPath, yoctoToNear } from "../scripts/anchor/near";
import { setArgs } from "../scripts/anchor/write";

const entry = { commit: "a".repeat(40), inputs: "b".repeat(64), outputs: "c".repeat(64), verdict: "Partly supported", account: "canhav.near", txHash: "9".repeat(44), blockHeight: 1 };

describe("anchor card data", () => {
  it("picks the newest date and ignores other keys", () => {
    expect(latestAnchor({})).toEqual({ latest: null, count: 0 });
    const card = latestAnchor({ "2026-11-13": entry, "2026-11-14": { ...entry, blockHeight: 2 }, junk: entry });
    expect(card.count).toBe(2);
    expect(card.latest?.date).toBe("2026-11-14");
    expect(card.latest?.blockHeight).toBe(2);
  });
  it("builds the NearBlocks link, short hashes and the three commands", () => {
    expect(nearblocksTxUrl("abc")).toBe("https://nearblocks.io/txns/abc");
    expect(shortHash("0123456789abcdef0123")).toBe("01234567…ef0123");
    const cmds = verifyCommands("2026-11-13", entry.commit);
    expect(cmds).toHaveLength(3);
    expect(cmds[0]).toContain(`git checkout ${entry.commit}`);
    expect(cmds[2]).toBe("npm run verify:anchor -- 2026-11-13 --rebuild");
  });
});

describe("SocialDB write", () => {
  it("writes the record as a string under the account's own app key", () => {
    expect(socialPath("canhav.near", "2026-11-13")).toBe("canhav.near/canhav-atlas/anchors/2026-11-13");
    expect(setArgs("canhav.near", "2026-11-13", "{}")).toEqual({ data: { "canhav.near": { "canhav-atlas": { anchors: { "2026-11-13": "{}" } } } } });
  });
  it("formats yoctoNEAR without floating point", () => {
    expect(yoctoToNear(BigInt("500000000000000000000000"))).toBe("0.5000");
    expect(yoctoToNear(BigInt("30000000000000000000000"))).toBe("0.0300");
    expect(yoctoToNear(BigInt(0))).toBe("0.0000");
  });
});
