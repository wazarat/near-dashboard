import { DataFreshness } from "@/components/atlas/data-freshness";
import { meta } from "@/lib/data";
import { SIBLING_ATLAS_URL } from "@/lib/env";
import { fmtUsdFull } from "@/lib/format";

const LINK = "underline-offset-2 hover:text-ink-50 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60";

/**
 * Page frame footer (standard section 3): the Methodology block, then "Data as
 * of", the sources, the disclaimer and the links to the sibling atlas and canhav.com.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-ink-700/40">
      <div className="mx-auto w-full max-w-atlas px-5 py-10 sm:px-6 lg:px-8">
        <section id="methodology" aria-labelledby="methodology-title" className="text-sm text-ink-300">
          <h2 id="methodology-title" className="text-title">
            Methodology
          </h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <p>
                <strong className="font-medium text-ink-50">Universe.</strong> {meta.counts.projects} projects across {meta.counts.sectors} sectors, assembled from NEAR Catalog (all 344
                projects via its API), AwesomeNEAR (789 of 1,093 listings), the Aurora ecosystem page, the near.org ecosystem page, DefiLlama and news research. Every row
                carries the URL it was found at. The CSVs are the source of truth for membership; live data only adds metrics.
              </p>
              <p>
                <strong className="font-medium text-ink-50">Traction.</strong> TVL, 30-day DEX volume, 30-day fees and 30-day revenue come from the DefiLlama API.{" "}
                {meta.live
                  ? `${meta.counts.liveProjects} projects refresh daily from DefiLlama's history (window ending ${meta.asOfLabel}); the rest keep the ${meta.snapshotAsOfLabel} research snapshot.`
                  : `Pulled ${meta.asOfLabel}.`}{" "}
                Tiers follow the snapshot thresholds. Tier 1 means TVL at or above $50M, 30-day volume at or above $500M, or 30-day fees at or above $1M; Tier 2 means $5M, $50M or
                $100K; Tier 3 any measurable activity; &ldquo;Tracked, negligible&rdquo; means a DefiLlama listing exists but every figure is zero; a project DefiLlama does not track yet reads &ldquo;TBD&rdquo;.
              </p>
              <p>
                <strong className="font-medium text-ink-50">Coverage terms.</strong> <em>Not tracked</em> means DefiLlama does not report that metric for the project. It is a coverage
                gap, not a zero and not unverified data, so blank cells are left out of every sum. <em>Not researched</em> means the field was never checked. <em>Not disclosed</em> and{" "}
                <em>Unknown</em> mean it was checked and nothing was found.
              </p>
              <p>
                <strong className="font-medium text-ink-50">TVL overlap.</strong> Summed protocol TVL double counts liquid staking and bridges compared with DefiLlama&apos;s default
                chain TVL, which excludes them. CEX reserves held on NEAR (Binance alone held about $522M on {meta.snapshotAsOfLabel}) are excluded from TVL and kept as an
                &ldquo;Other traction signal&rdquo;.
              </p>
            </div>
            <div className="space-y-3">
              <p>
                <strong className="font-medium text-ink-50">Chain activity and NEAR Intents.</strong> Daily transactions, active accounts and new accounts come from NearBlocks and
                the NEAR BigQuery public dataset (<code className="font-mono text-xs text-ink-50">bigquery-public-data.crypto_near_mainnet_us</code>). Intents volume comes from
                DefiLlama&apos;s NEAR Intents adapter and, where a partner JWT is present, from the NEAR Intents Explorer API, which covers 1Click swaps only.
              </p>
              <p>
                <strong className="font-medium text-ink-50">Funding and security.</strong> Researched for 75 projects (funding) and 27 projects plus both chains (security). Security
                facts are shown as found (audits, dated incidents, noted red flags) without a rating. &ldquo;No published audit found&rdquo; means none was found in the sources checked,
                not that the project is unaudited.
              </p>
              <p>
                <strong className="font-medium text-ink-50">Status.</strong> 620 listings come only from the 2021 to 2023 AwesomeNEAR directory, which marks everything active, so
                they read &ldquo;Legacy listing, status unverified&rdquo;. &ldquo;Defunct&rdquo; marks protocols whose DefiLlama page no longer resolves.
              </p>
              <p>
                <strong className="font-medium text-ink-50">Confidence.</strong> Native-chain classification for directory-only rows is heuristic and carries its own confidence flag.
                Funding rounds whose confidence is not &ldquo;Sourced&rdquo; are muted and labelled. Every project drawer lists its sources.
              </p>
              <p>
                <strong className="font-medium text-ink-50">Totals in this build.</strong> Summed TVL {fmtUsdFull(meta.totals.tvl)} (NEAR {fmtUsdFull(meta.totals.tvlNear)}, Aurora{" "}
                {fmtUsdFull(meta.totals.tvlAurora)}), 30d volume {fmtUsdFull(meta.totals.volume)}, 30d fees {fmtUsdFull(meta.totals.fees)}, 30d revenue{" "}
                {fmtUsdFull(meta.totals.revenue)}.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-10 flex flex-col gap-6 border-t border-ink-700/40 pt-6 text-label text-ink-300 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl space-y-2">
            <DataFreshness />
            <p>Sources. DefiLlama, NearBlocks, NEAR Catalog, the NEAR Intents Explorer API, the NEAR BigQuery public dataset and the CanHav research CSVs committed in the repository.</p>
            <p>Independent research by CanHav Research, built for NEAR Hackathon 2026. Not affiliated with, endorsed by or sponsored by the NEAR Foundation, NEAR Protocol or Aurora.</p>
            <p className="text-ink-50">Research preview, not financial advice.</p>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 md:flex-col md:gap-y-2">
            <li>
              <a href="#methodology" className={LINK}>
                Methodology
              </a>
            </li>
            {SIBLING_ATLAS_URL && (
              <li>
                <a href={SIBLING_ATLAS_URL} className={LINK} target="_blank" rel="noopener noreferrer">
                  Robinhood Chain atlas
                </a>
              </li>
            )}
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
