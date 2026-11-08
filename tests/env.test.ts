import { describe, expect, it } from "vitest";
import { tallyCorrectUrl } from "../src/lib/env";

describe("tallyCorrectUrl", () => {
  it("prefills the hidden project and page fields", () => {
    const u = new URL(tallyCorrectUrl("https://tally.so/r/GeKgJ2", "Rhea Lend (formerly Burrow)", "https://near-dashboard-puce.vercel.app/traction/?project=rhea-lend"));
    expect(u.origin + u.pathname).toBe("https://tally.so/r/GeKgJ2");
    expect(u.searchParams.get("project")).toBe("Rhea Lend (formerly Burrow)");
    expect(u.searchParams.get("page")).toContain("project=rhea-lend");
  });
});
