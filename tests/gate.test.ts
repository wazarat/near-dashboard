import { describe, expect, it } from "vitest";
import { allowed, compareChange, decodePending, encodePending, GATED_PATHS, isGatedPath, PUBLIC_PAGES_OUTSIDE_NAV, PUBLIC_PATHS, PUBLIC_PROJECT_SECTIONS, replayPending, unclassifiedTabs } from "@/lib/gate";
import { NAV } from "@/lib/nav";

describe("login wall rules", () => {
  it("keeps every tab in the header, the other CanHav atlases' seven plus Intents", () => {
    expect(NAV.map((n) => n.label)).toEqual(["Overview", "Sectors", "Traction", "Intents", "Funding", "Explorer", "Compare", "Methodology"]);
    for (const n of NAV) expect(Object.keys(n).sort()).toEqual(["href", "label"]);
  });

  it("classifies every tab as public or gated, once", () => {
    expect(unclassifiedTabs()).toEqual([]);
    const tabs = [...PUBLIC_PATHS, ...GATED_PATHS].filter((p) => !(PUBLIC_PAGES_OUTSIDE_NAV as readonly string[]).includes(p));
    expect(tabs.sort()).toEqual(NAV.map((n) => n.href).sort());
    expect(new Set(tabs).size).toBe(8);
    // The one public page outside the tabs is the Help us track this list.
    expect(PUBLIC_PAGES_OUTSIDE_NAV).toEqual(["/help-track/"]);
    expect(isGatedPath("/help-track/")).toBe(false);
  });

  it("leaves every chart page open and gates Funding, where Investors now sits", () => {
    for (const p of ["/", "/intents/", "/explorer/", "/sectors/", "/traction/", "/compare/", "/methodology/"]) expect(isGatedPath(p)).toBe(false);
    expect(isGatedPath("/funding/")).toBe(true);
    expect(isGatedPath("/funding")).toBe(true);
    expect(isGatedPath("/funding/?fundingType=grant")).toBe(true);
    expect(isGatedPath("/intents/?expand=intents-volume")).toBe(false);
    expect(isGatedPath("/nowhere/")).toBe(false);
  });

  it("allows everything when the wall is off or the reader is signed in", () => {
    expect(allowed({ path: "/funding/" }, false, false)).toBe(true);
    expect(allowed({ action: "compare-add" }, false, false)).toBe(true);
    expect(allowed({ path: "/funding/" }, true, true)).toBe(true);
    expect(allowed({ action: "project-detail" }, true, true)).toBe(true);
  });

  it("logged out, with the wall on, opens public pages only and no gated action", () => {
    expect(allowed({ path: "/" }, false, true)).toBe(true);
    expect(allowed({ path: "/compare/" }, false, true)).toBe(true);
    expect(allowed({ path: "/help-track/" }, false, true)).toBe(true);
    for (const p of ["/intents/", "/explorer/", "/sectors/", "/traction/", "/methodology/"]) expect(allowed({ path: p }, false, true)).toBe(true);
    expect(allowed({ path: "/funding/" }, false, true)).toBe(false);
    // The security record on Methodology stays behind the login, as the Security tab was.
    for (const action of ["compare-add", "project-detail", "sector-detail", "investor-detail", "funding-detail", "security-detail"] as const) expect(allowed({ action }, false, true)).toBe(false);
    expect(PUBLIC_PROJECT_SECTIONS).toEqual(["header", "overview", "traction"]);
  });
});

describe("gated compare", () => {
  it("writes removals, reorders and clears without a login", () => {
    expect(compareChange(["a", "b"], ["a"], false)).toEqual({ write: ["a"] });
    expect(compareChange(["a", "b"], ["b", "a"], false)).toEqual({ write: ["b", "a"] });
    expect(compareChange(["a"], [], false)).toEqual({ write: [] });
  });

  it("asks for login on any addition while logged out and keeps the whole intended selection", () => {
    expect(compareChange([], ["a"], false)).toEqual({ login: { type: "compare-set", ids: ["a"] } });
    // A preset replaces the selection with several projects at once.
    expect(compareChange(["x"], ["a", "b", "c"], false)).toEqual({ login: { type: "compare-set", ids: ["a", "b", "c"] } });
    expect(compareChange([], ["a"], true)).toEqual({ write: ["a"] });
  });

  it("round-trips a saved action and rejects anything else", () => {
    const saved = encodePending({ type: "compare-set", ids: ["meta-pool", "linear-protocol"] });
    expect(decodePending(saved)).toEqual({ type: "compare-set", ids: ["meta-pool", "linear-protocol"] });
    expect(decodePending(null)).toBeNull();
    expect(decodePending("not json")).toBeNull();
    expect(decodePending(JSON.stringify({ type: "compare-add", id: "a" }))).toBeNull();
    expect(decodePending(JSON.stringify({ type: "compare-set", ids: [] }))).toBeNull();
    expect(decodePending(JSON.stringify({ type: "compare-set", ids: [1, "", "a"] }))).toEqual({ type: "compare-set", ids: ["a"] });
  });

  it("replays the saved selection after login unless it is already held", () => {
    const saved = encodePending({ type: "compare-set", ids: ["a", "b"] });
    expect(replayPending(saved, [])).toEqual(["a", "b"]);
    expect(replayPending(saved, ["a"])).toEqual(["a", "b"]);
    expect(replayPending(saved, ["b", "a"])).toBeNull();
    expect(replayPending(null, [])).toBeNull();
  });
});
