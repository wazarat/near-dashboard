/**
 * Deterministic fingerprints of the Atlas evidence, for the onchain anchor.
 *
 *   inputs   every committed file the rebuild reads (data/raw, data/history, the dataset files in data/,
 *            queries/*.sql and the THESIS.md template)
 *   outputs  what `npm run rebuild` writes and the site shows (THESIS.md and src/data/generated/*.json),
 *            except meta.json (it holds the age of the last run, so it changes with the calendar) and
 *            anchor.json (it describes the anchor itself)
 *
 * Method, so anyone can recompute it without this script: take the paths, sort them by byte order,
 * hash each file's bytes with SHA-256 after turning CRLF into LF (files with a NUL byte are hashed as is),
 * write one `path<TAB>sha256` line per file, join the lines with "\n" (no trailing newline) and hash that
 * text with SHA-256.
 *
 *   npm run anchor:fingerprint -- [--date YYYY-MM-DD] [--write]
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { VERDICT_LABEL, type Supported } from "../../src/lib/verdict";
import { ROOT } from "../lib/paths";

export const ANCHOR_DIR = "data/anchors";
export const RECORD_VERSION = 1;
export const MAX_RECORD_BYTES = 1024;

/** Outputs left out of the fingerprint, with the reason printed in every manifest. */
export const OUTPUT_EXCLUDED: Record<string, string> = {
  "src/data/generated/meta.json": "holds the age of the last run, so it changes with the calendar",
  "src/data/generated/anchor.json": "describes the anchor itself",
};

/** Which committed paths count as evidence the rebuild reads. */
export function isInputPath(p: string): boolean {
  if (p.startsWith(`${ANCHOR_DIR}/`)) return false;
  if (p.startsWith("data/raw/") || p.startsWith("data/history/")) return true;
  if (/^data\/[^/]+\.(csv|md|json)$/.test(p)) return true;
  if (/^queries\/[^/]+\.sql$/.test(p)) return true;
  return p === "docs/templates/THESIS.template.md";
}

export function byteOrder(a: string, b: string): number {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return Buffer.compare(x, y);
}

/** CRLF to LF for text files, so Windows and macOS clones hash alike. A NUL byte marks a binary file. */
export function normalise(buf: Buffer): Buffer {
  if (buf.includes(0)) return buf;
  if (!buf.includes(13)) return buf;
  return Buffer.from(buf.toString("latin1").replace(/\r\n/g, "\n"), "latin1");
}

