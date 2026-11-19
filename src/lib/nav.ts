/**
 * The page tabs, in order. A plain module so server routes (sitemap), the client nav, the login
 * wall rules (gate.ts) and the analytics page list (track.ts) share one list. Every tab is shown;
 * none is hidden. The same seven tabs as the other CanHav atlases (Arbitrum, Base, Robinhood), plus Intents, which only
 * NEAR has. Investors sits on Funding and Security on Methodology; the old URLs redirect (next.config.ts).
 */
export const NAV = [
  { href: "/", label: "Overview" },
  { href: "/sectors/", label: "Sectors" },
  { href: "/traction/", label: "Traction" },
  { href: "/intents/", label: "Intents" },
  { href: "/funding/", label: "Funding" },
  { href: "/explorer/", label: "Explorer" },
  { href: "/compare/", label: "Compare" },
  { href: "/methodology/", label: "Methodology" },
] as const;
