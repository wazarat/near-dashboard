/**
 * Compares Tally form submissions with the current research rows. Prints only; never writes.
 *
 *   npm run review                     # every CSV under data/submissions/
 *   npm run review -- --file path.csv  # one export
 *
 * Export each Tally form as CSV into data/submissions/ (submit-*.csv, correct-*.csv). The header
 * names below are Tally's question titles; TALLY_FIELDS maps them to CSV columns.
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeName, toProject, type RawRow } from "../src/lib/parse";
import type { Project } from "../src/lib/types";
import { findFile, readCsv } from "./lib/csv";
import { SUBMISSIONS } from "./lib/paths";

/** Tally question title -> research CSV column (Submit a project form, https://tally.so/r/YjRgM6). */
export const TALLY_FIELDS: Record<string, string> = {
  "Project name": "Project/Company Name",
  Website: "Website",
  "X handle": "X Handle",
  Sector: "Sector/Category",
  "Native chain": "Native Chain",
  "What does the project do?": "Description",
  "Contract accounts or addresses on NEAR or Aurora": "Contracts",
  "Evidence link": "Source URL",
  "Your contact": "Contact",
};

/** "What's wrong?" options of the correction form (https://tally.so/r/GeKgJ2) -> research CSV column. */
export const CORRECTION_FIELDS: Record<string, string> = {
  Name: "Project/Company Name",
  Website: "Website",
  Sector: "Sector/Category",
  "Native chain": "Native Chain",
  Description: "Description",
  Status: "Status",
  "X handle": "X Handle",
  "Contract address": "Contracts",
  "Funding or investors": "Investors / Backers",
  Token: "Token",
  "Security or incident info": "Incidents",
  "Traction or onchain data": "Other Traction Signal",
  "Project is defunct or rebranded": "Status",
  Other: "Description",
};

export interface DiffLine {
  project: string;
  field: string;
  submitted: string;
  current: string | null;
  status: "NEW PROJECT" | "≠" | "=" | "no column";
}

function cellOf(p: Project, column: string): string | null {
  switch (column) {
    case "Project/Company Name":
      return p.name;
    case "Website":
      return p.website;
    case "X Handle":
      return p.xHandle;
    case "Sector/Category":
      return p.sector;
    case "Native Chain":
      return p.chain;
    case "Description":
      return p.description;
    case "Status":
      return p.status;
    case "Investors / Backers":
      return p.investors;
    case "Token":
      return p.tokenRaw;
    case "Incidents":
      return p.incidents;
    case "Other Traction Signal":
      return p.otherTraction;
    case "Source URL":
      return p.sourceUrl;
    case "Contracts":
      return p.contracts.map((c) => c.accountId).join(", ") || null;
    default:
      return null;
  }
}

/** Pure diff of one submission row against the project list. */
export function diffSubmission(row: RawRow, projects: Project[]): DiffLine[] {
  const isCorrection = "What's wrong?" in row || "project" in row;
  const name = (isCorrection ? row["project"] : row["Project name"])?.trim() ?? "";
  const byNorm = new Map(projects.map((p) => [normalizeName(p.name), p]));
  const p = projects.find((x) => x.name.toLowerCase() === name.toLowerCase()) ?? byNorm.get(normalizeName(name));
  const out: DiffLine[] = [];
  if (isCorrection) {
    const column = CORRECTION_FIELDS[row["What's wrong?"] ?? ""] ?? null;
    const submitted = row["What should it say instead?"] ?? "";
    out.push({ project: name, field: column ?? row["What's wrong?"] ?? "?", submitted, current: p && column ? cellOf(p, column) : null, status: !p ? "NEW PROJECT" : !column ? "no column" : (cellOf(p, column) ?? "") === submitted ? "=" : "≠" });
    return out;
  }
  for (const [question, column] of Object.entries(TALLY_FIELDS)) {
    const submitted = row[question]?.trim();
    if (!submitted) continue;
    const current = p ? cellOf(p, column) : null;
    out.push({ project: name, field: column, submitted, current, status: !p ? "NEW PROJECT" : (current ?? "") === submitted ? "=" : "≠" });
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--file");
  const files = fileIdx >= 0 ? [args[fileIdx + 1]] : fs.existsSync(SUBMISSIONS) ? fs.readdirSync(SUBMISSIONS).filter((f) => f.endsWith(".csv")).map((f) => path.join(SUBMISSIONS, f)) : [];
  if (!files.length) {
    console.log(`No submissions found. Export the Tally forms as CSV into ${path.relative(process.cwd(), SUBMISSIONS)}/ or pass --file.`);
    return;
  }
  const projects = readCsv(findFile("near-ecosystem-", ".csv")).map(toProject);
  for (const f of files) {
    console.log(`\n${path.basename(f)}`);
    for (const row of readCsv(f)) {
      for (const d of diffSubmission(row, projects)) {
        console.log(`  ${d.status.padEnd(12)} ${d.project.padEnd(30)} ${d.field.padEnd(24)} submitted: ${d.submitted.slice(0, 60)}${d.current !== null ? `   current: ${d.current.slice(0, 60)}` : ""}`);
      }
    }
  }
  console.log("\nReview script prints only. Apply approved edits to the CSVs by hand, bump data/expected.json if rows were added, and commit.\n");
}

if (require.main === module) main();
