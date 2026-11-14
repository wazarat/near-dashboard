import type { DateStr } from "./dates";
import type { LeadLagSummary, OosResult } from "./stats";
import type { ClarkWestResult, GrangerResult, TestStatus } from "./thesis-tests";

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

/** One predictor against one usage series in the Explorer-only test. */
export interface ExplorerTestCell {
  leadLag: LeadLagSummary;
  oos: OosResult;
}

/** The lead-lag and out-of-sample tests over the weeks the 1Click Explorer covers, per predictor. */
export interface ExplorerTest {
  available: boolean;
  /** First and last complete Explorer day used, and the weekly changes they give. */
  start: DateStr | null;
  end: DateStr | null;
  weeks: number;
  /** Per usage series: Explorer 1Click volume, DefiLlama volume over the same weeks, and price over the same weeks. */
  results: Partial<Record<UsageKey, { explorer: ExplorerTestCell; llama: ExplorerTestCell; price: ExplorerTestCell }>>;
  /** Wins by the same rules as the headline test, with each Intents measure against price. */
  explorer: { leadWins: number; priceLeadWins: number; ties: number; oosWins: number; priceOosWins: number; supported: "yes" | "partly" | "no" };
  llama: { leadWins: number; priceLeadWins: number; ties: number; oosWins: number; priceOosWins: number; supported: "yes" | "partly" | "no" };
  /** True when the Explorer verdict over its weeks is at least as strong as the headline verdict of the full window. */
  holds: boolean | null;
  conclusion: string;
}

/** A1 for one usage series and one predictor: block-bootstrap p-value of the best positive-lag correlation. */
export interface BootRow {
  lag: number;
  r: number | null;
  p: number | null;
  /** Benjamini-Hochberg adjusted p-value across all series and both predictors. */
  pAdj: number | null;
  significant: boolean;
  ciLow: number | null;
  ciHigh: number | null;
  n: number;
  /** Secondary note: r clears the old ±0.20 noise band. */
  outsideBand: boolean;
}

/** Part A: significance, the nested out-of-sample comparison, Granger both ways and the verdict gate. */
export interface Rigor {
  seed: number;
  resamples: number;
  block: number;
  q: number;
  bootstrap: Partial<Record<UsageKey, PredictorPair<BootRow>>>;
  clarkWest: Partial<Record<UsageKey, ClarkWestResult>>;
  a2Pass: boolean;
  granger: Partial<Record<UsageKey, { forward: GrangerResult; reverse: GrangerResult; usageLeads: boolean }>>;
  /** Series where Intents is significant after Benjamini-Hochberg. */
  significantSeries: UsageKey[];
  a4Pass: boolean;
}

export interface ChartSeries {
  key: string;
  label: string;
  values: Array<number | null>;
}

/** One related test (B1 to B6) as the /thesis card and THESIS.md section show it. */
export interface RelatedTest {
  id: string;
  code: string;
  title: string;
  /** The pre-registered rule, in plain words. */
  rule: string;
  /** One plain sentence with the result. */
  result: string;
  status: TestStatus;
  /** Extra lines for THESIS.md: method notes, accounts used, overlaps and caveats. */
  notes: string[];
  chart: { kind: "line" | "stack"; unit: "pct" | "num" | "usd"; x: string[]; series: ChartSeries[] } | null;
  queries: Array<{ kind: "sql" | "http" | "transform"; title: string; code: string }>;
}

/** One row of the results table at the top of /thesis and THESIS.md. */
export interface ResultRow {
  id: string;
  code: string;
  test: string;
  rule: string;
  result: string;
  status: TestStatus;
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
  coverage: {
    explorerDays: number;
    explorerFirstDay: DateStr | null;
    explorerLastDay: DateStr | null;
    ratioMedian: number | null;
    ratioLatest: number | null;
    /** Explorer volume over DefiLlama volume, both summed over the complete days that have both. */
    ratioSum: number | null;
    explorerVolumeUsd: number;
    llamaVolumeUsd: number;
    ratioDays: number;
    explorerBackfillDone: boolean;
  };
  explorerTest: ExplorerTest;
  rigor: Rigor;
  related: RelatedTest[];
  results: ResultRow[];
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
    /** The rule the verdict follows, in plain words. */
    rule: string;
    headline: string;
    evidenceFor: string[];
    evidenceAgainst: string[];
    changeMyMind: string[];
    gaps: string[];
  };
  queries: Record<string, { kind: "sql" | "http" | "transform"; title: string; code: string }>;
}
