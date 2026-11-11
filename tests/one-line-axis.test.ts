import { describe, expect, it } from "vitest";
import { fitText } from "@/components/atlas/one-line-axis";

const px = (s: string) => s.length * 6; // 6 px a character

describe("one-line axis labels", () => {
  it("keep a label that fits as it is", () => {
    expect(fitText("Launchpads", 100, px)).toBe("Launchpads");
  });

  it("shorten a label that does not fit to one line ending in an ellipsis", () => {
    const out = fitText("Infrastructure & Dev Tools", 90, px);
    expect(out.endsWith("…")).toBe(true);
    expect(px(out)).toBeLessThanOrEqual(90);
    expect(out).toBe("Infrastructure…");
    expect(fitText("Exchanges & On/Off-Ramps", 70, px)).toBe("Exchanges…");
  });

  it("never return more than the room allows", () => {
    for (const room of [0, 6, 12, 30, 200]) expect(px(fitText("Perps, Options & Derivatives", room, px))).toBeLessThanOrEqual(Math.max(room, 6));
  });
});
