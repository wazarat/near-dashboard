import type { MetadataRoute } from "next";
import { meta } from "@/lib/data";
import { SITE_URL } from "@/lib/env";

export const dynamic = "force-static";

const ROUTES = ["/", "/sectors/", "/traction/", "/intents/", "/thesis/", "/funding/", "/investors/", "/security/", "/explorer/", "/compare/"];

/** Static sitemap for the export; URLs come from NEXT_PUBLIC_SITE_URL (standard section 12). */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(`${meta.asOf.slice(0, 10)}T00:00:00Z`);
  return ROUTES.map((path) => ({ url: `${SITE_URL}${path}`, lastModified, changeFrequency: "daily", priority: path === "/" ? 1 : path === "/thesis/" || path === "/intents/" ? 0.9 : 0.7 }));
}
