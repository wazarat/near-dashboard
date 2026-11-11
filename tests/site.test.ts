import { describe, expect, it } from "vitest";
import { OG_BASE, pageMeta, SITE } from "@/lib/site";

describe("site settings", () => {
  it("names the atlas once, for the lockup, titles and the share card", () => {
    expect(SITE.name).toBe("CanHav Research");
    expect(SITE.atlas).toBe("NEAR Atlas");
    expect(SITE.title).toBe("CanHav Research, NEAR Atlas");
    expect(SITE.template).toBe("%s · NEAR Atlas");
    expect(OG_BASE.siteName).toBe("CanHav Research");
  });
  it("builds per-page metadata with a canonical and an Open Graph URL", () => {
    const m = pageMeta("NEAR Intents", "/intents/");
    expect(m.title).toBe("NEAR Intents");
    expect(m.alternates?.canonical).toBe("/intents/");
    const og = m.openGraph as { url?: string; title?: string; siteName?: string; images?: Array<{ url: string }> };
    expect(og.url).toBe("/intents/");
    expect(og.title).toBe("NEAR Intents · NEAR Atlas");
    expect(og.siteName).toBe("CanHav Research");
    expect(og.images?.[0]?.url).toBe("/og.png");
    expect(m.robots).toBeUndefined();
  });
});
