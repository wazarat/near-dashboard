/**
 * Free, keyless reads from NEAR mainnet for the anchor: SocialDB records, storage balance, access keys and
 * transactions. Plain JSON-RPC over fetch, so verifying needs no NEAR library and no key.
 */
import fs from "node:fs";
import path from "node:path";

export const SOCIAL_DB = "social.near";
export const APP_KEY = "canhav-atlas";
export const DEFAULT_RPC = "https://rpc.mainnet.near.org";
/** Tried after the default when it fails, so one provider being down does not stop a run. */
export const FALLBACK_RPC = "https://free.rpc.fastnear.com";
export const YOCTO_PER_NEAR = BigInt(10) ** BigInt(24);
export const LOW_BALANCE_YOCTO = BigInt(5) * BigInt(10) ** BigInt(22); // 0.05 NEAR

export function rpcUrls(env: NodeJS.ProcessEnv = process.env): string[] {
  const first = env.NEAR_RPC_URL?.trim() || DEFAULT_RPC;
  return first === FALLBACK_RPC ? [first] : [first, FALLBACK_RPC];
}

export function socialPath(account: string, date: string): string {
  return `${account}/${APP_KEY}/anchors/${date}`;
}

export function nearblocksTxUrl(hash: string): string {
  return `https://nearblocks.io/txns/${hash}`;
}

export function yoctoToNear(y: bigint, digits = 4): string {
  const neg = y < BigInt(0);
  const a = neg ? -y : y;
  const whole = a / YOCTO_PER_NEAR;
  const frac = (a % YOCTO_PER_NEAR).toString().padStart(24, "0").slice(0, digits);
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

export class RpcError extends Error {
  constructor(message: string, readonly data?: unknown) {
    super(message);
  }
}

/** One JSON-RPC call. A network failure or 5xx/429 is retried once on the next provider; an RPC error is not. */
export async function rpc<T>(method: string, params: unknown, urls = rpcUrls()): Promise<T> {
  let lastErr: unknown;
  const attempts = urls.length > 1 ? urls : [urls[0], urls[0]];
  for (const url of attempts.slice(0, 2)) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "atlas", method, params }),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status >= 500 || res.status === 429) throw new Error(`${url} answered ${res.status}`);
      const body = (await res.json()) as { result?: T; error?: { message?: string; data?: unknown; cause?: { name?: string } } };
      if (body.error) throw new RpcError(body.error.cause?.name ?? body.error.message ?? "RPC error", body.error.data);
      return body.result as T;
    } catch (e) {
      if (e instanceof RpcError) throw e;
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function viewCall<T>(contract: string, method: string, args: unknown, urls?: string[]): Promise<T> {
  const r = await rpc<{ result: number[] }>(
    "query",
    { request_type: "call_function", finality: "final", account_id: contract, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") },
    urls,
  );
  return JSON.parse(Buffer.from(r.result).toString("utf8")) as T;
}

export type OnchainAnchor = { value: string; blockHeight: number };

/** Reads one anchor record from SocialDB with the block height of its last write. */
export async function readAnchor(account: string, date: string, urls?: string[]): Promise<OnchainAnchor | null> {
  const tree = await viewCall<Record<string, unknown>>(SOCIAL_DB, "get", { keys: [socialPath(account, date)], options: { with_block_height: true } }, urls);
  let node: unknown = tree;
  for (const k of [account, APP_KEY, "anchors", date]) {
    if (!node || typeof node !== "object") return null;
    node = (node as Record<string, unknown>)[k];
  }
  if (!node || typeof node !== "object") return null;
  const leaf = node as { "": unknown; ":block": unknown };
  if (typeof leaf[""] !== "string" || typeof leaf[":block"] !== "number") return null;
  return { value: leaf[""], blockHeight: leaf[":block"] };
}

/** Storage left on SocialDB for the account, in yoctoNEAR, or null when it never deposited. */
export async function socialStorageAvailable(account: string, urls?: string[]): Promise<bigint | null> {
  const r = await viewCall<{ total: string; available: string } | null>(SOCIAL_DB, "storage_balance_of", { account_id: account }, urls);
  return r ? BigInt(r.available) : null;
}

export type AccessKeyPermission = "FullAccess" | { FunctionCall: { allowance: string | null; receiver_id: string; method_names: string[] } };

export async function viewAccessKey(account: string, publicKey: string, urls?: string[]): Promise<{ permission: AccessKeyPermission } | null> {
  try {
    return await rpc<{ permission: AccessKeyPermission }>("query", { request_type: "view_access_key", finality: "final", account_id: account, public_key: publicKey }, urls);
  } catch (e) {
    if (e instanceof RpcError && /UNKNOWN_ACCESS_KEY|does not exist/i.test(`${e.message} ${JSON.stringify(e.data ?? "")}`)) return null;
    throw e;
  }
}

/** Finds the record a SocialDB `set` transaction wrote, from the transaction itself. Needs an archival node for old ones. */
export async function recordFromTx(hash: string, sender: string, account: string, date: string, urls?: string[]): Promise<string | null> {
  const tx = await rpc<{ transaction: { actions: unknown[] } }>("tx", { tx_hash: hash, sender_account_id: sender, wait_until: "NONE" }, urls);
  for (const a of tx.transaction.actions) {
    const fc = (a as { FunctionCall?: { method_name: string; args: string } }).FunctionCall;
    if (!fc || fc.method_name !== "set") continue;
    const args = JSON.parse(Buffer.from(fc.args, "base64").toString("utf8")) as { data?: Record<string, Record<string, { anchors?: Record<string, string> }>> };
    const v = args.data?.[account]?.[APP_KEY]?.anchors?.[date];
    if (typeof v === "string") return v;
  }
  return null;
}

/** The same .env.local reader scripts/refresh.ts uses, kept here so the anchor scripts do not load every fetcher. */
export function loadEnvLocal(root: string): void {
  const file = path.join(root, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined && m[2] !== "") process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
