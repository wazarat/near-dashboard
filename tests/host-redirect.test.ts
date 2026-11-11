import { describe, expect, it } from "vitest";
import { canonicalHost, hostRedirects } from "../next.config";

const ON = { VERCEL_ENV: "production", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_x", CLERK_SECRET_KEY: "sk_live_x", NEXT_PUBLIC_SITE_URL: "https://near.canhav.com/" };

describe("vercel.app redirect", () => {
  it("is off until the wall is on in production with a canhav.com site URL", () => {
    expect(hostRedirects({})).toEqual([]);
    expect(hostRedirects({ ...ON, CLERK_SECRET_KEY: "" })).toEqual([]);
    expect(hostRedirects({ ...ON, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: undefined })).toEqual([]);
    expect(hostRedirects({ ...ON, VERCEL_ENV: "preview" })).toEqual([]);
    // The current host stays reachable while the site URL still points at it.
    expect(hostRedirects({ ...ON, NEXT_PUBLIC_SITE_URL: "https://near-dashboard-puce.vercel.app" })).toEqual([]);
    expect(hostRedirects({ ...ON, NEXT_PUBLIC_SITE_URL: "https://evil.example.com/near.canhav.com" })).toEqual([]);
    expect(hostRedirects({ ...ON, NEXT_PUBLIC_SITE_URL: "http://near.canhav.com" })).toEqual([]);
  });

  it("sends every vercel.app host to the canhav.com site, path kept, as a temporary redirect", () => {
    expect(canonicalHost(ON)).toBe("https://near.canhav.com");
    const [rule] = hostRedirects(ON);
    expect(rule.destination).toBe("https://near.canhav.com/:path*");
    expect(rule.source).toBe("/:path*");
    expect(rule.permanent).toBe(false);
    const host = new RegExp(`^${rule.has[0].value}$`);
    expect(host.test("near-dashboard-puce.vercel.app")).toBe(true);
    expect(host.test("near-dashboard-git-main-wazarats-projects.vercel.app")).toBe(true);
    expect(host.test("near.canhav.com")).toBe(false);
    expect(host.test("localhost")).toBe(false);
  });
});
