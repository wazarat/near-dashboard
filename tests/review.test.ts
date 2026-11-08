import { describe, expect, it } from "vitest";
import { diffSubmission, TALLY_FIELDS } from "../scripts/review";
import { toProject } from "../src/lib/parse";

const p = toProject({ "Project/Company Name": "Meta Pool", Website: "https://metapool.app", "Sector/Category": "Liquid Staking & Restaking", "Native Chain": "NEAR native", "Native Chain Confidence": "High", "Traction Tier": "Tier 1 - Leader", "Security Risk Level": "Medium", Description: "Liquid staking", Status: "Mainnet", "Discovered Via": "NEAR Catalog", "Funding Type": "Not researched" });

describe("review diff", () => {
  it("maps the submit form fields and flags differences", () => {
    const lines = diffSubmission({ "Project name": "Meta Pool", Website: "https://metapool.app", Sector: "Liquid Staking & Restaking", "X handle": "@meta_pool" }, [p]);
    expect(lines.find((l) => l.field === "Website")?.status).toBe("=");
    expect(lines.find((l) => l.field === "X Handle")?.status).toBe("≠");
    expect(Object.keys(TALLY_FIELDS)).toContain("Evidence link");
  });
  it("flags unknown projects and reads the correction form", () => {
    expect(diffSubmission({ "Project name": "Brand New Thing", Website: "https://x.y" }, [p])[0].status).toBe("NEW PROJECT");
    const c = diffSubmission({ project: "Meta Pool", page: "https://site/", "What's wrong?": "Status", "What should it say instead?": "Inactive" }, [p])[0];
    expect(c).toMatchObject({ field: "Status", submitted: "Inactive", current: "Mainnet", status: "≠" });
  });
});
