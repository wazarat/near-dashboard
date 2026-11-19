import type { Metadata } from "next";
import Link from "next/link";
import { AnchorCard } from "@/components/methodology/anchor-card";
import { MethodologySections } from "@/components/methodology/methodology-sections";
import { SecuritySection } from "@/components/methodology/security-section";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { anchorData } from "@/lib/data";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta("Methodology", "/methodology/");

const REPO = "https://github.com/wazarat/near-dashboard";
const LINK = "text-ink-50 underline underline-offset-2 hover:text-electric-300";

const SOURCES: Array<{ name: string; url: string; use: string }> = [
  { name: "NEAR BigQuery public dataset", url: "https://docs.near.org/data-infrastructure/big-query", use: "Daily transactions, active accounts, function calls, contracts called and receipts to aurora and intents.near, from queries/daily_chain.sql and queries/daily_receipts.sql." },
  { name: "NEAR Intents Explorer API", url: "https://docs.near-intents.org/integration/distribution-channels/1click-api/explorer/introduction", use: "Every 1Click swap with its status, USD amounts, route, assets and referral tag." },
  { name: "NearBlocks", url: "https://api.nearblocks.io/v1/charts", use: "Daily NEAR transactions, active and new accounts and price since 2020, and token holders." },
  { name: "DefiLlama", url: "https://defillama.com/docs/api", use: "Chain and protocol TVL, DEX volume, fees and revenue, stablecoins, yields and hacks." },
  { name: "NEAR RPC", url: "https://docs.near.org/api/rpc/introduction", use: "NEAR staked with each validator pool in the current epoch." },
  { name: "Aurora Blockscout", url: "https://explorer.mainnet.aurora.dev", use: "Aurora daily transactions and token holders." },
  { name: "GeckoTerminal", url: "https://www.geckoterminal.com", use: "24-hour volume and liquidity of each DEX's top pools." },
  { name: "NEAR Catalog", url: "https://nearcatalog.xyz", use: "Newly listed projects and their contract accounts." },
];

/**
 * The Methodology tab, as on the other CanHav atlases: who made this and on what terms, the sources, the coverage
 * and counting rules, the security record (behind the login) and the onchain anchor of the evidence.
 */
export default function Page() {
  return (
    <div className="space-y-6">
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <h1 className="font-display text-title text-ink-50">Methodology</h1>
        </CardHeader>
        <CardContent className="max-w-3xl space-y-3 px-4 text-sm text-ink-300">
          <p className="text-ink-50" data-testid="independence">
            Independent research by CanHav Research, with no affiliation to NEAR Foundation or Aurora. Nothing here is investment advice.
          </p>
          <p>
            NEAR Ecosystem Atlas maps the NEAR and Aurora ecosystem and refreshes daily from free sources. It began as an entry to the{" "}
            <a className={LINK} href="https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/02-thesis.md" target="_blank" rel="noopener noreferrer">
              NEAR Hackathon thesis track
            </a>
            , which tested whether NEAR Intents volume leads NEAR network usage better than the NEAR token price. That write-up, with every test and what cuts against it, is{" "}
            <a className={LINK} href={`${REPO}/blob/main/THESIS.md`} target="_blank" rel="noopener noreferrer">
              THESIS.md
            </a>
            , rebuilt from committed raw files by one command, npm run rebuild.
          </p>
          <p>
            Blank values are never counted as zero. A metric no free source covers is left out and listed on{" "}
            <Link className={LINK} href="/help-track/" prefetch={false}>
              Help us track this
            </Link>
            . Source code and data are public on{" "}
            <a className={LINK} href={REPO} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>{" "}
            under the MIT license.
          </p>
        </CardContent>
      </Card>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <h2 className="text-card-title text-ink-50">Coverage terms and counting rules</h2>
        </CardHeader>
        <CardContent className="px-4">
          <MethodologySections />
        </CardContent>
      </Card>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <h2 className="text-card-title text-ink-50">Sources</h2>
        </CardHeader>
        <CardContent className="px-4">
          <ul className="space-y-2 text-sm text-ink-300" data-testid="methodology-sources">
            {SOURCES.map((s) => (
              <li key={s.name}>
                <a className={LINK} href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.name}
                </a>
                . {s.use}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-300">
            Every free source is listed with its limits in the{" "}
            <a className={LINK} href={`${REPO}#sources-all-free`} target="_blank" rel="noopener noreferrer">
              README
            </a>
            . The SQL files are in{" "}
            <a className={LINK} href={`${REPO}/tree/main/queries`} target="_blank" rel="noopener noreferrer">
              queries
            </a>
            , and each chart on the site has a How this is calculated block with its query and endpoint.
          </p>
        </CardContent>
      </Card>

      <SecuritySection />

      <section id="verified" aria-label="Verified on NEAR" className="scroll-mt-24 space-y-3">
        <p className="max-w-3xl text-sm text-ink-300">
          Every daily refresh anchors the evidence on NEAR mainnet. It hashes each committed raw file and each file the rebuild writes with SHA-256, folds them into two
          fingerprints, and writes those with the date and the commit to NEAR SocialDB under canhav.near, signed by a key that can only call set on social.near.
        </p>
        <AnchorCard data={anchorData} />
      </section>
    </div>
  );
}
