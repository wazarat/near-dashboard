import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import metaJson from "@/data/generated/meta.json";
import { FACETS } from "@/lib/filters";
import { authOf, CHART_IDS, EVENT_PROPS, EVENTS, eventProps, FILTER_KEYS, LOGIN_TRIGGERS, pageOf, PAGES, signupTrigger, type EventName } from "@/lib/track";

const PII = [
  "someone@example.com",
  "Jane Doe",
  "user_2abcDEF123",
  "https://near.canhav.com/?project=near-intents",
  "near-intents",
  "Pantera Capital",
  "0x1234567890abcdef1234567890abcdef12345678",
  "alice.near",
  "  in ",
  "",
  null,
  undefined,
  42,
  { email: "someone@example.com" },
];

const ALL_KEYS = ["tab", "auth", "sector", "count", "filter", "page", "trigger", "chart", "view", "source"];
const allValues = (o: Record<string, string | number>) => Object.values(o).map(String);

describe("analytics events", () => {
  it("are exactly these thirteen events", () => {
    expect(Object.values(EVENTS).sort()).toEqual(
      [
        "chart_expand",
        "chart_view",
        "compare_add",
        "correction_click",
        "csv_download",
        "filter_use",
        "investor_open",
        "login_prompt_shown",
        "project_open",
        "sector_open",
        "signup_complete",
        "submit_project_click",
        "tab_view",
      ].sort(),
    );
    expect(LOGIN_TRIGGERS).toEqual(["tab", "compare", "project", "header", "sector", "investor", "funding"]);
  });

  it("keep at most two properties, each from its closed set", () => {
    const sector = (metaJson as { sectors: string[] }).sectors[0];
    const good: Record<EventName, Record<string, unknown>> = {
      tab_view: { tab: "intents", auth: "out" },
      project_open: { sector, auth: "in" },
      sector_open: { sector, auth: "off" },
      investor_open: { page: "investors", auth: "in" },
      chart_expand: { chart: "thesis-levels", auth: "out" },
      chart_view: { view: "query", page: "thesis" },
      csv_download: { source: "explorer_filtered", auth: "in" },
      compare_add: { count: 2, auth: "out" },
      filter_use: { filter: "q", page: "explorer" },
      login_prompt_shown: { trigger: "compare" },
      signup_complete: { trigger: "tab" },
      correction_click: { page: "overview" },
      submit_project_click: { page: "explorer" },
    };
    for (const name of Object.values(EVENTS)) {
      expect(EVENT_PROPS[name].length).toBeLessThanOrEqual(2);
      const out = eventProps(name, { ...good[name], extra: "someone@example.com", userId: "user_2abc", name: "Jane Doe" });
      expect(Object.keys(out).length).toBeLessThanOrEqual(2);
      expect(Object.keys(out)).toEqual(EVENT_PROPS[name].filter((k) => k in good[name]));
      expect(out).toEqual(good[name]);
    }
  });

  it("never send an email, a name, a user id, an account, a URL or typed text, whatever is passed", () => {
    for (const name of Object.values(EVENTS)) {
      for (const bad of PII) {
        const raw = Object.fromEntries(ALL_KEYS.map((k) => [k, bad]));
        const out = eventProps(name, raw);
        expect(out, `${name} with ${JSON.stringify(bad)}`).toEqual({});
        for (const v of allValues(out)) expect(v).not.toMatch(/@|user_|https?:|0x|\.near/);
      }
    }
  });

  it("investor_open carries the page, never the investor", () => {
    expect(EVENT_PROPS.investor_open).toEqual(["page", "auth"]);
    expect(eventProps("investor_open", { page: "investors", auth: "in", investor: "pantera-capital" })).toEqual({ page: "investors", auth: "in" });
  });

  it("filter_use carries the filter's key, never what was typed", () => {
    expect(eventProps("filter_use", { filter: "pantera capital", page: "explorer" })).toEqual({ page: "explorer" });
    for (const k of FILTER_KEYS) expect(eventProps("filter_use", { filter: k, page: "overview" })).toEqual({ filter: k, page: "overview" });
    // The filters a reader sets are the facets and search; the legacy switches are a card's control.
    expect([...FILTER_KEYS].sort()).toEqual([...FACETS.map((f) => f.key), "q"].sort());
  });

  it("name pages by tab, and anything unknown as other", () => {
    expect(pageOf("/")).toBe("overview");
    expect(pageOf("/intents/")).toBe("intents");
    expect(pageOf("/thesis")).toBe("thesis");
    expect(pageOf("/explorer?q=x")).toBe("explorer");
    expect(pageOf("/someone@example.com/")).toBe("other");
    expect(PAGES).toEqual(["overview", "sectors", "traction", "intents", "thesis", "funding", "investors", "security", "explorer", "compare", "other"]);
  });

  it("says whether the wall is off, or the reader is in or out", () => {
    expect(authOf({ enabled: false, signedIn: false })).toBe("off");
    expect(authOf({ enabled: true, signedIn: false })).toBe("out");
    expect(authOf({ enabled: true, signedIn: true })).toBe("in");
  });

  it("count a sign-up only for an account created after this session's prompt", () => {
    const at = Date.UTC(2026, 10, 11, 12);
    const raw = JSON.stringify({ trigger: "compare", at });
    expect(signupTrigger(raw, at + 60_000)).toBe("compare");
    expect(signupTrigger(raw, at - 2 * 60_000)).toBe("compare"); // browser clock a little ahead
    expect(signupTrigger(raw, Date.UTC(2025, 0, 1))).toBeNull(); // a returning account
    expect(signupTrigger(null, at)).toBeNull();
    expect(signupTrigger(JSON.stringify({ trigger: "someone@example.com", at }), at + 1)).toBeNull();
    expect(signupTrigger("not json", at)).toBeNull();
  });
});

describe("chart ids", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".tsx")) files.push(full);
    }
  };
  walk(path.join("src", "components"));

  it("list every expandable chart card, so chart_expand can name each one", () => {
    const found = new Set<string>();
    let cards = 0;
    for (const f of files) {
      const text = fs.readFileSync(f, "utf8");
      cards += (text.match(/<ChartCard\b/g) ?? []).length;
      for (const m of text.matchAll(/<ChartCard\b[\s\S]{0,400}?\bid="([a-z0-9-]+)"/g)) found.add(m[1]);
    }
    expect(cards).toBeGreaterThan(30);
    // The timeline card takes its id as a prop, which defaults to "timeline".
    expect([...found, "timeline"].sort()).toEqual([...CHART_IDS].sort());
    expect(new Set(CHART_IDS).size).toBe(CHART_IDS.length);
  });
});
