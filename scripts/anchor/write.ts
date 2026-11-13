/**
 * Writes today's evidence fingerprints to NEAR mainnet through SocialDB, signed by a function-call key that
 * can only call `set` on social.near. Reads NEAR_ANCHOR_ACCOUNT_ID and NEAR_ANCHOR_PRIVATE_KEY from the
 * environment (or .env.local) and never prints the key.
 *
 *   npm run anchor:write -- [--date YYYY-MM-DD] [--dry-run] [--soft]
 *
 * --dry-run  prints the record, signer and cost without sending anything
 * --soft     for the daily Action: a missing secret or a failed write is recorded under `anchor` in
 *            data/history/_meta.json and the script exits 0, so the site never breaks over the anchor
 *
 * A record that already exists for the date is left alone, so reruns never write twice.
 */
import fs from "node:fs";
import path from "node:path";
import type { AnchorIndexEntry, AnchorStatus, HistoryMeta } from "../../src/lib/history-types";
import { ROOT } from "../lib/paths";
import { readJson, writeJsonStable } from "../lib/store";
import { ANCHOR_DIR, argValue, buildRecord, dirtyInputs, manifestPath, manifestText, parseRecord, recordJson, utcDate, type AnchorRecord, type Fingerprints } from "./fingerprint";
import {
  LOW_BALANCE_YOCTO,
  SOCIAL_DB,
  loadEnvLocal,
  nearblocksTxUrl,
  readAnchor,
  rpcUrls,
  socialPath,
  socialStorageAvailable,
  viewAccessKey,
  yoctoToNear,
} from "./near";

/** Gas attached to `set`. A function-call key's allowance is charged for all of it, so it is kept small. */
export const SET_GAS = BigInt(30) * BigInt(10) ** BigInt(12);
const GAS_PRICE_YOCTO = BigInt(10) ** BigInt(8); // NEAR's minimum gas price, per gas unit

export function setArgs(account: string, date: string, json: string) {
  return { data: { [account]: { "canhav-atlas": { anchors: { [date]: json } } } } };
}

function indexFile() {
  return path.join(ROOT, ANCHOR_DIR, "index.json");
}

export function writeIndex(date: string, entry: AnchorIndexEntry) {
  const idx = readJson<Record<string, AnchorIndexEntry>>(indexFile(), {});
  idx[date] = entry;
  writeJsonStable(indexFile(), idx);
}

function writeManifest(record: AnchorRecord, fp: Fingerprints) {
  const file = path.join(ROOT, manifestPath(record.date));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, manifestText(record, fp));
}

function recordStatus(status: AnchorStatus) {
  const file = path.join(ROOT, "data/history/_meta.json");
  const meta = readJson<HistoryMeta | null>(file, null);
  if (!meta) return;
  meta.anchor = status;
  writeJsonStable(file, meta);
}

function warn(msg: string) {
  console.warn(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `warning, ${msg}`);
}

type Balances = { storage: bigint | null; allowance: bigint | null; publicKey: string | null; permission: string };

async function balances(account: string, privateKey: string | undefined): Promise<Balances> {
  const storage = await socialStorageAvailable(account).catch(() => null);
  if (!privateKey) return { storage, allowance: null, publicKey: null, permission: "no key" };
  const { KeyPair } = await import("near-api-js");
  const publicKey = KeyPair.fromString(privateKey as `ed25519:${string}`).getPublicKey().toString();
  const key = await viewAccessKey(account, publicKey).catch(() => null);
  if (!key) return { storage, allowance: null, publicKey, permission: "not on the account" };
  if (key.permission === "FullAccess") return { storage, allowance: null, publicKey, permission: "FullAccess" };
  const fc = key.permission.FunctionCall;
  const ok = fc.receiver_id === SOCIAL_DB && fc.method_names.length === 1 && fc.method_names[0] === "set";
  return { storage, allowance: fc.allowance === null ? null : BigInt(fc.allowance), publicKey, permission: ok ? "FunctionCall social.near set" : `FunctionCall ${fc.receiver_id} ${fc.method_names.join(",")}` };
}

function lowWarning(b: Balances): string | null {
  const parts: string[] = [];
  if (b.storage !== null && b.storage < LOW_BALANCE_YOCTO) parts.push(`SocialDB storage is ${yoctoToNear(b.storage)} NEAR`);
  if (b.allowance !== null && b.allowance < LOW_BALANCE_YOCTO) parts.push(`key allowance is ${yoctoToNear(b.allowance)} NEAR`);
  return parts.length ? `${parts.join(" and ")}, top up below 0.05 NEAR` : null;
}

