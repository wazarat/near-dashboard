import path from "node:path";
import { describe, expect, it } from "vitest";
import { listFiles, scan } from "../scripts/check-copy.mjs";

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
