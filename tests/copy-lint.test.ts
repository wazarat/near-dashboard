import path from "node:path";
import { describe, expect, it } from "vitest";
import { listFiles, scan, scanSource } from "../scripts/check-copy.mjs";

const fixture = (name: string) => path.join("tests", "fixtures", "copy", name);

describe("check:copy", () => {
  it("passes clean copy, URLs, times, Tailwind classes and copy-ok lines", () => {
    expect(scan([fixture("clean.tsx")])).toEqual([]);
  });

  it("reports every em dash and colon in string literals, template chunks and JSX text", () => {
    const hits = scan([fixture("dirty.tsx")]);
    const tags = hits.map((h: { line: number; tag: string }) => `${h.line}:${h.tag}`);
    expect(tags).toEqual(["2:em", "3:colon", "4:colon", "7:colon", "7:colon"]);
  });

  it("scans the src tree and finds no hits", () => {
    const files = listFiles(["src"]);
    expect(files.length).toBeGreaterThan(50);
    expect(scan(files)).toEqual([]);
  });
});

const tags = (code: string, file = "x.tsx") => scanSource(code, file).map((h: { tag: string }) => h.tag);

describe("tone rule", () => {
  it("allows only the two text tones", () => {
    expect(tags('const a = "text-ink-50 font-medium"; const b = "text-xs text-ink-300";')).toEqual([]);
  });
  it("flags other ink steps, muted-foreground and hover variants", () => {
    expect(tags('const a = "text-ink-500";')).toEqual(["tone"]);
    expect(tags('const a = "text-xs text-ink-400";')).toEqual(["tone"]);
    expect(tags('const a = "text-muted-foreground";')).toEqual(["tone"]);
    expect(tags('const a = "text-ink-300 hover:text-ink-200";')).toEqual(["tone"]);
  });
  it("flags dimmed text but not disabled controls or non-text colours", () => {
    expect(tags('const a = "text-ink-300/70";')).toEqual(["tone"]);
    expect(tags('const a = "opacity-60 text-ink-300";')).toEqual(["tone"]);
    expect(tags('const a = "text-ink-300 disabled:opacity-50";')).toEqual([]);
    expect(tags('const a = "bg-ink-500 border-ink-400 decoration-ink-500";')).toEqual([]);
  });
});
