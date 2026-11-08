import { describe, expect, it } from "vitest";
import { createClient, HttpError, UA } from "../scripts/fetch/http";

function fakeFetch(responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: (init?.headers as Record<string, string>) ?? {} });
    const r = responses.shift() ?? { status: 200, body: {} };
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: { "content-type": "application/json", ...r.headers } });
  }) as typeof fetch;
  return { impl, calls };
}

describe("http client", () => {
  it("spaces calls by minInterval and sends the project user agent without an email", async () => {
    let t = 0;
    const sleeps: number[] = [];
    const { impl, calls } = fakeFetch([{ status: 200, body: 1 }, { status: 200, body: 2 }]);
    const c = createClient({ name: "t", minIntervalMs: 5000, fetchImpl: impl, nowImpl: () => t, sleepImpl: async (ms) => { sleeps.push(ms); t += ms; } });
    await c.getJson("https://a/1");
    await c.getJson("https://a/2");
    expect(sleeps).toEqual([5000]);
    expect(calls[0].headers["User-Agent"]).toBe(UA);
    expect(UA).toBe("near-atlas/1.0 (+https://github.com/wazarat/near-dashboard)");
    expect(UA).not.toMatch(/@/);
  });
  it("retries 429 honouring Retry-After and 5xx with backoff, then succeeds", async () => {
    const sleeps: number[] = [];
    const { impl, calls } = fakeFetch([{ status: 429, headers: { "retry-after": "2" } }, { status: 503 }, { status: 200, body: { ok: true } }]);
    const c = createClient({ name: "t", minIntervalMs: 0, fetchImpl: impl, sleepImpl: async (ms) => { sleeps.push(ms); } });
    expect(await c.getJson("https://a/x")).toEqual({ ok: true });
    expect(calls.length).toBe(3);
    expect(sleeps[0]).toBe(2000);
    expect(sleeps[1]).toBeGreaterThanOrEqual(2000);
    expect(c.stats().retries).toBe(2);
  });
  it("does not retry 404 or 400", async () => {
    const { impl, calls } = fakeFetch([{ status: 400, body: { code: "Bad Request" } }]);
    const c = createClient({ name: "t", minIntervalMs: 0, fetchImpl: impl, sleepImpl: async () => {} });
    await expect(c.getJson("https://a/missing")).rejects.toBeInstanceOf(HttpError);
    expect(calls.length).toBe(1);
  });
  it("serves identical GETs from the in-run cache unless noCache", async () => {
    const { impl, calls } = fakeFetch([{ status: 200, body: { v: 1 } }, { status: 200, body: { v: 2 } }]);
    const c = createClient({ name: "t", minIntervalMs: 0, fetchImpl: impl, sleepImpl: async () => {} });
    await c.getJson("https://a/same");
    await c.getJson("https://a/same");
    expect(calls.length).toBe(1);
    expect(c.stats().cacheHits).toBe(1);
    await c.getJson("https://a/same", { noCache: true });
    expect(calls.length).toBe(2);
  });
});
