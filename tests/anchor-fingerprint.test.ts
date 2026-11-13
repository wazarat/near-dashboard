import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  byteOrder,
  computeFingerprints,
  diffEntries,
  fingerprintOf,
  hashFiles,
  isInputPath,
  manifestText,
  normalise,
  parseManifest,
  parseRecord,
  recordJson,
  sha256,
  type AnchorRecord,
} from "../scripts/anchor/fingerprint";

let dir: string;
const files: Record<string, string> = {
  "data/raw/bigquery/daily_chain.csv": "block_date,transactions\n2026-11-12,100\n",
  "data/raw/intents/daily/2026-11-12.json": '{"volume":1}\n',
  "data/history/_meta.json": '{"lastRunDate":"2026-11-13"}\n',
  "data/near-ecosystem-2026-11-08.csv": "name,sector\nRef,DEX\n",
  "THESIS.md": "# Thesis\n",
  "src/data/generated/thesis.json": '{"verdict":{"supported":"partly"}}\n',
};
const inputs = Object.keys(files).filter((p) => p.startsWith("data/"));
const outputs = ["THESIS.md", "src/data/generated/thesis.json"];

function write(rel: string, body: string | Buffer) {
  const f = path.join(dir, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, body);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "anchor-"));
  for (const [p, b] of Object.entries(files)) write(p, b);
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("fingerprints", () => {
  it("are stable across runs", () => {
    const a = computeFingerprints(dir, { inputs, outputs });
    const b = computeFingerprints(dir, { inputs, outputs });
    expect(a.inputsHash).toBe(b.inputsHash);
    expect(a.outputsHash).toBe(b.outputsHash);
    expect(a.inputsHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("do not depend on the order files are listed in", () => {
    const a = computeFingerprints(dir, { inputs, outputs });
    const b = computeFingerprints(dir, { inputs: [...inputs].reverse(), outputs: [...outputs].reverse() });
    expect(b.inputsHash).toBe(a.inputsHash);
    expect(b.outputsHash).toBe(a.outputsHash);
  });

  it("change when any single input byte changes", () => {
    const before = computeFingerprints(dir, { inputs, outputs });
    for (const p of inputs) {
      const orig = fs.readFileSync(path.join(dir, p));
      const flipped = Buffer.from(orig);
      flipped[0] = flipped[0] ^ 1;
      write(p, flipped);
      const after = computeFingerprints(dir, { inputs, outputs });
      expect(after.inputsHash, p).not.toBe(before.inputsHash);
      expect(after.outputsHash).toBe(before.outputsHash);
      write(p, orig);
    }
    expect(computeFingerprints(dir, { inputs, outputs }).inputsHash).toBe(before.inputsHash);
  });

  it("change when a file is renamed, even with the same bytes", () => {
    const before = computeFingerprints(dir, { inputs, outputs }).inputsHash;
    fs.renameSync(path.join(dir, inputs[0]), path.join(dir, "data/raw/bigquery/daily_chain2.csv"));
    const renamed = inputs.map((p, i) => (i === 0 ? "data/raw/bigquery/daily_chain2.csv" : p));
    expect(computeFingerprints(dir, { inputs: renamed, outputs }).inputsHash).not.toBe(before);
  });

  it("treat CRLF and LF checkouts alike", () => {
    const lf = computeFingerprints(dir, { inputs, outputs });
    for (const p of [...inputs, ...outputs]) write(p, files[p].replace(/\n/g, "\r\n"));
    const crlf = computeFingerprints(dir, { inputs, outputs });
    expect(crlf.inputsHash).toBe(lf.inputsHash);
    expect(crlf.outputsHash).toBe(lf.outputsHash);
  });

  it("leave binary files untouched by line-ending normalisation", () => {
    const bin = Buffer.from([0, 13, 10, 65]);
    expect(normalise(bin)).toEqual(bin);
    expect(normalise(Buffer.from("a\r\nb\r\n")).toString()).toBe("a\nb\n");
    expect(normalise(Buffer.from("lone\rcr")).toString()).toBe("lone\rcr");
  });

  it("follow the documented method, so it can be recomputed by hand", () => {
    const entries = hashFiles(dir, inputs);
    const text = entries.map((e) => `${e.path}\t${sha256(fs.readFileSync(path.join(dir, e.path)))}`).join("\n");
    expect(fingerprintOf(entries)).toBe(sha256(text));
  });

  it("sort paths by byte order", () => {
    expect(["b", "B", "a/b", "a-b", "a.b"].sort(byteOrder)).toEqual(["B", "a-b", "a.b", "a/b", "b"]);
  });
});

describe("input selection", () => {
  it("covers the raw data, history, dataset files, queries and the thesis template", () => {
    expect(isInputPath("data/raw/intents/daily/2026-11-12.json")).toBe(true);
    expect(isInputPath("data/history/chain.json")).toBe(true);
    expect(isInputPath("data/near-ecosystem-2026-11-08.csv")).toBe(true);
    expect(isInputPath("data/expected.json")).toBe(true);
    expect(isInputPath("queries/daily_chain.sql")).toBe(true);
    expect(isInputPath("docs/templates/THESIS.template.md")).toBe(true);
  });
  it("leaves out the anchor files and everything else", () => {
    expect(isInputPath("data/anchors/2026-11-13.manifest.txt")).toBe(false);
    expect(isInputPath("data/anchors/index.json")).toBe(false);
    expect(isInputPath("README.md")).toBe(false);
    expect(isInputPath("src/lib/stats.ts")).toBe(false);
  });
});

describe("record and manifest", () => {
  const record: AnchorRecord = { v: 1, date: "2026-11-13", commit: "a".repeat(40), inputs: "b".repeat(64), outputs: "c".repeat(64), verdict: "Partly supported" };

  it("is compact JSON with a fixed key order, well under 1 KB", () => {
    const json = recordJson({ ...record });
    expect(json.startsWith('{"v":1,"date":"2026-11-13","commit":')).toBe(true);
    expect(Buffer.byteLength(json)).toBeLessThan(400);
    expect(parseRecord(json)).toEqual(record);
  });

  it("refuses a record over 1 KB", () => {
    expect(() => recordJson({ ...record, verdict: "x".repeat(1100) })).toThrow(/over 1024/);
  });

  it("round-trips through the manifest and points at the changed file", () => {
    const fp = computeFingerprints(dir, { inputs, outputs });
    const parsed = parseManifest(manifestText(record, fp));
    expect(fingerprintOf(parsed.inputs)).toBe(fp.inputsHash);
    expect(fingerprintOf(parsed.outputs)).toBe(fp.outputsHash);
    write("data/history/_meta.json", '{"lastRunDate":"2026-11-14"}\n');
    const now = computeFingerprints(dir, { inputs, outputs });
    expect(diffEntries(parsed.inputs, now.inputs)).toEqual({ changed: ["data/history/_meta.json"], added: [], removed: [] });
  });
});
