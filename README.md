# NEAR Ecosystem Atlas

Independent research by CanHav Research, built for NEAR Hackathon 2026 (track: `thesis`, Investment Thesis).

An atlas of 1,088 projects in the NEAR and Aurora ecosystem with traction, funding and security research, daily history from free sources, chain activity from NearBlocks and the NEAR BigQuery public dataset, and NEAR Intents cross-chain volume. It also tests one hypothesis: that cross-chain volume through NEAR Intents is a better leading indicator of real network usage than token price. The result, for and against, lives in `THESIS.md` and on the `/thesis` page once that milestone lands.

Not affiliated with, endorsed by or sponsored by the NEAR Foundation, NEAR Protocol or Aurora. Nothing here is investment advice.

## Two commands

```bash
npm run rebuild   # regenerates every chart, table and THESIS.md from the committed raw files. No network, no secrets.
npm run refresh   # fetches new raw data from the free sources into data/history and data/raw (needs .env.local for some sources).
```

## Try it

```bash
git clone https://github.com/wazarat/near-dashboard.git
cd near-dashboard
npm ci
npm run build      # runs `npm run rebuild` first, validates the data, writes the static site to out/
npx serve out      # open http://localhost:3000
```

Do this and you should see the Overview with 1,088 projects, 24 sectors and summed TVL of $537.7M from the Nov 8, 2026 research snapshot. `npm test` runs the unit tests (fixtures only, no live calls). `npm run e2e` runs the Playwright page checks against `out/` at 1440 and 390 px.

## Pages

| Page | What it shows |
|---|---|
| `/` Overview | KPI tiles, sector treemap, native vs imported shares, concentration curve, live insights and the research memo's analyst notes, the events timeline |
| `/sectors` | Sector bars, tier by sector, sector cards with ranked leaders |
| `/traction` | Leaderboard with column sets, business-model scatter (fees vs revenue with capture lines), listed vs live by discovery source |
| `/funding` | Funding type breakdown, ecosystem money cards, rounds table, rounds over time |
| `/security` | Chain-level checklist for NEAR L1, NEAR Intents and Aurora, incident timeline, risk breakdown, High and Medium table |
| `/explorer` | Every column with a column chooser and CSV download of the filtered view, plus a "Newly detected" review list |
| `/intents`, `/thesis`, `/investors`, `/compare` | Added in later milestones |

Every chart has a one-line takeaway, an info icon naming its source, an empty state and a table view. Filters, metric, range and the open drawer live in the URL, so any view can be shared.

## Data

`data/` holds the research snapshot (source of truth for who is in the ecosystem):

- `near-ecosystem-2026-11-08.csv` (1,088 projects, 32 columns), `near-sector-leaders-2026-11-08.csv` (96), `near-events-2026-11-08.csv` (141), `near-funding-rounds-2026-11-08.csv` (42), `near-traction-funding-security-2026-11-08.md` (the findings memo).
- `aliases.csv` maps event and round names to project rows. `expected.json` holds the strict counts and sums the build must reproduce (1,088 / 24 / 6 / 96 / 141 / 42 / 4 and six USD totals); any difference fails the build.

Blank numeric cells are null, never zero. "Not researched" means a field was never checked; "Unknown" and "Not disclosed" mean it was checked and nothing was found. Summed protocol TVL double counts liquid staking and bridges; DefiLlama's default chain TVL (NEAR $174.9M, Aurora $3.8M on Nov 8, 2026) is shown separately. CEX reserves on NEAR are excluded from TVL.

## Sources (all free)

| Source | Used for | Limits |
|---|---|---|
| DefiLlama `api.llama.fi` | protocol list, per-chain TVL, chain overviews for DEX volume, fees, revenue, aggregators, chain TVL | no key, 1 request/s in our client |
| DefiLlama `coins.llama.fi` | daily NEAR price cross-check | 500 points per call |
| NearBlocks `api.nearblocks.io/v1/charts` | daily transactions, active and new accounts, contracts, price, market cap since genesis | no key |
| NEAR Catalog `api.nearcatalog.xyz` | newly detected projects, contract account ids | no key |
| NEAR BigQuery `bigquery-public-data.crypto_near_mainnet_us` | per-day chain and per-contract activity | your own GCP project; every query filters on `block_date`, dry-runs first and is capped by `maximumBytesBilled` |
| NEAR Intents Explorer API | 1Click swap rows (volume, routes, assets, referrals) | partner JWT, 1 request per 5 s |

Deferred (paid): DefiLlama `/raises`, `/emissions` and `/summary/derivatives/*` (HTTP 402), Dune API, Token Terminal, Artemis, Nansen, Flipside API, RootData, CryptoRank, the X API.

## Operations

The daily GitHub Action, the Workload Identity Federation setup for BigQuery, how to rerun a backfill and the history store layout are documented in `docs/OPERATIONS.md`.

## Setup with secrets (optional)

Copy `.env.example` to `.env.local`. Locally, BigQuery uses Application Default Credentials (`gcloud auth application-default login`); no key file is needed or supported. In GitHub Actions the workflow authenticates with Workload Identity Federation. Sources whose secret is missing are skipped and logged in `data/history/_meta.json`; the site still builds.

## Disclosure

The architecture (store raw data by source key and join at build time, static export, daily GitHub Action, idempotent history store, fixtures-based tests, generic data table, chart cards with a table view, URL state) follows my earlier Robinhood Chain Ecosystem Atlas. This repository was written fresh for NEAR Hackathon 2026 and shares no code at runtime.

## Libraries

Next.js, React, Tailwind CSS, shadcn/ui, Recharts, TanStack Table, nuqs, Papa Parse, @google-cloud/bigquery (scripts only), Vitest, Playwright, tsx.

## License

MIT. See `LICENSE`.
