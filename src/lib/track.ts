/**
 * Vercel Web Analytics custom events. Every event name lives here and every property value comes
 * from a closed set, so no email, name, user id, URL, investor or typed text can ever be sent: a
 * value outside its set is dropped, and an event keeps at most 2 properties (the Pro plan limit).
 * `filter_use` sends which filter was used, never what was typed or picked. `investor_open` sends
 * the page, never the investor.
 */
import { track as vercelTrack } from "@vercel/analytics";
import metaJson from "@/data/generated/meta.json";
import { NAV } from "./nav";

export const EVENTS = {
  tabView: "tab_view",
  projectOpen: "project_open",
  sectorOpen: "sector_open",
  investorOpen: "investor_open",
  chartExpand: "chart_expand",
  chartView: "chart_view",
  csvDownload: "csv_download",
  compareAdd: "compare_add",
  filterUse: "filter_use",
  loginPromptShown: "login_prompt_shown",
  signupComplete: "signup_complete",
  correctionClick: "correction_click",
  submitProjectClick: "submit_project_click",
} as const;
export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/** `off` is a build with no login wall, so its readers are neither logged in nor logged out. */
export type Auth = "off" | "in" | "out";
/** Where a login prompt came from. */
export const LOGIN_TRIGGERS = ["tab", "compare", "project", "header", "sector", "investor", "funding"] as const;
export type LoginTrigger = (typeof LOGIN_TRIGGERS)[number];

