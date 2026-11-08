/**
 * Polite HTTP client for free APIs: per-host spacing, retry with backoff on
 * 429/5xx (honouring Retry-After), in-run GET cache, descriptive User-Agent.
 * No personal data is ever sent.
 */
export const UA = "near-atlas/1.0 (+https://github.com/wazarat/near-dashboard)";

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
    public body: string,
  ) {
    super(`HTTP ${status} ${url}${body ? `: ${body.slice(0, 160)}` : ""}`);
  }
}

export interface ClientOpts {
  name: string;
  minIntervalMs: number;
  maxRetries?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  nowImpl?: () => number;
}

export interface ClientStats {
  calls: number;
  retries: number;
  cacheHits: number;
  ms: number;
}

export interface HttpClient {
  getJson<T>(url: string, init?: { headers?: Record<string, string>; noCache?: boolean }): Promise<T>;
  getText(url: string): Promise<string>;
  stats(): ClientStats;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createClient(opts: ClientOpts): HttpClient {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleepImpl ?? realSleep;
  const now = opts.nowImpl ?? Date.now;
  const maxRetries = opts.maxRetries ?? 5;
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const stats: ClientStats = { calls: 0, retries: 0, cacheHits: 0, ms: 0 };
  const cache = new Map<string, Promise<unknown>>();
  let chain: Promise<void> = Promise.resolve();
  let lastStart = Number.NEGATIVE_INFINITY;

  function schedule<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const wait = lastStart + opts.minIntervalMs - now();
      if (wait > 0) await sleep(wait);
      lastStart = now();
    });
    chain = run.catch(() => undefined);
    return run.then(fn);
  }

  async function request(url: string, init: RequestInit): Promise<Response> {
    const started = now();
    let attempt = 0;
    for (;;) {
      stats.calls += 1;
      let res: Response | null = null;
      let netErr: unknown = null;
      try {
        res = await fetchImpl(url, {
          ...init,
          headers: { "User-Agent": UA, Accept: "application/json", ...opts.headers, ...(init.headers as Record<string, string>) },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        netErr = e;
      }
      if (res && res.ok) {
        stats.ms += now() - started;
        return res;
      }
      const status = res?.status ?? 0;
      const retryable = netErr !== null || status === 429 || status >= 500;
      if (!retryable || attempt >= maxRetries) {
        stats.ms += now() - started;
        if (res) throw new HttpError(status, url, await res.text().catch(() => ""));
        throw netErr instanceof Error ? netErr : new Error(String(netErr));
      }
      const retryAfter = Number(res?.headers.get("retry-after"));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt + Math.floor(Math.random() * 500);
      stats.retries += 1;
      attempt += 1;
      await sleep(Math.min(backoff, 60_000));
      // Rate-limited: respect the per-host spacing again before the retry.
      lastStart = now();
    }
  }

  return {
    getJson<T>(url: string, init?: { headers?: Record<string, string>; noCache?: boolean }): Promise<T> {
      if (!init?.noCache && cache.has(url)) {
        stats.cacheHits += 1;
        return cache.get(url) as Promise<T>;
      }
      const p = schedule(async () => {
        const res = await request(url, { method: "GET", headers: init?.headers });
        return (await res.json()) as T;
      });
      if (!init?.noCache) cache.set(url, p);
      return p;
    },
    getText(url: string): Promise<string> {
      return schedule(async () => {
        const res = await request(url, { method: "GET", headers: { Accept: "*/*" } });
        return res.text();
      });
    },
    stats: () => ({ ...stats }),
  };
}
