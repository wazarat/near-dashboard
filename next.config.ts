import type { NextConfig } from "next";

/**
 * Where the old vercel.app hosts send readers once the login wall is on. Clerk's production keys
 * only work on canhav.com, so a vercel.app host with the wall on could not sign anyone in. The
 * redirect therefore switches on in the same production build that turns the wall on: both Clerk
 * keys set and NEXT_PUBLIC_SITE_URL on canhav.com. Until then it is off and every host serves the
 * site as before. Pure, so it is tested.
 */
export function canonicalHost(env: Record<string, string | undefined>): string | null {
  const site = (env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  const wallOn = Boolean((env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").trim() && (env.CLERK_SECRET_KEY ?? "").trim());
  const production = env.VERCEL_ENV === "production";
  return production && wallOn && /^https:\/\/[a-z0-9-]+\.canhav\.com$/.test(site) ? site : null;
}

export function hostRedirects(env: Record<string, string | undefined>) {
  const to = canonicalHost(env);
  // Temporary (307) while the move settles; make it permanent once near.canhav.com is the only address in use.
  return to ? [{ source: "/:path*", has: [{ type: "host" as const, value: ".*\\.vercel\\.app" }], destination: `${to}/:path*`, permanent: false }] : [];
}

/**
 * Served by Next on Vercel (no static export since the login wall). Pages still prerender
 * as static HTML; src/proxy.ts runs Clerk in front of them when its keys are set.
 */
const nextConfig: NextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  async redirects() {
    return hostRedirects(process.env);
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
