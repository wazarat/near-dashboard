# NEAR Ecosystem Atlas

Independent research by CanHav Research, built for NEAR Hackathon 2026. Track: `thesis` (Investment Thesis).

Live: https://near-dashboard-puce.vercel.app · Thesis: [`THESIS.md`](THESIS.md) · Submission notes: [`docs/SUBMISSION.md`](docs/SUBMISSION.md)

An atlas of 1,088 projects across NEAR and Aurora with researched traction, funding and security, refreshed daily from free sources: DefiLlama (per-protocol and chain history), NearBlocks (daily chain activity since genesis), the NEAR BigQuery public dataset (function calls, contracts called, distinct signers, receipts to `aurora` and `intents.near`) and the NEAR Intents Explorer API (1Click swap volume, routes, assets, referrals). It tests one hypothesis, that cross-chain volume through NEAR Intents is a better leading indicator of real network usage than the token price, and reports what the data says, for and against, in `THESIS.md` and on `/thesis`.

Not affiliated with, endorsed by or sponsored by the NEAR Foundation, NEAR Protocol or Aurora. Nothing here is investment advice.

## The two commands

```bash
npm run rebuild   # regenerates every chart, table, THESIS.md and the thesis JSON from the committed raw files. No network, no secrets.
npm run refresh   # fetches new raw data from the free sources into data/history and data/raw (some sources need .env.local).
```

## Try it: do X, see Y

```bash
git clone https://github.com/wazarat/near-dashboard.git
cd near-dashboard
npm ci
npm run build        # runs `npm run rebuild`, prints the strict data checks, prerenders every page
npm start            # open http://localhost:3000
```

- Do `npm run build`: see 13 checks pass (1,088 projects, 24 sectors, 6 native chains, 96 leaders, 141 events, 42 rounds, 4 Tier 1 rows, and six USD totals), then the live-vs-snapshot totals, then the thesis summary line (window, cutoff, lead-lag wins, out-of-sample wins, verdict).
- Open `/`: see the KPI tiles, chain over time and chain activity (NearBlocks with the BigQuery overlay), the sector treemap, native vs imported shares, concentration curve, analyst notes and the events timeline.
- Open `/thesis`: see the verdict badge, then one card per test. Click **Query** on any card: see the exact SQL or API call and the transform behind it. The same numbers are in `THESIS.md`.
- Open `/intents`: see 1Click swap volume from the Explorer API next to DefiLlama's all-channel series with the share, plus routes, assets and referrals.
- Run `npm test`: see the unit tests (fixtures only, no live calls). Run `npm run e2e` (it builds for itself): see the Playwright checks at 1440 and 390 px with zero console errors. Run `npm run e2e:wall`: see the login wall as a logged-out reader meets it.
- Run `npm run rebuild` twice: see no diff in `src/data/generated/` or `THESIS.md`.

## Pages

