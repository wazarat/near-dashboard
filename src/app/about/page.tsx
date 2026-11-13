import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta("About and methodology", "/about/");

const REPO = "https://github.com/wazarat/near-dashboard";
const LINK = "text-ink-50 underline underline-offset-2 hover:text-electric-300";

const SOURCES: Array<{ name: string; url: string; use: string }> = [
  { name: "NEAR BigQuery public dataset", url: "https://docs.near.org/data-infrastructure/big-query", use: "Daily transactions, active accounts, function calls, contracts called and receipts to aurora and intents.near, from queries/daily_chain.sql and queries/daily_receipts.sql." },
  { name: "NEAR Intents Explorer API", url: "https://docs.near-intents.org/integration/distribution-channels/1click-api/explorer/introduction", use: "Every 1Click swap with its status, USD amounts, route, assets and referral tag." },
  { name: "NearBlocks", url: "https://api.nearblocks.io/v1/charts", use: "Daily NEAR transactions, active and new accounts and price since 2020, and token holders." },
  { name: "DefiLlama", url: "https://defillama.com/docs/api", use: "Chain and protocol TVL, DEX volume, fees and revenue, stablecoins, yields and hacks." },
  { name: "Aurora Blockscout", url: "https://explorer.mainnet.aurora.dev", use: "Aurora daily transactions and token holders." },
  { name: "GeckoTerminal", url: "https://www.geckoterminal.com", use: "24-hour volume and liquidity of each DEX's top pools." },
  { name: "NEAR Catalog", url: "https://nearcatalog.xyz", use: "Newly listed projects and their contract accounts." },
];

/** About and methodology (thesis track): the track, the sources, THESIS.md and the independence statement. Public, outside the tabs. */
export default function Page() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <h1 className="font-display text-title text-ink-50">About and methodology</h1>
        </CardHeader>
        <CardContent className="space-y-3 px-4 text-sm text-ink-300">
          <p className="text-ink-50" data-testid="independence">
            Independent research by CanHav Research, with no affiliation to NEAR Foundation or Aurora. Nothing here is investment advice.
          </p>
          <p>
            NEAR Ecosystem Atlas was built for the{" "}
            <a className={LINK} href="https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/02-thesis.md" target="_blank" rel="noopener noreferrer">
              NEAR Hackathon thesis track
            </a>{" "}
            (
            <a className={LINK} href="https://nearhackathon.com/HACKATHON.md" target="_blank" rel="noopener noreferrer">
              hackathon rules
            </a>
            ). It tests one hypothesis, that cross-chain volume through NEAR Intents is a better leading indicator of real NEAR network usage than the NEAR token price, and reports what the data says, including what cuts against it.
          </p>
          <p>
            The full write-up is{" "}
            <a className={LINK} href={`${REPO}/blob/main/THESIS.md`} target="_blank" rel="noopener noreferrer">
              THESIS.md
            </a>
            , and the same numbers drive the{" "}
            <Link className={LINK} href="/thesis/">
              Thesis page
            </Link>
            . Every number in both is generated from committed raw files by one command, npm run rebuild, so anyone can check it.
          </p>
        </CardContent>
      </Card>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <h2 className="text-card-title text-ink-50">Sources</h2>
        </CardHeader>
        <CardContent className="px-4">
          <ul className="space-y-2 text-sm text-ink-300" data-testid="about-sources">
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

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <h2 className="text-card-title text-ink-50">Method</h2>
        </CardHeader>
        <CardContent className="space-y-3 px-4 text-sm text-ink-300">
          <p>
            Weekly series of NEAR Intents volume, NEAR price and five usage series are turned into week-over-week log changes. Lead and lag correlations at minus 8 to plus 8 weeks show which predictor moves first, a model fitted before May 1, 2026 and scored after it shows which predicts better out of sample, and robustness checks cap or remove the largest days, use daily data, and take Intents settlement receipts out of usage.
          </p>
          <p>
            Blank values are never counted as zero. A metric no free source covers is left out and listed on{" "}
            <Link className={LINK} href="/help-track/" prefetch={false}>
              Help us track this
            </Link>
            . The coverage terms and tier rules are in the Methodology section at the foot of every page.
          </p>
          <p>
            Source code and data are public on{" "}
            <a className={LINK} href={REPO} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>{" "}
            under the MIT license.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
