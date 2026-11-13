import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emptyMeta, emptySourceStatus } from "../src/lib/history-types";
import type { Ctx } from "../scripts/fetch/context";
import { runSource } from "../scripts/lib/run-source";

const ctx = { mode: "daily", today: "2026-11-13", nowMs: 0, meta: emptyMeta(), env: {}, dryRun: false, maxCalls: 10 } as unknown as Ctx;

describe("a failed source keeps the last good data", () => {
  it("records the error, keeps lastSuccess and leaves the data file as it was", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "near-src-"));
    const file = path.join(dir, "yields.json");
    fs.writeFileSync(file, JSON.stringify({ asOf: "2026-11-12", pools: [1, 2, 3] }));
    const st = { ...emptySourceStatus(), lastSuccess: "2026-11-12T03:30:00.000Z" };
    // Like every fetcher, it writes only after the upstream call succeeds.
    const failing = { run: async () => { throw new Error("HTTP 404 https://example.test"); } };
    const out = await runSource(failing, ctx, st, () => "2026-11-13T03:30:00.000Z");
    expect(out.kind).toBe("failed");
    expect(st.error).toBe("HTTP 404 https://example.test");
    expect(st.lastSuccess).toBe("2026-11-12T03:30:00.000Z");
    expect(st.lastAttempt).toBe("2026-11-13T03:30:00.000Z");
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({ asOf: "2026-11-12", pools: [1, 2, 3] });
  });
  it("moves lastSuccess only on success, and not for a skipped source", async () => {
    const st = emptySourceStatus();
    expect((await runSource({ run: async () => ({ rows: 3, calls: 1, notes: [] }) }, ctx, st, () => "t1")).kind).toBe("ok");
    expect(st.lastSuccess).toBe("t1");
    expect((await runSource({ run: async () => ({ rows: 0, calls: 0, notes: ["skipped: no key"] }) }, ctx, st, () => "t2")).kind).toBe("skipped");
    expect(st.lastSuccess).toBe("t1");
    expect(st.skipped).toBe("no key");
  });
});