| Page | What it shows |
|---|---|
| `/` Overview | KPI tiles, chain over time (NEAR and Aurora, or the selection's own summed history when a filter is set), chain activity, risers and fallers, sector treemap, native vs imported, concentration curve, live insights and analyst notes, events timeline (table first, each event in a pop-up with its source) |
| `/sectors` | Sector bars, tier by sector, sector cards with ranked leaders |
| `/traction` | Leaderboard with traction, momentum, activity and financials column sets, business-model scatter, activity without TVL, listed vs live by discovery source |
| `/intents` | 1Click swap volume, weekly series, success and refund rates, routes, assets, referrals, coverage against DefiLlama |
| `/thesis` | The claim, verdict and four tests with Chart, Table and Query tabs, confounders, evidence for and against, what would change the conclusion |
| `/funding` | Funding type breakdown (a type opens its projects and rounds in a pop-up), ecosystem money cards, rounds table, rounds over time, financials |
| `/investors` | Investors by deals, portfolios, investor pop-up |
| `/security` | Chain-level checklist for NEAR L1, NEAR Intents and Aurora, security facts by type and by sector (no per-project ratings), incidents as a sortable table |
| `/explorer` | Every column with a column chooser and CSV download of the filtered view, a Map and Table switch (`?view=map` is the sector treemap of the same selection) and its own search box, plus the "Newly detected" review list |
| `/help-track` | Public list of projects whose metric applies but no free source covers yet, grouped by metric, each with a link to suggest a source |
| `/compare` | Up to four projects: metric matrix with sector ranks, ratios, indexed overlay, side-by-side profiles |

Every chart has an info icon naming its source, an empty state, a table view and an Expand button that opens it larger with a range brush and its computed summary as points (Thesis and Intents keep the summary on the card); the thesis and chain-activity charts also have a Query tab. Filters, each chart's own metric and each card's own time range (7d, 30d, 90d or All, under its own key such as `cr` or `hr`), the legacy-listing switch of each card (`legacy`, a list of the cards that include the 620 legacy listings, which are hidden by default), the compare selection, the open project, sector, investor, funding type (`?fundingType=`) or event (`?event=`) pop-up and the expanded chart (`?expand=<id>`) live in the URL, so any view can be shared.

## Data

`data/` holds the research snapshot (the source of truth for who is in the ecosystem; live data only adds metrics):

- `near-ecosystem-2026-11-08.csv` (1,088 projects, 32 columns), `near-sector-leaders-2026-11-08.csv` (96), `near-events-2026-11-08.csv` (141), `near-funding-rounds-2026-11-08.csv` (42), `near-traction-funding-security-2026-11-08.md` (the findings memo).
- `aliases.csv` maps event and round names to project rows; `defillama-map.csv` maps projects to DefiLlama slugs (seeded by `npm run seed:map`, hand-maintained); `contracts.csv` lists tracked NEAR accounts per project (seeded by `npm run seed:contracts`); `expected.json` holds the strict counts and sums the build must reproduce.
- New protocols seen on DefiLlama or NEAR Catalog go to the "Newly detected" list on `/explorer` for review; nothing is added to the project list automatically.

Conventions: blank numeric cells are null, never zero. "Not researched" means a field was never checked; "Unknown" and "Not disclosed" mean it was checked and nothing was found. Summed protocol TVL double counts liquid staking and bridges; DefiLlama's default chain TVL is shown separately. CEX reserves on NEAR are excluded from TVL. Tiers follow the snapshot thresholds (Tier 1: TVL ≥ $50M, 30d volume ≥ $500M or 30d fees ≥ $1M; Tier 2: $5M, $50M or $100K; Tier 3: any measurable activity; "Tracked, negligible": listed but all zero).

### History store

```
data/history/_meta.json                      last run, per-source status, cursors, newly detected list
data/history/chain.json                      NEAR and Aurora chain series (DefiLlama), NearBlocks daily series, BigQuery daily series, price cross-checks
data/history/defillama/protocols.json        trimmed listing of every protocol on NEAR or Aurora
data/history/defillama/tvl-{near,aurora}.json                         slug -> [date, usd]
data/history/defillama/{volume,fees,revenue,holders-revenue,supply-side-revenue,aggregators}-{near,aurora}.json   display name -> [date, usd]
data/history/bigquery/{receivers,project-activity}.json   per-account and per-project [date, calls, signers]
data/raw/bigquery/*.csv                      query results, one file per query and 14-day window
data/raw/intents/daily/YYYY-MM-DD.json       committed per-day aggregates of 1Click swaps (volume, statuses, routes, assets, referrals, row count, hash)
data/raw/intents/days/YYYY-MM-DD.json.gz     trimmed swap rows (gitignored; regenerable from the API)
data/raw/{nearblocks,catalog,llama}/*.json   raw NearBlocks charts, NEAR Catalog listing, DefiLlama price
```

The store is idempotent: a second refresh with the same upstream data changes no file. Only the last three days of a series may be revised; older points are frozen.

## Sources (all free)

| Source | Used for | Limits and notes |
|---|---|---|
| DefiLlama `api.llama.fi` | protocol list, per-chain TVL, chain overviews for DEX volume, fees, revenue, aggregators, chain TVL | no key; the client spaces requests 1 s apart |
| DefiLlama `coins.llama.fi` | daily NEAR price cross-check | 500 points per call |
| NearBlocks `api.nearblocks.io/v1/charts` | daily transactions, active and new accounts, contracts, price, market cap since 2020-07-21 | no key |
| NEAR Catalog `api.nearcatalog.xyz` | newly detected projects, contract account ids | no key |
| NEAR BigQuery `bigquery-public-data.crypto_near_mainnet_us` | daily chain activity and per-account function calls and signers | your own GCP project; every query filters on `block_date`, dry-runs first, is capped by `maximumBytesBilled` (20 GB default) and the backfill stops at 300 GB; the 365-day backfill scanned 244 GB |
| NEAR Intents Explorer API | 1Click swap rows | partner JWT, 1 request per 5 s, 1,000 rows per page; covers 1Click swaps only, from late May 2025 |

Deferred (paid): DefiLlama `/raises`, `/emissions` and `/summary/derivatives/*` (HTTP 402), Dune API, Token Terminal, Artemis, Nansen, Flipside API, RootData, CryptoRank, the X API. Consequences: no incentive or emissions data, no third-party raises feed, no X metrics.

## Setup with secrets (optional)

Copy `.env.example` to `.env.local`:

- `GCP_PROJECT_ID`: BigQuery runs with Application Default Credentials (`gcloud auth application-default login`); no key file is needed or supported.
- `NEAR_INTENTS_JWT`: Explorer-type key from https://partners.near-intents.org. Without it the Intents source is skipped and DefiLlama's NEAR Intents series stands in, labelled.
- `COINGECKO_DEMO_KEY`: optional price fallback.
- `NEXT_PUBLIC_TALLY_SUBMIT_URL`, `NEXT_PUBLIC_TALLY_CORRECT_URL`: the community forms; buttons stay hidden while unset.
- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SIBLING_ATLAS_URL`: the public origin (canonical URLs, Open Graph, sitemap) and the footer link to the Robinhood Chain atlas. See "Design system and domain" below.

A missing secret skips that source and records the reason in `data/history/_meta.json`; the site always builds.

## Daily refresh and backfills

`.github/workflows/refresh.yml` runs at 03:23 UTC: `npm run refresh`, `npm run rebuild`, `npm test`, `npm run build`, then commits `data/history`, `data/raw` and `THESIS.md` when they changed, authored as Wazarat Hussain. BigQuery authenticates with Workload Identity Federation. To rerun a backfill: Actions, Refresh data, Run workflow with `backfill` ticked, or locally `npm run refresh -- --backfill` (`--only a,b`, `--max-calls N`, `--dry-run`). Details, the federation setup and the required repository secrets are in [`docs/OPERATIONS.md`](docs/OPERATIONS.md). Community corrections: [`docs/REVIEW.md`](docs/REVIEW.md).

## Thesis method in one paragraph

Weekly ISO-week series of Intents volume (DefiLlama, all channels, since 2024-12-10; the 1Click Explorer series where backfilled), NEAR price (NearBlocks) and five usage series (transactions, active accounts, new accounts from NearBlocks; function calls and contracts called from BigQuery) are turned into week-over-week log changes. Lead-lag cross-correlations at −8 to +8 weeks say which predictor moves first; a one-variable regression fitted before 2026-05-01 and scored after it says which predicts better out of sample; robustness variants cap spikes, remove Intents settlement receipts from usage, use daily data and swap in the Explorer series. Only positive lead correlations outside the ±2/√n noise band count as evidence. `scripts/thesis.ts` computes all of it and renders `THESIS.md` from `docs/templates/THESIS.template.md`, so the page and the document cannot drift.

## Disclosure

The architecture (store raw data by source key and join at build time, prerendered pages, daily GitHub Action, idempotent history store, fixtures-based tests, generic data table, chart cards with a table view, URL state) follows my earlier Robinhood Chain Ecosystem Atlas. This repository was written fresh for NEAR Hackathon 2026. On Nov 11, 2026 the header lockup, the login wall, the analytics event rules, the shared detail modal and the one-line chart axis were ported from that atlas, where I wrote them between Nov 9 and Nov 11; the two sites hold their own copies and share nothing at runtime except the login. All code in this repository was written during the hackathon window.

## Login and analytics

One Clerk application serves canhav.com and the atlases, so a login on one is a login on all. With `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` set, Overview, Thesis, the footer methodology and a comparison already in the URL stay open; Sectors, Traction, Intents, Funding, Investors, Security and Explorer ask for a free login over a blurred preview, and a shared project link shows its header, Overview and Traction. The rules are one table in `src/lib/gate.ts`. Without the keys the wall is off, which is how local runs and CI work. The wall gates in the browser only; this repository and its data are public.

Vercel Web Analytics counts page views and thirteen custom events (`src/lib/track.ts`), such as a tab view, a project opened by sector, a chart expanded, a filter used and a login prompt shown. Every property comes from a closed set, so no name, account, investor, URL or typed text is sent, and the script loads only on Vercel.

## Design system and domain

The site follows the shared CanHav Atlas UI standard in [`docs/ATLAS-UI.md`](docs/ATLAS-UI.md), the same contract the Robinhood Chain atlas uses, with the tokens from the canhav.dev design system. Fonts (Inter, Space Grotesk, JetBrains Mono) are self-hosted latin variable cuts under the SIL Open Font License (`src/app/fonts/LICENSE.txt`), so a build needs no network. `npm run check:copy` fails CI when a user-facing string carries an em dash or a colon. `npm run check:data` fails CI, and stops the daily refresh before it commits, when two sources for the same headline disagree by more than 10% or a chain's gas fees go missing for more than three days while it still has transactions (`src/lib/data-checks.ts`). Which metrics each sector carries, and whether a value is current, zero by design, not applicable, not tracked or inactive, lives in `src/lib/sector-metrics.ts`; `docs/LIVE-DATA.md` is the spec it follows. The chart palette is built from the brand hues; `docs/UI-PASS.md` records the pass and the differences kept on purpose.

Planned domain: `near.canhav.com` (the Robinhood atlas is at `robinhood.canhav.com`). To move this project there:

1. In Vercel, Project, Settings, Domains, add `near.canhav.com` (its CNAME already points at Vercel).
2. In the project's Production environment set `NEXT_PUBLIC_SITE_URL=https://near.canhav.com` and `NEXT_PUBLIC_SIBLING_ATLAS_URL=https://robinhood.canhav.com`, so canonical URLs, the Open Graph card, `sitemap.xml` and the footer link follow.
3. To turn the login wall on, add the two Clerk keys to the same environment and redeploy. Clerk's production keys only work on canhav.com, so from that deploy on every `vercel.app` host redirects to `near.canhav.com` (`next.config.ts`).
4. Update the live URL at the top of this file and in `docs/SUBMISSION.md`.

Until then the public origin is the Vercel URL above, set through the same two variables. `public/og.png` is rendered once by `npx tsx scripts/og-image.ts` (Playwright) from the committed data and committed.

## Libraries

Next.js, React, Tailwind CSS, shadcn/ui, Recharts, TanStack Table, nuqs, Papa Parse, Clerk, Vercel Web Analytics, @google-cloud/bigquery (scripts only), Vitest, Playwright, tsx.

## License

MIT. See `LICENSE`.
