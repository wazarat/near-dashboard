import { describe, expect, it } from "vitest";
import { allowed, compareChange, decodePending, encodePending, GATED_PATHS, isGatedPath, PUBLIC_PATHS, PUBLIC_PROJECT_SECTIONS, replayPending, unclassifiedTabs } from "@/lib/gate";
import { NAV } from "@/lib/nav";

describe("login wall rules", () => {
  it("keeps every tab in the header, none hidden", () => {
    expect(NAV.map((n) => n.label)).toEqual(["Overview", "Sectors", "Traction", "Intents", "Thesis", "Funding", "Investors", "Security", "Explorer", "Compare"]);
    for (const n of NAV) expect(Object.keys(n).sort()).toEqual(["href", "label"]);
  });

  it("classifies every tab as public or gated, once", () => {
    expect(unclassifiedTabs()).toEqual([]);
    expect([...PUBLIC_PATHS, ...GATED_PATHS].sort()).toEqual(NAV.map((n) => n.href).sort());
    expect(new Set([...PUBLIC_PATHS, ...GATED_PATHS]).size).toBe(10);
  });

  it("leaves Overview, Thesis and Compare open and gates the other seven tabs", () => {
    for (const p of ["/", "/thesis/", "/compare/"]) expect(isGatedPath(p)).toBe(false);
    for (const p of ["/sectors/", "/traction/", "/intents/", "/funding/", "/investors/", "/security/", "/explorer/"]) expect(isGatedPath(p)).toBe(true);
    expect(isGatedPath("/explorer")).toBe(true);
    expect(isGatedPath("/intents/?expand=intents-volume")).toBe(true);
    expect(isGatedPath("/thesis?expand=thesis-levels")).toBe(false);
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
    expect(allowed({ path: "/thesis/" }, false, true)).toBe(true);
    expect(allowed({ path: "/compare/" }, false, true)).toBe(true);
    expect(allowed({ path: "/intents/" }, false, true)).toBe(false);
    for (const action of ["compare-add", "project-detail", "sector-detail", "investor-detail"] as const) expect(allowed({ action }, false, true)).toBe(false);
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
