import path from "node:path";

export const ROOT = path.resolve(__dirname, "..", "..");
export const DATA = path.join(ROOT, "data");
export const HISTORY = path.join(DATA, "history");
export const RAW = path.join(DATA, "raw");
export const OUT = path.join(ROOT, "src", "data", "generated");
export const QUERIES = path.join(ROOT, "queries");
export const SUBMISSIONS = path.join(DATA, "submissions");
export const DOCS = path.join(ROOT, "docs");
