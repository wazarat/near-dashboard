import { describe, expect, it } from "vitest";
import { cn, CUSTOM_TEXT_SIZES } from "../src/lib/utils";

describe("cn", () => {
  it("keeps a custom text size beside a text colour", () => {
    expect(cn("text-label", "text-muted-foreground")).toBe("text-label text-muted-foreground");
    expect(cn("text-label", "text-ink-300")).toBe("text-label text-ink-300");
    for (const size of CUSTOM_TEXT_SIZES) expect(cn(`text-${size}`, "text-ink-50").split(" ")).toEqual([`text-${size}`, "text-ink-50"]);
  });

  it("still merges two sizes, and two colours, keeping the last", () => {
    expect(cn("text-label", "text-title")).toBe("text-title");
    expect(cn("text-sm", "text-label")).toBe("text-label");
    expect(cn("text-ink-50", "text-ink-300")).toBe("text-ink-300");
  });
});
