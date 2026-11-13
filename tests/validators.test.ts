import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parseValidators, stakeByProject } from "../src/lib/validators";
import { FILE, run } from "../scripts/fetch/validators";
import type { Ctx } from "../scripts/fetch/context";
import { emptyMeta } from "../src/lib/history-types";

const Y = (near: number) => (BigInt(near) * BigInt("1000000000000000000000000")).toString();
const result = { epoch_height: 4967, current_validators: [{ account_id: "figment.poolv1.near", stake: Y(28_682_976) }, { account_id: "ledgerbyfigment.poolv1.near", stake: Y(23_176_068) }, { account_id: "everstake.poolv1.near", stake: Y(3_392_693) }, { account_id: "bad", stake: "x" }] };

describe("validator stake", () => {
  it("reads whole NEAR per pool from the RPC result, largest first", () => {
    const { epochHeight, pools } = parseValidators(result);
    expect(epochHeight).toBe(4967);
    expect(pools.map((p) => p.pool)).toEqual(["figment.poolv1.near", "ledgerbyfigment.poolv1.near", "everstake.poolv1.near"]);
    expect(pools[0].stake).toBe(28_682_976);
  });
  it("sums a project's verified pools and ignores unverified or missing ones", () => {
    const { pools } = parseValidators(result);
    const m = stakeByProject(pools, [
      { project: "Figment", pool: "figment.poolv1.near", verified: true },
      { project: "Figment", pool: "ledgerbyfigment.poolv1.near", verified: true },
      { project: "Everstake", pool: "everstake.poolv1.near", verified: false },
      { project: "Gone", pool: "gone.poolv1.near", verified: true },
    ]);
    expect(m.get("Figment")).toBe(51_859_044);
    expect(m.has("Everstake")).toBe(false);
    expect(m.has("Gone")).toBe(false);
  });
  it("falls back to the second endpoint and skips gracefully when both fail", async () => {
    const ctx: Ctx = { mode: "daily", today: "2026-11-13", nowMs: 0, meta: emptyMeta(), env: {}, dryRun: true, maxCalls: 10 };
    const seen: string[] = [];
    const flaky = (async (url: string) => {
      seen.push(url);
      if (url.includes("fastnear")) return new Response("busy", { status: 503 });
      return new Response(JSON.stringify({ result }), { status: 200 });
    }) as unknown as typeof fetch;
    const ok = await run(ctx, flaky);
    expect(ok.rows).toBe(3);
    expect(seen.filter((u) => u.includes("fastnear"))).toHaveLength(2);
    expect(ok.notes[0]).toContain("rpc.mainnet.near.org");
    const down = (async () => new Response("down", { status: 500 })) as unknown as typeof fetch;
    const before = fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8") : null;
    const out = await run(ctx, down);
    expect(out.notes[0]).toMatch(/^skipped: every RPC endpoint failed/);
    expect(fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8") : null).toBe(before);
  });
});
