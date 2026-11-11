#!/usr/bin/env node
/**
 * Copy rule checker (CanHav Atlas UI standard, section 2). User-facing
 * strings under src/ carry no em dashes and no colons. Run with
 *
 *   npm run check:copy
 *
 * The scan walks every .ts and .tsx file under src/ through the TypeScript
 * compiler API and looks only at string literals, template literal chunks
 * and JSX text, so comments never count. A colon is a hit when whitespace
 * follows it or when it ends a final chunk (a template head or middle
 * ending in a colon is a code join such as a Map key). Tailwind classes
 * ("md:flex"), times ("12:30") and URLs ("https://") never put whitespace
 * after a colon, so they need no allowlist. A line containing "copy-ok"
 * is skipped, for strings that are not copy (SQL, regular expressions).
 *
 * Tone rule (docs/ATLAS-UI.md, section 1, Text): text uses two tones only,
 * text-ink-50 for names, headings, values and body copy and text-ink-300 for
 * labels and meta. Any other text-ink-* step, text-muted-foreground, or an
 * opacity utility on a class string that sets a text tone is a "tone" hit.
 * Disabled controls use disabled:opacity-* and are exempt.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOTS = ["src"];
/** Paths whose strings are not platform copy, each with the reason. */
const SKIP = new Map([["src/data/generated", "built data, never hand written"]]);
const SCHEME_RE = /^(https?|mailto|data|ipfs|tel):$/;
const ESCAPE = "copy-ok";
const EM_DASH = "—";
/** Text colour classes other than the two allowed tones (variant prefixes like hover: included). */
const OFF_TONE = /(?:^|[\s"'`])(?:[\w-]+:)*text-(?:ink-(?!50\b|300\b)\d+|muted-foreground)\b/;
/** Dimming text with opacity, other than for disabled states. */
const DIM_TEXT = /(?:^|\s)(?:[\w-]+:)*text-ink-(?:50|300)\/\d+\b|(?:^|\s)(?!disabled:)(?:[\w-]+:)*opacity-\d+\b(?=.*\btext-ink-)/;

const K = ts.SyntaxKind;
const FINAL = new Set([K.StringLiteral, K.NoSubstitutionTemplateLiteral, K.TemplateTail, K.JsxText]);
const CHUNK = new Set([...FINAL, K.TemplateHead, K.TemplateMiddle]);

function skipped(file) {
  for (const prefix of SKIP.keys()) if (file === prefix || file.startsWith(prefix + "/")) return true;
  return false;
}

export function listFiles(roots = ROOTS) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (skipped(full)) continue;
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) out.push(full);
    }
  };
  for (const r of roots) walk(r);
  return out;
}

/** Scan one source text. Returns every hit with its 1-based line and column. */
export function scanSource(text, file) {
  const hits = [];
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const lines = text.split("\n");
  const check = (node) => {
    const raw = node.text;
    const { line, character } = src.getLineAndCharacterOfPosition(node.getStart(src));
    if (lines[line].includes(ESCAPE)) return;
    if (node.kind === K.JsxText && !raw.trim()) return;
    if (SCHEME_RE.test(raw)) return;
    const problems = [];
    if (raw.includes(EM_DASH)) problems.push("em");
    if (/:\s/.test(raw) || (FINAL.has(node.kind) && /:$/.test(raw.trimEnd()))) problems.push("colon");
    if (OFF_TONE.test(raw) || DIM_TEXT.test(raw)) problems.push("tone");
    if (problems.length === 0) return;
    const snippet = raw.replace(/\s+/g, " ").trim().slice(0, 90);
    hits.push({ file, line: line + 1, col: character + 1, tag: problems.join("+"), snippet });
  };
  const visit = (node) => {
    if (CHUNK.has(node.kind)) check(node);
    ts.forEachChild(node, visit);
  };
  visit(src);
  return hits;
}

/** Scan the given files and return every hit, sorted by file, line and column. */
export function scan(files) {
  const hits = files.flatMap((file) => scanSource(fs.readFileSync(file, "utf8"), file));
  hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col);
  return hits;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const files = args.length ? args : listFiles();
  const hits = scan(files);
  for (const h of hits) console.log(`${h.file}:${h.line}:${h.col}  [${h.tag}]  ${h.snippet}`);
  const n = new Set(hits.map((h) => h.file)).size;
  console.log(`${hits.length} hit${hits.length === 1 ? "" : "s"} in ${n} file${n === 1 ? "" : "s"}`);
  process.exitCode = hits.length ? 1 : 0;
}
