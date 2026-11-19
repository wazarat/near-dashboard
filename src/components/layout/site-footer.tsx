import Link from "next/link";
import { DataFreshness } from "@/components/atlas/data-freshness";

const LINK = "underline-offset-2 hover:text-ink-50 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60";

/** The other CanHav chain atlases, linked from every footer as theirs link to this one. */
const SIBLINGS = [
  { href: "https://arbitrum.canhav.com", label: "arbitrum.canhav.com" },
  { href: "https://base.canhav.com", label: "base.canhav.com" },
  { href: "https://robinhood.canhav.com", label: "robinhood.canhav.com" },
];

/**
 * Page frame footer, as on the other CanHav atlases: "Data as of", the sources, the disclaimer, and links to the
 * Methodology tab, the sibling atlases and canhav.com. The methodology itself lives on its own tab.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-ink-700/40">
      <div className="mx-auto w-full max-w-atlas px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 text-label text-ink-300 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl space-y-2">
            <DataFreshness />
            <p>Sources. DefiLlama (protocols, fees, stablecoins, yields, hacks), NearBlocks, Aurora Blockscout, GeckoTerminal, NEAR Catalog, the NEAR Intents Explorer API, the NEAR BigQuery public dataset and the CanHav research CSVs committed in the repository.</p>
            <p>Independent research by CanHav Research, built for NEAR Hackathon 2026. Not affiliated with, endorsed by or sponsored by the NEAR Foundation, NEAR Protocol or Aurora.</p>
            <p className="text-ink-50">Research preview, not financial advice.</p>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 md:flex-col md:gap-y-2">
            <li>
              <Link href="/methodology/" prefetch={false} className={LINK}>
                Methodology
              </Link>
            </li>
            <li>
              <Link href="/help-track/" prefetch={false} className={LINK}>
                Help us track this
              </Link>
            </li>
            {SIBLINGS.map((a) => (
              <li key={a.href}>
                <a href={a.href} className={LINK} target="_blank" rel="noopener noreferrer">
                  {a.label}
                </a>
              </li>
            ))}
            <li>
              <a href="https://canhav.com" className={LINK} target="_blank" rel="noopener noreferrer">
                canhav.com
              </a>
            </li>
            <li>
              <a href="https://github.com/wazarat/near-dashboard" className={LINK} target="_blank" rel="noopener noreferrer">
                Source code and data
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
