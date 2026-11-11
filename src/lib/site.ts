import type { Metadata } from "next";

/**
 * The site's name in one place (docs/ATLAS-UI.md, section 1, Logo). The header lockup, page
 * titles, Open Graph and the share card all read it. The origin lives in src/lib/env.ts.
 */
export const SITE = {
  name: "CanHav Research",
  chain: "NEAR",
  atlas: "NEAR Atlas",
  title: "CanHav Research, NEAR Atlas",
  template: "%s · NEAR Atlas",
} as const;

/** Shared Open Graph fields. Next replaces a page's nested openGraph object instead of merging it with the layout's, so every page spreads this. */
export const OG_BASE = {
  type: "website" as const,
  siteName: SITE.name,
  images: [{ url: "/og.png", width: 1200, height: 630, alt: SITE.title }],
};

/** Per-page metadata: the title plus a canonical and Open Graph URL relative to metadataBase, with the shared Open Graph fields. */
export function pageMeta(title: string, path: string): Metadata {
  return { title, alternates: { canonical: path }, openGraph: { ...OG_BASE, url: path, title: `${title} · ${SITE.atlas}` } };
}