async function send(account: string, privateKey: string, date: string, json: string): Promise<string> {
  const { Account, JsonRpcProvider } = await import("near-api-js");
  const provider = new JsonRpcProvider({ url: rpcUrls()[0] });
  const signer = new Account(account, provider, privateKey as `ed25519:${string}`);
  const res = await signer.callFunctionRaw({ contractId: SOCIAL_DB, methodName: "set", args: setArgs(account, date, json), gas: SET_GAS, deposit: BigInt(0) });
  const status = res.status as unknown as Record<string, unknown> | string;
  if (status && typeof status === "object" && "Failure" in status) throw new Error(`set failed onchain ${JSON.stringify(status.Failure)}`);
  return res.transaction.hash;
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const soft = argv.includes("--soft");
  const date = argValue(argv, "--date") ?? utcDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`bad --date ${date}`);
  loadEnvLocal(ROOT);
  const account = process.env.NEAR_ANCHOR_ACCOUNT_ID?.trim();
  const privateKey = process.env.NEAR_ANCHOR_PRIVATE_KEY?.trim() || undefined;

  const base: AnchorStatus = { date, status: "skipped", reason: null, txHash: null, storageNear: null, allowanceNear: null, warning: null };
  const finish = (s: AnchorStatus, code: number) => {
    if (soft) recordStatus(s);
    if (code && !soft) process.exit(code);
  };

  const { record, fp } = buildRecord(ROOT, date);
  const json = recordJson(record);
  const dirty = dirtyInputs(ROOT);
  if (dirty.length && !dryRun) {
    console.error(`refusing to anchor, ${dirty.length} input files are not committed, first ${dirty[0]}`);
    return finish({ ...base, status: "failed", reason: "inputs not committed" }, 1);
  }
  if (!account) {
    console.error("NEAR_ANCHOR_ACCOUNT_ID is not set, nothing written");
    return finish({ ...base, reason: "NEAR_ANCHOR_ACCOUNT_ID not set" }, dryRun ? 0 : 1);
  }

  try {
    const b = await balances(account, privateKey);
    const status: AnchorStatus = { ...base, storageNear: b.storage === null ? null : yoctoToNear(b.storage), allowanceNear: b.allowance === null ? null : yoctoToNear(b.allowance) };
    status.warning = lowWarning(b);
    if (status.warning) warn(status.warning);

    const existing = await readAnchor(account, date);
    if (existing) {
      const same = existing.value === json;
      console.log(`already anchored for ${date} at block ${existing.blockHeight}${same ? ", same record" : ", record differs from today's fingerprints"}`);
      if (!same) {
        const onchain = parseRecord(existing.value);
        console.log(`onchain  ${existing.value}`);
        console.log(`local    ${json}`);
        if (onchain.commit !== record.commit) console.log("the onchain record is for another commit, verify it with that commit checked out");
      } else writeManifest(record, fp);
      return finish({ ...status, status: "exists" }, 0);
    }

    const maxGasCost = SET_GAS * GAS_PRICE_YOCTO;
    const storageCost = BigInt(Buffer.byteLength(socialPath(account, date)) + Buffer.byteLength(json) + 40) * BigInt(10) ** BigInt(19);
    if (dryRun) {
      console.log("dry run, nothing sent");
      console.log(`signer    ${account} (key ${b.publicKey ?? "not set"}, ${b.permission})`);
      console.log(`call      ${SOCIAL_DB} set, ${SET_GAS / BigInt(10) ** BigInt(12)} Tgas, 0 NEAR attached`);
      console.log(`key path  ${socialPath(account, date)}`);
      console.log(`record    ${json} (${Buffer.byteLength(json)} bytes)`);
      console.log(`cost      about ${yoctoToNear(storageCost)} NEAR of prepaid SocialDB storage, at most ${yoctoToNear(maxGasCost)} NEAR of gas from the key allowance`);
      console.log(`storage   ${status.storageNear === null ? "no SocialDB deposit yet" : `${status.storageNear} NEAR left`}, allowance ${status.allowanceNear === null ? "unknown" : `${status.allowanceNear} NEAR left`}`);
      return;
    }

    if (!privateKey) {
      console.error("NEAR_ANCHOR_PRIVATE_KEY is not set, nothing written");
      return finish({ ...status, reason: "NEAR_ANCHOR_PRIVATE_KEY not set" }, 1);
    }
    if (b.permission !== "FunctionCall social.near set") {
      console.error(`the anchor key must be a function-call key for social.near set only, this one is ${b.permission}`);
      return finish({ ...status, status: "failed", reason: `key is ${b.permission}` }, 1);
    }
    if (b.storage === null || b.storage < storageCost) {
      console.error("not enough SocialDB storage for the record, make a storage_deposit first");
      return finish({ ...status, status: "failed", reason: "SocialDB storage too low" }, 1);
    }

    let txHash: string;
    try {
      txHash = await send(account, privateKey, date, json);
    } catch (e) {
      // One retry on a network error, after checking the first attempt did not land.
      if (await readAnchor(account, date).catch(() => null)) throw new Error(`the record landed but the response was lost (${(e as Error).message}), find the transaction on NearBlocks`);
      console.warn(`first attempt failed (${(e as Error).message}), retrying once`);
      txHash = await send(account, privateKey, date, json);
    }
    console.log(`sent     ${txHash}`);
    console.log(`explorer ${nearblocksTxUrl(txHash)}`);

    const landed = await readAnchor(account, date);
    if (!landed || landed.value !== json) throw new Error("the transaction succeeded but the record does not read back");
    writeManifest(record, fp);
    writeIndex(date, { commit: record.commit, inputs: record.inputs, outputs: record.outputs, verdict: record.verdict, account, txHash, blockHeight: landed.blockHeight });
    const after = await balances(account, privateKey);
    finish({ ...status, status: "written", txHash, storageNear: after.storage === null ? null : yoctoToNear(after.storage), allowanceNear: after.allowance === null ? null : yoctoToNear(after.allowance), warning: lowWarning(after) }, 0);
  } catch (e) {
    const raw = (e as Error).message ?? String(e);
    const msg = privateKey ? raw.split(privateKey).join("[key]") : raw;
    console.error(`anchor failed, ${msg}`);
    finish({ ...base, status: "failed", reason: msg.slice(0, 200) }, 1);
  }
}

if (require.main === module) main();
