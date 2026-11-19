import { meta, projects } from "@/lib/data";
import { fmtUsdFull } from "@/lib/format";

/** Directory-only listings whose status is still unverified (validators with a live pool were promoted on 2026-11-13). */
const LEGACY_LISTINGS = projects.filter((p) => p.statusGroup === "Legacy listing").length;

/** The coverage terms, tier rules and counting rules, on the Methodology tab (they used to sit in the page footer). */
export function MethodologySections() {
  return (
      <div className="grid gap-6 text-sm text-ink-300 md:grid-cols-2" data-testid="methodology-terms">
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
            <strong className="font-medium text-ink-50">Sector leaders.</strong> One rule ranks leaders on the sector cards, in the sector pop-up and on the Traction tab.
            Active projects whose headline metric is at least 1% of the sector&apos;s top value come first, highest first; the rest follow in research rank. Sectors with no
            traction headline rank by a fact where one exists (NEAR Intents volume routed for wallets, assets held on NEAR for exchanges, NEAR staked for validators) and
            otherwise by research rank. Defunct and Inactive projects are never ranked, and sector totals use the same set as the leaders.
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
            <strong className="font-medium text-ink-50">Status.</strong> {LEGACY_LISTINGS.toLocaleString("en-US")} listings come only from the 2021 to 2023 AwesomeNEAR directory, which marks everything active, so
            they read &ldquo;Legacy listing, status unverified&rdquo;. They are left out of every card by default; a card whose counts they change has its own &ldquo;Include legacy&rdquo; switch. &ldquo;Defunct&rdquo; marks protocols whose DefiLlama page no longer resolves.
          </p>
          <p>
            <strong className="font-medium text-ink-50">Confidence.</strong> Native-chain classification for directory-only rows is heuristic and carries its own confidence flag.
            Funding rounds whose confidence is not &ldquo;Sourced&rdquo; are muted and labelled. Every project pop-up lists its sources.
          </p>
          <p>
            <strong className="font-medium text-ink-50">Totals in this build.</strong> Summed TVL {fmtUsdFull(meta.totals.tvl)} (NEAR {fmtUsdFull(meta.totals.tvlNear)}, Aurora{" "}
            {fmtUsdFull(meta.totals.tvlAurora)}), 30d volume {fmtUsdFull(meta.totals.volume)}, 30d fees {fmtUsdFull(meta.totals.fees)}, 30d revenue{" "}
            {fmtUsdFull(meta.totals.revenue)}.
          </p>
        </div>
      </div>
  );
}