/** URL keys that are filters a reader sets (the seven facets and search). Chart metric, range, scale and legacy-listing keys are controls, not filters. */
export const FILTER_KEYS = ["q", "sector", "chain", "presence", "tier", "status", "funding", "via"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

/** Page slugs: one per tab; anything else is "other". */
export const PAGES = [...NAV.map((n) => (n.href === "/" ? "overview" : n.href.replace(/\//g, ""))), "other"] as const;

/** The page slug for a pathname, from the tab list. */
export function pageOf(pathname: string): string {
  const p = (pathname.split(/[?#]/)[0] || "/").replace(/\/?$/, "/");
  if (p === "/") return "overview";
  const slug = p.replace(/\//g, "");
  return (PAGES as readonly string[]).includes(slug) ? slug : "other";
}

/** Every expandable chart card (`<ChartCard id>`). tests/track.test.ts fails when a card is missing here. */
export const CHART_IDS = [
  "activity-without-tvl",
  "business-model",
  "chain-activity",
  "chain-over-time",
  "compare-matrix",
  "compare-overlay",
  "compare-profile",
  "compare-ratios",
  "concentration",
  "financials",
  "funding-rounds",
  "funding-type",
  "intents-app-fees",
  "intents-dest-assets",
  "intents-dest-chains",
  "intents-origin-assets",
  "intents-origin-chains",
  "intents-rates",
  "intents-referrals",
  "intents-routes",
  "intents-volume",
  "intents-weekly",
  "listed-vs-live",
  "movers",
  "native-vs-imported",
  "sector-bars",
  "sector-cards",
  "sectors",
  "thesis-beyond-price",
  "thesis-coverage",
  "thesis-cross-check",
  "thesis-explorer-test",
  "thesis-granger",
  "thesis-lead-lag",
  "thesis-levels",
  "thesis-oos",
  "thesis-robustness",
  "thesis-significance",
  "tier-by-sector",
  "timeline",
  "top-investors",
] as const;

export const CHART_VIEWS = ["table", "query"] as const;
export type ChartViewName = (typeof CHART_VIEWS)[number];
/** What a CSV download held: the Explorer's full list, the Explorer under filters, or one chart's table. */
export const CSV_SOURCES = ["explorer_all", "explorer_filtered", "chart"] as const;
export type CsvSource = (typeof CSV_SOURCES)[number];

const SECTORS: readonly string[] = (metaJson as { sectors?: string[] }).sectors ?? [];
const COMPARE_COUNTS = [1, 2, 3, 4];
const oneOf = (set: readonly string[]) => (v: unknown) => typeof v === "string" && set.includes(v);

/** The allowed values of each property. */
const ALLOWED: Record<string, (v: unknown) => boolean> = {
  auth: oneOf(["off", "in", "out"]),
  tab: oneOf(PAGES),
  page: oneOf(PAGES),
  trigger: oneOf(LOGIN_TRIGGERS),
  filter: oneOf(FILTER_KEYS),
  sector: oneOf(SECTORS),
  chart: oneOf(CHART_IDS),
  view: oneOf(CHART_VIEWS),
  source: oneOf(CSV_SOURCES),
  count: (v) => typeof v === "number" && COMPARE_COUNTS.includes(v),
};

/** Which properties each event may carry, in order (at most 2). */
export const EVENT_PROPS: Record<EventName, readonly string[]> = {
  tab_view: ["tab", "auth"],
  project_open: ["sector", "auth"],
  sector_open: ["sector", "auth"],
  investor_open: ["page", "auth"],
  chart_expand: ["chart", "auth"],
  chart_view: ["view", "page"],
  csv_download: ["source", "auth"],
  compare_add: ["count", "auth"],
  filter_use: ["filter", "page"],
  login_prompt_shown: ["trigger"],
  signup_complete: ["trigger"],
  correction_click: ["page"],
  submit_project_click: ["page"],
};

/** What is sent for an event: only its own properties, only allowed values, at most 2. Pure, so it is tested. */
export function eventProps(name: EventName, raw: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const key of (EVENT_PROPS[name] ?? []).slice(0, 2)) {
    const v = raw[key];
    if (ALLOWED[key]?.(v)) out[key] = v as string | number;
  }
  return out;
}

/**
 * Events sent on page load (tab_view, project_open) run before <Analytics /> has set up `window.va`, and track()
 * drops events until then. This sets up the same queue Vercel's own code does (`window.va` pushing to
 * `window.vaq`); the Analytics component leaves an existing queue in place, and its script sends what is queued.
 */
function ensureQueue() {
  if (typeof window === "undefined") return;
  const w = window as unknown as { va?: (...p: unknown[]) => void; vaq?: unknown[][] };
  w.va ??= (...p: unknown[]) => {
    (w.vaq ??= []).push(p);
  };
}

function send(name: EventName, raw: Record<string, unknown>) {
  try {
    ensureQueue();
    vercelTrack(name, eventProps(name, raw));
  } catch {
    // Analytics must never break the page.
  }
}

export const authOf = (a: { enabled: boolean; signedIn: boolean }): Auth => (!a.enabled ? "off" : a.signedIn ? "in" : "out");

export const trackTabView = (pathname: string, auth: Auth) => send(EVENTS.tabView, { tab: pageOf(pathname), auth });
export const trackProjectOpen = (sector: string, auth: Auth) => send(EVENTS.projectOpen, { sector, auth });
export const trackSectorOpen = (sector: string, auth: Auth) => send(EVENTS.sectorOpen, { sector, auth });
export const trackInvestorOpen = (pathname: string, auth: Auth) => send(EVENTS.investorOpen, { page: pageOf(pathname), auth });
export const trackChartExpand = (chart: string, auth: Auth) => send(EVENTS.chartExpand, { chart, auth });
export const trackChartView = (view: ChartViewName, pathname: string) => send(EVENTS.chartView, { view, page: pageOf(pathname) });
export const trackCsvDownload = (source: CsvSource, auth: Auth) => send(EVENTS.csvDownload, { source, auth });
export const trackCompareAdd = (count: number, auth: Auth) => send(EVENTS.compareAdd, { count, auth });
export const trackFilterUse = (filter: FilterKey, pathname: string) => send(EVENTS.filterUse, { filter, page: pageOf(pathname) });
export const trackCorrectionClick = (pathname: string) => send(EVENTS.correctionClick, { page: pageOf(pathname) });
export const trackSubmitProjectClick = (pathname: string) => send(EVENTS.submitProjectClick, { page: pageOf(pathname) });

// ---- login prompts and sign-ups ------------------------------------------------

/** The last login prompt, kept for the session so a sign-up (after Clerk's reload) can say where it started. */
export const AUTH_TRIGGER_KEY = "atlas:auth-trigger";

export function trackLoginPrompt(trigger: LoginTrigger, now = Date.now()) {
  send(EVENTS.loginPromptShown, { trigger });
  try {
    window.sessionStorage.setItem(AUTH_TRIGGER_KEY, JSON.stringify({ trigger, at: now }));
  } catch {
    /* storage unavailable: a sign-up is then not attributed */
  }
}

/** Allowance for the browser clock running ahead of Clerk's (a returning account is years, not minutes, older). */
const CLOCK_SLACK_MS = 10 * 60_000;

/** A sign-up to report: a prompt was shown this session and the account was created after it. Pure. */
export function signupTrigger(raw: string | null, userCreatedAt: number | null | undefined): LoginTrigger | null {
  if (!raw || !userCreatedAt) return null;
  try {
    const v = JSON.parse(raw) as { trigger?: string; at?: number };
    if (!v.trigger || !(LOGIN_TRIGGERS as readonly string[]).includes(v.trigger) || typeof v.at !== "number") return null;
    return userCreatedAt >= v.at - CLOCK_SLACK_MS ? (v.trigger as LoginTrigger) : null;
  } catch {
    return null;
  }
}

/** Once signed in: report the sign-up if this session's prompt led to a new account, then forget the prompt either way. */
export function reportSignup(userCreatedAt: number | null | undefined) {
  try {
    const raw = window.sessionStorage.getItem(AUTH_TRIGGER_KEY);
    if (!raw) return;
    const trigger = signupTrigger(raw, userCreatedAt);
    if (trigger) send(EVENTS.signupComplete, { trigger });
    window.sessionStorage.removeItem(AUTH_TRIGGER_KEY);
  } catch {
    /* storage unavailable */
  }
}
