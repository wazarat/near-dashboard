import type { DateStr } from "./dates";
import type { LeadLagSummary, OosResult } from "./stats";

export const USAGE_KEYS = ["txns", "activeAccounts", "newAccounts", "functionCalls", "contractsCalled"] as const;
export type UsageKey = (typeof USAGE_KEYS)[number];

export interface UsageMeta {
  key: UsageKey;
  label: string;
  source: "NearBlocks" | "BigQuery";
  kind: "flow" | "stock";
}

export interface PredictorPair<T> {
  intents: T;
  price: T;
}

export interface RobustnessVariant {
  id: string;
  label: string;
  description: string;
  /** Per usage key: strongest positive-lag correlation for each predictor (null when not computable). */
  results: Partial<Record<UsageKey, { intents: { lag: number; r: number } | null; price: { lag: number; r: number } | null; n: number }>>;
  intentsWins: number;
  priceWins: number;
}

export interface Confounder {
  title: string;
  date: DateStr;
  monthOnly: boolean;
  kind: string;
  detail: string | null;
  sourceUrl: string | null;
  /** Why it matters for the thesis (fixed text per event id chosen in the script). */
  why: string;
}

export interface ThesisJson {
  available: boolean;
  asOf: DateStr;
  window: { start: DateStr; end: DateStr; weeks: number };
  bigqueryWindow: { start: DateStr | null; end: DateStr | null; weeks: number };
  cutoff: DateStr;
  maxLag: number;
  sources: { intents: string; price: string; usage: string[] };
  usage: UsageMeta[];
  weekly: {
    dates: DateStr[];
    intentsVolume: Array<number | null>;
    price: Array<number | null>;
    series: Partial<Record<UsageKey, Array<number | null>>>;
    indexed: { intentsVolume: Array<number | null>; price: Array<number | null>; series: Partial<Record<UsageKey, Array<number | null>>> };
  };
  daily: { dates: DateStr[]; intentsLlama: Array<number | null>; intentsExplorer: Array<number | null>; price: Array<number | null> };
  leadLag: Partial<Record<UsageKey, PredictorPair<LeadLagSummary>>>;
  oos: Partial<Record<UsageKey, PredictorPair<OosResult>>>;
  robustness: RobustnessVariant[];
  coverage: { explorerDays: number; explorerFirstDay: DateStr | null; ratioMedian: number | null; ratioLatest: number | null; explorerBackfillDone: boolean };
  confounders: Confounder[];
  verdict: {
    baseIntentsWins: number;
    basePriceWins: number;
    baseTies: number;
    oosIntentsWins: number;
    oosPriceWins: number;
    robustnessIntentsWins: number;
    robustnessPriceWins: number;
    supported: "yes" | "partly" | "no";
    headline: string;
    evidenceFor: string[];
    evidenceAgainst: string[];
    changeMyMind: string[];
    gaps: string[];
  };
  queries: Record<string, { kind: "sql" | "http" | "transform"; title: string; code: string }>;
}
