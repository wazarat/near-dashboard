import { describe, expect, it } from "vitest";
import { NOT_TRACKED, coverageLabel } from "../src/lib/coverage";
import { fmtCompact, fmtInt, fmtNum, fmtPct, fmtPctSigned, fmtRatio, fmtUsd, fmtUsdFull } from "../src/lib/format";

describe("coverage language", () => {
  it("writes the KPI subtitle as Tracked for n of m", () => {
    expect(coverageLabel(2, 13)).toBe("Tracked for 2 of 13 projects");
    expect(coverageLabel(0, 1088)).toBe("Tracked for 0 of 1,088 projects");
    expect(coverageLabel(3, 4, "sectors")).toBe("Tracked for 3 of 4 sectors");
  });

  it("renders every blank metric as Not tracked, never as a dash or a zero", () => {
    const blanks = [null, undefined, Number.NaN];
    for (const v of blanks) {
      expect(fmtUsd(v)).toBe(NOT_TRACKED);
      expect(fmtUsdFull(v)).toBe(NOT_TRACKED);
      expect(fmtInt(v)).toBe(NOT_TRACKED);
      expect(fmtPct(v)).toBe(NOT_TRACKED);
      expect(fmtPctSigned(v)).toBe(NOT_TRACKED);
      expect(fmtCompact(v)).toBe(NOT_TRACKED);
      expect(fmtRatio(v)).toBe(NOT_TRACKED);
      expect(fmtNum(v)).toBe(NOT_TRACKED);
    }
    expect(fmtUsd(0)).toBe("$0");
    expect(fmtPct(0)).toBe("0%");
  });
});
