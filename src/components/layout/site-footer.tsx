import { meta } from "@/lib/data";
import { fmtUsdFull } from "@/lib/format";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t bg-background">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <h2 id="methodology" className="text-base font-semibold text-foreground">
          Methodology
        </h2>
        <div className="mt-3 grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <p>
              <strong className="text-foreground">Universe.</strong> {meta.counts.projects} projects across {meta.counts.sectors} sectors, assembled from NEAR Catalog (all 344
              projects via its API), AwesomeNEAR (789 of 1,093 listings), the Aurora ecosystem page, the near.org ecosystem page, DefiLlama and news research. Every row
              carries the URL it was found at. The CSVs are the source of truth for membership; live data only adds metrics.
            </p>
            <p>
              <strong className="text-foreground">Traction.</strong> TVL, 30-day DEX volume, 30-day fees and 30-day revenue come from the DefiLlama API.{" "}
              {meta.live
                ? `${meta.counts.liveProjects} projects refresh daily from DefiLlama's history (window ending ${meta.asOfLabel}); the rest keep the ${meta.snapshotAsOfLabel} research snapshot.`
                : `Pulled ${meta.asOfLabel}.`}{" "}
              Blank cells mean DefiLlama lists no figure; they are treated as missing, never as zero. Tiers follow the snapshot thresholds: Tier 1 means TVL at or above $50M,
              30-day volume at or above $500M, or 30-day fees at or above $1M; Tier 2 means $5M, $50M or $100K; Tier 3 any measurable activity; &ldquo;Tracked, negligible&rdquo;
              means a DefiLlama listing exists but every figure is zero.
            </p>
            <p>
              <strong className="text-foreground">TVL overlap.</strong> Summed protocol TVL double counts liquid staking and bridges compared with DefiLlama&apos;s default chain
              TVL, which excludes them. CEX reserves held on NEAR (Binance alone held about $522M on {meta.snapshotAsOfLabel}) are excluded from TVL and kept as an
              &ldquo;Other traction signal&rdquo;.
            </p>
            <p>
              <strong className="text-foreground">Chain activity and NEAR Intents.</strong> Daily transactions, active accounts and new accounts come from NearBlocks and the NEAR
              BigQuery public dataset (<code className="text-xs">bigquery-public-data.crypto_near_mainnet_us</code>). Intents volume comes from DefiLlama&apos;s NEAR Intents adapter
              and, where a partner JWT is present, from the NEAR Intents Explorer API, which covers 1Click swaps only.
            </p>
          </div>
          <div className="space-y-2">
            <p>
              <strong className="text-foreground">Funding and security.</strong> Researched for 75 projects (funding) and 27 projects plus both chains (security).{" "}
              <em>Not researched</em> means the field was never checked. <em>Unknown</em> or <em>Not disclosed</em> means it was checked and nothing was found. Unknown risk
              means no audit was found, not that the project is unaudited.
            </p>
            <p>
              <strong className="text-foreground">Status.</strong> 620 listings come only from the 2021 to 2023 AwesomeNEAR directory, which marks everything active, so they
              carry &ldquo;Unknown (legacy 2021-23 listing)&rdquo;. &ldquo;Defunct (DefiLlama dead URL)&rdquo; marks protocols whose DefiLlama page no longer resolves.
            </p>
            <p>
              <strong className="text-foreground">Confidence.</strong> Native-chain classification for directory-only rows is heuristic and carries its own confidence flag. Funding
              rounds whose confidence is not &ldquo;Sourced&rdquo; are muted and tagged. Every project drawer lists its sources.
            </p>
            <p>
              <strong className="text-foreground">Totals in this build.</strong> Summed TVL {fmtUsdFull(meta.totals.tvl)} (NEAR {fmtUsdFull(meta.totals.tvlNear)}, Aurora{" "}
              {fmtUsdFull(meta.totals.tvlAurora)}), 30d volume {fmtUsdFull(meta.totals.volume)}, 30d fees {fmtUsdFull(meta.totals.fees)}, 30d revenue{" "}
              {fmtUsdFull(meta.totals.revenue)}.
            </p>
          </div>
        </div>
        <p className="mt-6 text-xs">
          NEAR Ecosystem Atlas is independent research published by CanHav Research for NEAR Hackathon 2026 (track: Investment Thesis). It is not affiliated with, endorsed by or
          sponsored by the NEAR Foundation, NEAR Protocol or Aurora. Nothing here is investment advice. Source code and data:{" "}
          <a href="https://github.com/wazarat/near-dashboard" className="underline underline-offset-2 hover:text-foreground" target="_blank" rel="noopener noreferrer">
            github.com/wazarat/near-dashboard
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
