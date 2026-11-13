import type { DateStr } from "./dates";
import type { LeadLagSummary, OosResult } from "./stats";

export const USAGE_KEYS = ["txns", "activeAccounts", "newAccounts", "functionCalls", "contractsCalled"] as const;
export type UsageKey = (typeof USAGE_KEYS)[number];

export interface UsageMeta {
  key: UsageKey;
  label: string;
  source: "NearBlocks" | "BigQuery";
  /** "chain" for whole-chain counts (transactions, accounts), "contract" for receipt-level series (function calls, contracts). */
  level: "chain" | "contract";
  kind: "flow" | "stock";
}

/** One usage series as the thesis reads it: where it comes from and the days it covers. */
export interface UsageWindow {
  source: UsageMeta["source"];
  /** The SQL file or endpoint behind the series. */
  ref: string;
  start: DateStr | null;
  end: DateStr | null;
  weeks: number;
}

/** A BigQuery chain count against the same count from NearBlocks' daily charts. */
export interface CrossCheck {
  days: number;
  /** Daily BigQuery / NearBlocks ratio. */
  ratioMedian: number | null;
  ratioMin: number | null;
  ratioMax: number | null;
  weeks: number;
  /** ISO weeks (Monday) where the two weekly totals differ by more than 10%. */
  flaggedWeeks: Array<{ week: DateStr; bigquery: number; nearblocks: number; ratio: number }>;
  /** The same two tests run on the NearBlocks series, for comparison with the BigQuery rows. */
  leadLag: PredictorPair<LeadLagSummary>;
  oos: PredictorPair<OosResult>;
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
  /** Window of the BigQuery receipt series (function calls, contracts called), which is shorter than the thesis window. */
  bigqueryWindow: { start: DateStr | null; end: DateStr | null; weeks: number };
  usageWindows: Partial<Record<UsageKey, UsageWindow>>;
  crossCheck: Partial<Record<UsageKey, CrossCheck>>;
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
