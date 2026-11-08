import { CHART } from "@/lib/colors";
import type { ThesisJson, UsageKey } from "@/lib/thesis-types";

/** Fixed hue per usage series so a hidden series never repaints the others. Avoids the Intents (cat-1) and price hues. */
export const USAGE_COLOR: Record<UsageKey, string> = {
  txns: CHART.usage,
  activeAccounts: "var(--cat-6)",
  newAccounts: "var(--cat-7)",
  functionCalls: "var(--cat-2)",
  contractsCalled: "var(--cat-5)",
};

export const INTENTS_LABEL = "Intents volume";
export const PRICE_LABEL = "NEAR price";

export const THESIS_MD_URL = "https://github.com/wazarat/near-dashboard/blob/main/THESIS.md";

type QuerySpec = ThesisJson["queries"][string];

/** Pick named queries from thesis.json in order, skipping any the file does not carry. */
export function pickQueries(queries: ThesisJson["queries"], keys: string[]): QuerySpec[] {
  return keys.map((k) => queries[k]).filter((q): q is QuerySpec => Boolean(q));
}

/** Signed lag in weeks or days: "+7 w", "0 w", "−2 w". */
export function fmtLag(lag: number | null | undefined, unit = "w"): string {
  if (lag === null || lag === undefined || !Number.isFinite(lag)) return "n/a";
  const sign = lag > 0 ? "+" : lag < 0 ? "−" : "";
  return `${sign}${Math.abs(lag)} ${unit}`;
}

/** Correlation or R² with two decimals and a typographic minus. */
export function fmtR(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "n/a";
  return v.toFixed(2).replace("-", "−");
}

/** "1,059×" for large multiples, "7.5×" for small ones, "0.07×" below one. */
export function fmtTimes(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "n/a";
  if (Math.abs(v) >= 100) return `${Math.round(v).toLocaleString("en-US")}×`;
  if (Math.abs(v) >= 10) return `${v.toFixed(0)}×`;
  if (Math.abs(v) >= 1) return `${v.toFixed(1)}×`;
  return `${v.toFixed(2)}×`;
}

const WORDS = ["none", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** Small counts in words for prose; larger counts stay numeric. */
export function countWord(n: number): string {
  return n >= 0 && n < WORDS.length ? WORDS[n] : String(n);
}
