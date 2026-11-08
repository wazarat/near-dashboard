import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import type { RawRow } from "../../src/lib/parse";
import { DATA } from "./paths";

/** Newest dated file matching prefix*ext in data/. */
export function findFile(prefix: string, ext: string, dir: string = DATA): string {
  const matches = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(ext))
    .sort();
  if (matches.length === 0) throw new Error(`No file matching ${prefix}*${ext} in ${dir}`);
  return path.join(dir, matches[matches.length - 1]);
}

export function findFileOrNull(prefix: string, ext: string, dir: string = DATA): string | null {
  try {
    return findFile(prefix, ext, dir);
  } catch {
    return null;
  }
}

export function parseCsv(text: string, label = "csv"): RawRow[] {
  const parsed = Papa.parse<RawRow>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transform: (v) => (typeof v === "string" ? v.trim() : v),
  });
  if (parsed.errors.length) {
    const first = parsed.errors[0];
    throw new Error(`${label}: ${first.message} (row ${first.row})`);
  }
  return parsed.data;
}

export function readCsv(file: string): RawRow[] {
  return parseCsv(fs.readFileSync(file, "utf8"), path.basename(file));
}

export function readCsvOrEmpty(file: string): RawRow[] {
  return fs.existsSync(file) ? readCsv(file) : [];
}

export function toCsv(rows: Record<string, string | number | null | undefined>[], columns: string[]): string {
  return Papa.unparse({ fields: columns, data: rows.map((r) => columns.map((c) => r[c] ?? "")) }, { newline: "\n" }) + "\n";
}

/** Writes only when the content changed; returns true when it did. */
export function writeCsv(file: string, rows: Record<string, string | number | null | undefined>[], columns: string[]): boolean {
  const next = toCsv(rows, columns);
  const prev = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (prev === next) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
  return true;
}

export function dateFromName(file: string): string | null {
  const m = path.basename(file).match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