export function sha256(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export type Entry = { path: string; sha256: string };

/** Hashes each file under `root`; paths use forward slashes and come back in byte order. */
export function hashFiles(root: string, paths: string[]): Entry[] {
  const unique = [...new Set(paths.map((p) => p.split(path.sep).join("/")))].sort(byteOrder);
  return unique.map((p) => ({ path: p, sha256: sha256(normalise(fs.readFileSync(path.join(root, p)))) }));
}

export function manifestLines(entries: Entry[]): string {
  return [...entries].sort((a, b) => byteOrder(a.path, b.path)).map((e) => `${e.path}\t${e.sha256}`).join("\n");
}

export function fingerprintOf(entries: Entry[]): string {
  return sha256(manifestLines(entries));
}

function walk(root: string, dir: string): string[] {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  for (const d of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${d.name}`;
    if (d.isDirectory()) out.push(...walk(root, rel));
    else if (d.isFile()) out.push(rel);
  }
  return out;
}

/** Inputs are the committed files only, read through git so stray local files never count. */
export function listInputs(root: string): string[] {
  const out = execFileSync("git", ["ls-files", "-z", "--", "data", "queries", "docs/templates"], { cwd: root, encoding: "utf8" });
  return out.split("\0").filter((p) => p && isInputPath(p) && fs.existsSync(path.join(root, p)));
}

/** Outputs are whatever the rebuild left on disk, minus the excluded files. */
export function listOutputs(root: string): string[] {
  const files = walk(root, "src/data/generated").filter((p) => !(p in OUTPUT_EXCLUDED));
  if (fs.existsSync(path.join(root, "THESIS.md"))) files.push("THESIS.md");
  return files;
}

export type Fingerprints = { inputs: Entry[]; outputs: Entry[]; inputsHash: string; outputsHash: string };

export function computeFingerprints(root: string, lists = { inputs: listInputs(root), outputs: listOutputs(root) }): Fingerprints {
  const inputs = hashFiles(root, lists.inputs);
  const outputs = hashFiles(root, lists.outputs);
  return { inputs, outputs, inputsHash: fingerprintOf(inputs), outputsHash: fingerprintOf(outputs) };
}

export type AnchorRecord = { v: number; date: string; commit: string; inputs: string; outputs: string; verdict: string };

/** The compact JSON written onchain. Key order is fixed so the same record always has the same bytes. */
export function recordJson(r: AnchorRecord): string {
  const json = JSON.stringify({ v: r.v, date: r.date, commit: r.commit, inputs: r.inputs, outputs: r.outputs, verdict: r.verdict });
  if (Buffer.byteLength(json) > MAX_RECORD_BYTES) throw new Error(`anchor record is ${Buffer.byteLength(json)} bytes, over ${MAX_RECORD_BYTES}`);
  return json;
}

export function parseRecord(text: string): AnchorRecord {
  const r = JSON.parse(text) as AnchorRecord;
  for (const k of ["date", "commit", "inputs", "outputs", "verdict"] as const) {
    if (typeof r[k] !== "string") throw new Error(`anchor record is missing ${k}`);
  }
  return r;
}

export function readVerdict(root: string): string {
  const file = path.join(root, "src/data/generated/thesis.json");
  if (!fs.existsSync(file)) return "Unavailable";
  const t = JSON.parse(fs.readFileSync(file, "utf8")) as { available?: boolean; verdict?: { supported?: Supported } };
  const s = t.verdict?.supported;
  return s && s in VERDICT_LABEL ? VERDICT_LABEL[s] : "Unavailable";
}

export function gitHead(root: string): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
}

/** Committed inputs that differ from the working tree; an anchor must never cover uncommitted evidence. */
export function dirtyInputs(root: string): string[] {
  const out = execFileSync("git", ["status", "--porcelain", "-z", "--", "data", "queries", "docs/templates"], { cwd: root, encoding: "utf8" });
  return out.split("\0").filter(Boolean).map((l) => l.slice(3)).filter(isInputPath);
}

export function utcDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function manifestText(record: AnchorRecord, fp: Fingerprints): string {
  const head = [
    "# NEAR Atlas evidence manifest",
    `# date ${record.date}`,
    `# commit ${record.commit}`,
    `# inputs ${fp.inputsHash} (${fp.inputs.length} files)`,
    `# outputs ${fp.outputsHash} (${fp.outputs.length} files)`,
    ...Object.entries(OUTPUT_EXCLUDED).map(([p, why]) => `# outputs leave out ${p}, which ${why}`),
    "# each fingerprint is sha256 of its section's lines joined by a newline, with no trailing newline",
  ];
  return [...head, "[inputs]", manifestLines(fp.inputs), "[outputs]", manifestLines(fp.outputs), ""].join("\n");
}

export function parseManifest(text: string): { inputs: Entry[]; outputs: Entry[] } {
  const res: { inputs: Entry[]; outputs: Entry[] } = { inputs: [], outputs: [] };
  let section: "inputs" | "outputs" | null = null;
  for (const line of text.split("\n")) {
    if (line === "[inputs]" || line === "[outputs]") section = line.slice(1, -1) as "inputs" | "outputs";
    else if (section && line.includes("\t")) {
      const [p, h] = line.split("\t");
      res[section].push({ path: p, sha256: h });
    }
  }
  return res;
}

export type ManifestDiff = { changed: string[]; added: string[]; removed: string[] };

/** Which files differ between the anchored manifest and the working tree. */
export function diffEntries(anchored: Entry[], current: Entry[]): ManifestDiff {
  const a = new Map(anchored.map((e) => [e.path, e.sha256]));
  const c = new Map(current.map((e) => [e.path, e.sha256]));
  return {
    changed: [...a.keys()].filter((p) => c.has(p) && c.get(p) !== a.get(p)),
    removed: [...a.keys()].filter((p) => !c.has(p)),
    added: [...c.keys()].filter((p) => !a.has(p)),
  };
}

export function manifestPath(date: string): string {
  return `${ANCHOR_DIR}/${date}.manifest.txt`;
}

/** Builds today's record and fingerprints from the working tree. */
export function buildRecord(root: string, date: string): { record: AnchorRecord; fp: Fingerprints } {
  const fp = computeFingerprints(root);
  const record: AnchorRecord = { v: RECORD_VERSION, date, commit: gitHead(root), inputs: fp.inputsHash, outputs: fp.outputsHash, verdict: readVerdict(root) };
  return { record, fp };
}

export function argValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

function main() {
  const argv = process.argv.slice(2);
  const date = argValue(argv, "--date") ?? utcDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`bad --date ${date}`);
  const { record, fp } = buildRecord(ROOT, date);
  const dirty = dirtyInputs(ROOT);
  if (dirty.length) console.warn(`warning, ${dirty.length} input files differ from the commit, first ${dirty[0]}`);
  console.log(`inputs   ${fp.inputsHash}  (${fp.inputs.length} files)`);
  console.log(`outputs  ${fp.outputsHash}  (${fp.outputs.length} files)`);
  console.log(`record   ${recordJson(record)}`);
  if (argv.includes("--write")) {
    const file = path.join(ROOT, manifestPath(date));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, manifestText(record, fp));
    console.log(`manifest ${manifestPath(date)}`);
  }
}

if (require.main === module) main();
