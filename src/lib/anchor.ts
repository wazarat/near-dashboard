import type { AnchorIndexEntry } from "./history-types";

export const REPO_URL = "https://github.com/wazarat/near-dashboard";

export type AnchorCard = { latest: (AnchorIndexEntry & { date: string }) | null; count: number };

/** The newest entry of data/anchors/index.json, or null before the first anchor. */
export function latestAnchor(index: Record<string, AnchorIndexEntry>): AnchorCard {
  const dates = Object.keys(index).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const date = dates.at(-1);
  return { latest: date ? { date, ...index[date] } : null, count: dates.length };
}

export function nearblocksTxUrl(hash: string): string {
  return `https://nearblocks.io/txns/${hash}`;
}

export function shortHash(h: string, head = 8, tail = 6): string {
  return h.length <= head + tail + 1 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`;
}

/** The three commands anyone can run to check an anchor against a fresh clone. */
export function verifyCommands(date: string, commit: string): string[] {
  return [
    `git clone ${REPO_URL} && cd near-dashboard && git checkout ${commit}`,
    "npm ci",
    `npm run verify:anchor -- ${date} --rebuild`,
  ];
}
