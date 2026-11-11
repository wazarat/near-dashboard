/**
 * The page tabs, in order. A plain module so server routes (sitemap), the client nav, the login
 * wall rules (gate.ts) and the analytics page list (track.ts) share one list. Every tab is shown;
 * none is hidden.
 */
export const NAV = [
  { href: "/", label: "Overview" },
  { href: "/sectors/", label: "Sectors" },
  { href: "/traction/", label: "Traction" },
  { href: "/intents/", label: "Intents" },
  { href: "/thesis/", label: "Thesis" },
  { href: "/funding/", label: "Funding" },
  { href: "/investors/", label: "Investors" },
  { href: "/security/", label: "Security" },
  { href: "/explorer/", label: "Explorer" },
  { href: "/compare/", label: "Compare" },
] as const;
