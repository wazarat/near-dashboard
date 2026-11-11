import type { NextConfig } from "next";

/**
 * Served by Next on Vercel (no static export since the login wall). Pages still prerender
 * as static HTML; src/proxy.ts runs Clerk in front of them when its keys are set.
 */
const nextConfig: NextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
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
