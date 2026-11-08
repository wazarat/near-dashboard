# Robinhood Chain Ecosystem Atlas v2 — plan

(v1 shipped: six pages, drawer, URL filters, validated build, 28 unit tests, 18 Playwright checks; live at robinhoodchain-dashboard.vercel.app, repo wazarat/robinhoodchain-dashboard, Vercel auto-deploys from `main`.)

## Context

v1 is a single Nov 7, 2026 snapshot. v2 turns it into a self-updating dashboard with history back to launch, using only free sources, and adds: history + momentum, chain users + per-project activity, a stock-token page, free-source financials + an investors page, a compare mode, and two Tally forms with a review workflow. The CSVs stay the source of truth for membership; live data only adds metrics. Site stays a static export; all fetching happens in scripts and a daily GitHub Action that commits `data/history` and pushes, which triggers the existing Vercel deploy.

User decisions for this round:
- Do **not** stop between milestones; verify each myself (build, tests, dev server, screenshots) and keep going. Stop only for things that need the user (API keys, form links).
- Blockscout API key exists on the user's side (will be placed in `.env.local` and Vercel); CoinGecko key deferred. Funding rounds CSV is already in `data/`.
- Commits authored as Wazarat only, no Claude attribution anywhere (also applies to the Action's commits: author `Wazarat Hussain <wazarat100@gmail.com>`, the same identity as the existing commits).
- Hosting: README section only (Vercel Pro vs Cloudflare Pages + ready config); no hosting change.
- Shelved per brief: risk score, ecosystem map export, weekly "what changed" page.

## Verified source probes (2026-11-08, curl, read-only)

| Source | Endpoint | Result |
|---|---|---|
| DefiLlama | `/protocols` | 200, 9.5 MB, 8,965 protocols; **309** list "Robinhood Chain" in `chains`; has `slug`, `name`, `parentProtocol`, `category`, `chainTvls["Robinhood Chain"]`, `address` (often `robinhood:0x…`) |
| DefiLlama | `/protocol/{slug}` | 200; `chainTvls["Robinhood Chain"].tvl = [{date, totalLiquidityUSD}]` daily (130 days for uniswap-v3). Only per-protocol TVL history → one call per mapped slug |
| DefiLlama | `/overview/dexs/Robinhood Chain?excludeTotalDataChart=true` | 200; `totalDataChartBreakdown = [[ts, {"Uniswap V3": v, …}]]`, 145 days from 2026-06-10, 60 protocols on the last day. **One call = every protocol's daily volume on the chain** (keyed by display name) |
| DefiLlama | `/overview/fees/Robinhood Chain?dataType=dailyFees` / `dailyRevenue` | 200; same shape; 114 protocols from 2026-06-02 / 100 from 2026-06-28. `dailyHoldersRevenue`, `dailySupplySideRevenue` also work (verified on `/summary/fees/uniswap`) |
| DefiLlama | `/summary/dexs/{slug}`, `/summary/fees/{slug}` | 200; `[[ts, {Chain: {Child: v}}]]` → filter "Robinhood Chain". Fallback only |
| DefiLlama | `/v2/historicalChainTvl/Robinhood Chain` | 200; 180 days from 2026-05-13 |
| DefiLlama | `/overview/active-users/Robinhood Chain` | 200; 100 days; total24h 68,045; 11 protocols |
| DefiLlama | `/raises` | **402** paid → Deferred (paid) |
| Blockscout | `stats-service/api/v1/lines/{id}?resolution=DAY` (keyless) | 200; `{chart:[{date, value, is_approximate?}]}`, 193 days from **2026-04-30**; all 8 requested ids plus txnsSuccessRate, averageTxnFee, newNativeCoinTransfers, gas series, activeBundlers, activePaymasters. `/counters` also 200 |
| Blockscout | `robinhoodchain.blockscout.com/api/v2/*` (keyless) | **403 Cloudflare JS challenge** → not usable from scripts |
| Blockscout | `api.blockscout.com/4663/api/v2/*` | 402 without key → use with `BLOCKSCOUT_API_KEY` (5 rps, 100K credits/day). Per-address counters, token holders/supply/mcap and address transactions go here; skip gracefully when the key is absent |
| GeckoTerminal | network `robinhood` | 200; 52 DEXes; token endpoint (price, fdv, mcap, supply, top_pools), token pools (20/page with dex, liquidity, h24 volume, created), OHLCV day (back to pool creation, 111 days for NVDA/USDG) and hour (1,000 candles ≈ 41 days per call; older via `before_timestamp`). Uniswap v4 pool ids are 32 bytes |
| Robinhood | `api.robinhood.com/rhj/assets` | 200; **203 stock tokens** with `tokenSymbol`, `tokenName` ("NVIDIA • Robinhood Token"), `deployments[].contractAddress` (EIP-55, chainId 4663), `currentMultiplier`, `status`, `tradingCapabilities`, `isin`. Official machine-readable list → `stock-tokens.csv` is generated from it. `/rhj/prices/{symbol}` (tokenBid/tokenAsk, multiplier-adjusted) and `/rhj/corporate-actions` also 200. 60 rps, cached |
| Chainlink | `reference-data-directory.vercel.app/feeds-robinhood-mainnet.json` | 200; 62 feeds; **39** "Robinhood X / USD" (35 market-hours + 4 "(24/7)" hidden), `proxyAddress`, decimals 8, heartbeat 86400. The docs page renders from this JSON |
| RPC | `https://rpc.mainnet.chain.robinhood.com` (official docs) | `eth_chainId` → 0x1237 (4663); `latestRoundData` on NVDA/USD proxy → 188.24, updatedAt Fri 2026-11-06 22:30Z (holds over the weekend). Fallbacks: robinhood-rpc.publicnode.com, robinhood.drpc.org |
| Morpho | `api.morpho.org/graphql` | chain 4663 listed; `markets(where:{chainId_in:[4663]}) { items { marketId lltv loanAsset{symbol address} collateralAsset{symbol address} state{supplyAssetsUsd borrowAssetsUsd collateralAssetsUsd} } }` works (no `uniqueKey`/`id`; `state` can be null; collateral includes real AMZN and a look-alike "TSLAon") |

Mapping first pass: normalized exact name match covers 101/607 CSV names; of CSV rows with metrics, ~39 need aliases (RAMSES, Pons, Clutch Markets (StonkBrokers), Meridian, Flap, GigaDex, Aero, Arcus, Lighter, up., Ekubo+STONX, PancakeSwap, pools.trade→"Pools", Fables matches directly). 183 of 309 DefiLlama protocols match no CSV name → seed of the "Newly detected" list (many are CEXs, bridges, look-alikes; shown for review only).

Funding rounds CSV: 34 rows, 10 columns; Date and Amount may be blank; investors `;`-separated; Confidence ∈ {Sourced, Prior knowledge (re-verify)}; some names need aliases to project rows (EqualFi (EqualIndex), LayerZero (Stargate), Bitstamp by Robinhood, Ondo Global Markets); CanHav Research itself appears as a Program award recipient.

Local facts: Node 24, `gh` CLI not installed (so GitHub secrets must be added by the user in the repo UI), no `.env*` yet, git identity Wazarat Hussain <wazarat100@gmail.com>.

## Design principles

- **Store raw by source key, join at build.** History files are keyed by DefiLlama slug / display name / token address, never by project id, so fixing a mapping row never needs a refetch. Projection to project → metric happens in `build-data.ts`.
- **No new runtime deps.** Node `fetch`, `AbortSignal.timeout`, Papa (present). Scripts run under `tsx`.
- **Vercel never touches the network.** `npm run data` reads only committed files; if `data/history/` is absent it builds in snapshot-only mode (live fields null), so a fresh clone still builds.
- **Pure logic in `src/lib/`** (tested, shared with UI); I/O in `scripts/`.
- **Effective = live ?? snapshot.** `Project.tvl/volume/fees/revenue` keep their meaning, so every existing chart, filter and test keeps working; the CSV values live on as `snapshot.*`.

## Part A — Data pipeline

### A1. Files

```
scripts/
  refresh.ts                 orchestrator: --backfill, --only a,b, --strict, --dry-run, --verbose; writes _meta.json last (and on SIGINT)
  review.ts                  Tally submissions side by side with current CSV rows; prints only
  seed-defillama-map.ts      writes/merges data/defillama-map.csv from name match + alias table (never removes rows)
  seed-contracts.ts          merges new addresses into data/contracts.csv (Verified=No on new rows; hand edits kept)
  build-data.ts              EXTENDED: joins CSVs + history, recomputes tier, validates, writes generated/*
  fetch/http.ts              createClient({host,minIntervalMs,...}): per-host spacing, retry w/ backoff on 429/5xx (+Retry-After), in-run GET cache, UA header; rpcBatch() with RPC fallbacks
  fetch/{defillama,blockscout,geckoterminal,chainlink,morpho,robinhood}.ts   pure parse*() fns + run(ctx)
  lib/{store,dates,csv,paths,log}.ts   upsertSeries/mergeHourly/appendDated/writeJsonStable; readCsv/findFile moved out of build-data
src/lib/
  history-types.ts  interfaces for data/history/**         live.ts      windows, sums, pctChange, sparkline, annualised, P/S, applyLive
  tier.ts           recomputeTier                          mapping.ts   normalizeName, resolveMap, sumBySlugs, newlyDetected
  premium.ts        premium vs Chainlink/Robinhood ref     market-hours.ts  NYSE sessions, holidays 2025–27, early closes
  compare.ts        ratios (fees/TVL, capture, vol/TVL…)   validate.ts  static-exact + live-sanity → {failures, warnings}
data/
  defillama-map.csv (Project, DefiLlama slug, Notes; hand-maintained after seeding)
  stock-tokens.csv  (GENERATED from rhj/assets + Chainlink feeds each run; never hand-edit)
  contracts.csv     (Project, Address, Role, Source, Verified)
  submissions/      Tally CSV exports (input to review)
  history/          committed store (A2)
.github/workflows/refresh.yml
tests/fixtures/{defillama,blockscout,geckoterminal,chainlink,morpho,robinhood,tally}/*   trimmed real responses
```
package.json: add `refresh`, `review`, `seed:map`, `seed:contracts`.

### A2. History store (`data/history/`)
Dates `YYYY-MM-DD` UTC; USD rounded to dollars; `writeJsonStable` sorts keys and writes one series per line so daily diffs are small appends.
```
_meta.json                      {version, lastRun, lastRunDate, mode, perSource{lastAttempt,lastSuccess,rows,calls,ms,error,skipped}, cursors{geckoHourly, blockscoutTx}, newlyDetected[], unmatchedCsv[], unmatchedMap[]}
chain.json                      defillama {tvl, volume, fees, revenue, holdersRevenue, supplySideRevenue, activeUsers}: Series; blockscoutLines: lineId→Series; counters: [date, {...}][]
defillama/protocols.json        trimmed /protocols filtered to Robinhood Chain (slug, name, parentProtocol, category, address, tvl, mcap, geckoId)
defillama/tvl.json              slug → [date, value][]            (from /protocol/{slug}; daily mode appends today's /protocols tvl)
defillama/{volume,fees,revenue,holders-revenue,supply-side-revenue}.json   display name → [date, value][]  (from the 5 chain overview calls)
blockscout/lines.json, counters.json
stocks/_index.json              TICKER → {symbol, name, address, decimals, status, multiplier, isin, logoUrl, tradingCapabilities, feed{proxy,decimals,heartbeat,is247}|null, pools[≤3 {address,dex,name,createdAt,base,quote}]}
stocks/daily/{TICKER}.json      candles: pool → [d,o,h,l,c,volUsd][]; token: [d, price, fdv, mcap, vol24][]; chainlink: [d, answer, updatedAt][]; robinhood: [d, tokenBid, tokenAsk, dailyVol][]; onchain: [d, holders, supply, circMcap][]; morpho: [d, collateralUsd, borrowUsd][]
stocks/hourly/{TICKER}.json     fed tickers only; pool → [ts, close, volUsd][]; rolling 180 d
contracts/counters.json         address → [date, txns, tokenTransfers, gasUsed][];  contracts/tokens.json address → [date, holders, supply, mcap, rate][]
contracts/transactions/{addr}.json   optional capped backfill rows
morpho/markets.json             marketId → {meta incl. lookAlike flag, series [date, supplyUsd, borrowUsd, collateralUsd][]}
```
Sizes at steady state: tvl ≈ 430 KB, each breakdown 200–380 KB, chain < 100 KB, stocks daily ≈ 8 MB total, hourly ≈ 12 MB (pruned), contracts ≈ 1 MB. Daily commit delta ≈ 300–500 KB.

### A3. Idempotent append (`scripts/lib/store.ts`)
`upsertSeries(existing, incoming, {today, revisionDays: 3, allowToday})`: map by date; skip non-finite, skip `d > today`, skip `d === today` for flows (`allowToday` true only for TVL/snapshots); same date inside the 3-day revision window overwrites (DefiLlama revises recent days), older dates are frozen; return sorted. Stable writer ⇒ a rerun is byte-identical, no diff. `mergeHourly`: dedupe by ts, prune < now−180 d.

### A4. Fetchers (throttle per host: DefiLlama 1 s, GeckoTerminal 2.5 s, Blockscout keyless 0.5 s / keyed 0.25 s, Robinhood 50 ms, Morpho 1 s, RPC 200 ms)
- **robinhood** `/rhj/assets` + `/rhj/prices/{symbol}` ×203 → `_index.json` (merging existing pools/feed), `stock-tokens.csv`, daily `robinhood` rows. ~10 s.
- **defillama** `/protocols` (→ protocols.json, newlyDetected/unmatched via mapping.ts); `/overview/dexs` + `/overview/fees` ×4 dataTypes (one call each gives every protocol's daily series); chain tvl + active users; per-slug `/protocol/{slug}` only in `--backfill` or for mapped slugs with < 7 stored points (new map rows self-heal); daily mode appends today's `/protocols` TVL. 8 calls daily, +~110 in backfill (~4 min).
- **blockscout** keyless: 23 line ids + counters (24 calls). **blockscout-keyed** (skipped with `skipped="BLOCKSCOUT_API_KEY not set"`): per `contracts.csv` row `/addresses/{a}/counters`; token roles also `/tokens/{a}`; optional `/addresses/{a}/transactions` paging for < 50k-txn contracts, ≤100 pages per run, cursor in _meta. ≈ 370 calls ≈ 1.5 min ≈ 500 credits/day.
- **chainlink** feeds JSON + 62 `latestRoundData` eth_calls as 3 JSON-RPC batches against the official RPC (fallback publicnode → drpc). ~5 s.
- **morpho** one GraphQL call (`markets first:500 chainId_in:[4663]`); attach collateral to stock tokens **by address only**; symbol-only matches flagged `lookAlike`. 
- **geckoterminal** (bottleneck, runs last): token data for 203 tokens via `tokens/multi/{30 addrs}` (7 calls; falls back to per-token 203 calls if multi 404s, recorded in _meta); daily OHLCV for every pool of the 39 fed tickers (117 calls; `limit=7` daily, `limit=1000` backfill); hourly for fed tickers round-robin ≤60 calls/run with `before_timestamp` cursor so backfill finishes over ~5 nights. ≈ 184 calls ≈ 7.7 min/day.
- Run order: robinhood → defillama → blockscout → chainlink → morpho → geckoterminal → blockscout-keyed. Each in try/catch; files written after each source; exit 0 unless every source failed (or `--strict`). Daily ≈ 12 min; first backfill ≈ 20 min.

### A5. Build join (`src/lib/live.ts`, used by build-data.ts)
- `windowEnd = lastRunDate − 1` (last complete UTC day; never `new Date()`, so Vercel builds are deterministic). Flows: `sumWindow(series, n)` with missing days = 0, null if no points in window; stocks: `valueAt(date, tolerance 3)`.
- Per project: slugs from map → names via protocols.json; live tvl = Σ valueAt; live volume/fees/revenue/holdersRev/supplySideRev = Σ 30 d sums. `pctChange` null if prev ≤ 0 or coverage < 50 %; d7/d30/d90 for the four metrics. Sparkline: 90-day shared axis, nulls for gaps, TVL forward-filled ≤ 3 d. `annualisedRevenue = rev30 × 365/30`; `tokenMarketCap` from protocols.json mcap; `psRatio` only when both > 0.
- `Project` gains `snapshot{tvl,volume,fees,revenue,tier,asOf}`, `live{asOf, slugs, tvl…, change, annualisedRevenue, tokenMarketCap, psRatio} | null`, `metricSource`, recomputed `tier` (Tier1 tvl≥50M | vol≥500M | fees≥1M; Tier2 tvl≥2M | vol≥50M | fees≥100K; Tier3 any positive metric; else Not tracked).
- New generated files: `series.json` {dates[90], projects: id → {tvl,volume,fees,revenue}[]}, `chain.json` (full history + latest + changes), `stocks.json` (StockSummary[] incl. reference {price, basis chainlink|robinhood, updatedAt, stale}, premium, holders, morphoCollateralUsd, pools, change, closes30), `stock-series.json` (per ticker 180-d close/volume + 7-d hourly for fed tickers), `rounds.json`, `investors.json`, `contracts.json`, `newly-detected.json`, `meta.json` v2 (`asOf` = DefiLlama lastSuccess date, `snapshotAsOf`, `live{lastRun, windowEnd, perSource}`, extra counts, `snapshotTotals`, `tierCounts`).
- Rounds: project resolved by exact → normalizeName → alias table (Ondo Global Markets→Ondo Finance, Bitstamp by Robinhood, LayerZero (Stargate), EqualFi (EqualIndex)); unresolved keep `projectId: null`, listed in build log. Investors aggregated from lead + other with led count.

### A6. Validation (`src/lib/validate.ts`) and `data/expected.json`
```json
{ "static": {"projects":607,"sectors":19,"leaders":87,"events":29,"rounds":34,"defillamaMap":<after seeding>,"snapshotTier1":17},
  "snapshot": {"tvl":1746808131,"volume":24187447119,"fees":73721126,"revenue":16414995},
  "liveSanity": {"maxDayOverDayRatio":10} }
```
Static + snapshot: strict equality → failure. Live: negative total → failure; ratio > 10× or < 0.1× vs previous day/snapshot → warning; stockTokens < 100 → warning; any `perSource.error` → warning; `lastRunDate` > 3 days old → warning. Build exits 1 only on failures.

### A7. Workflow `.github/workflows/refresh.yml`
cron `17 3 * * *` + `workflow_dispatch` (boolean `backfill`); `permissions: contents: write`; `concurrency: refresh-data`; `timeout-minutes: 55`; checkout → setup-node 22 (npm cache) → `npm ci` → `npm run refresh [-- --backfill]` with `BLOCKSCOUT_API_KEY`/`COINGECKO_DEMO_KEY` from secrets → `npm test` → `npm run build` → commit `data/history data/stock-tokens.csv` only if changed, author `Wazarat Hussain <wazarat100@gmail.com>`, message `data: refresh YYYY-MM-DD` (no trailers) → `git pull --rebase` → push `main`. Tests and build gate the commit so main never receives data that breaks Vercel. `defillama-map.csv` and `contracts.csv` are hand-maintained and never committed by the job.

### A8. Review script
`npm run review [--file …]`: reads `data/submissions/*.csv`, maps Tally headers to CSV columns via a `TALLY_FIELDS` table, matches project name (exact → normalizeName), prints `field | submitted | current` with `≠` markers or `NEW PROJECT`. Pure `diffSubmission()` is tested. Never writes.

### A9. Pipeline tests (fixtures = trimmed real responses saved from today's probes)
http (spacing, Retry-After, backoff, 404 no retry, cache, UA has no email) · store (append, rerun identical, revision window, drops future/today-flow, hourly prune) · one test per fetcher's parsers (incl. real NVDA hex → 188.24, `is_approximate` drop, Morpho null state + look-alike, assets chainId filter) · mapping (normalize, multi-slug sum, unmatched both ways, newly detected) · live (windowEnd, 30 d sum with gaps, pctChange nulls, coverage rule, sparkline fill, annualised, P/S guards, applyLive fallback) · tier boundaries · premium (basis, fallback, stale) · market-hours (open/close boundaries, weekend, Good Friday 2026-04-03, Juneteenth, July 3 2026 observed, early close 2026-11-27, DST days, 24/7 feeds) · compare ratios · validate (failure vs warning paths) · rounds (blank date/amount, aliases, investor aggregation) · review diff.

## Part B — UI

### B1. Groundwork (first thing in M1)
- `DataTable` (src/components/explorer/data-table.tsx) is hard-typed to `Project`; make it generic `DataTable<T>` with `makeColumnHelper<T>()`, keep `projectColumnHelper`; add column `meta.hideBelow: "sm"|"md"|"lg"` (responsive `hidden sm:table-cell` on th/td), `rowClassName`, `getRowId`.
- `ChartCard` gets a `table?: {columns, rows, caption?, filename?}` prop → Chart/Table toggle in `actions` (local state) rendering a small `ChartTable` (≤50 rows + "+N more", optional CSV download). Every new chart passes `table`, which also satisfies the validator's light-mode contrast WARN on `--cat-3/4/5`.
- `MainNav` links carry `compare, range, metric, scale` (uses `useSearchParams`, so wrap in its own `Suspense` since the header sits outside the shell's boundary). NAV += Stocks, Investors, Explorer, Compare (Compare always visible, count badge when tray non-empty).
- New nuqs parsers in `filters.ts`: `range` (7d|30d|90d|all, default 30d), `compare` (list, cap 4 in hook), `minSize` (any|250k|1m|10m, default 250k = TVL≥$250K or 30d fees≥$10K), `cols` (traction|momentum|activity|financials), `align` (date|days), `investor`, `ticker`. Same `useQueryStates` store.
- Range × metric: metric picks the series, range the window. `count` metric → history falls back to TVL (existing convention). Levels (TVL, holders, mcap) change = endpoint vs endpoint; flows use `live.change.{metric}.{d7|d30|d90}` (all → d90, labelled). Leaderboard always shows both 7d and 30d change; range drives sparkline window, movers window, chain charts, drawer chart.
- Lazy data: `src/lib/lazy-data.ts` dynamic-imports `series.json`, `chain.json`, and per-ticker `stocks/{T}.json` so the main bundle stays small. Sparkline cells show a skeleton until loaded.
- Shared primitives: `SparkLine` (inline SVG 80×20, neutral `--ink-secondary`, gaps at null, `role="img"`), `ChangeCell` (▲/▼ glyph + `--status-good`/`--status-critical`, `—` for null; never colour alone), `EstimateLabel` ("est." chip + tooltip), `DateRangeControl` (ToggleGroup beside the metric switcher), `HatchDefs` (45° hatch in `--ink-muted` for "Other" fills; a 6th grey categorical slot fails the validator), `DataFreshness` (header: "Data as of {lastRefresh} · updated daily" + source-status tooltip; falls back to CSV date), `TallyButtons` (`SubmitProjectButton`, `SuggestCorrectionButton`; both return null when the env var is unset; `tallyCorrectUrl(base, name, page)` pure + tested).
- Colour tokens to add in globals.css (validated with the dataviz validator as two ordinal arms, light surface #fcfcfb / dark #1a1a19): light `--div-neg-3 #184f95, --div-neg-2 #2a78d6, --div-neg-1 #86b6ef, --div-mid #f0efec, --div-pos-1 #e9807f, --div-pos-2 #e34948, --div-pos-3 #a31f1f`; dark `--div-neg-3 #9ec5f4, --div-neg-2 #3987e5, --div-neg-1 #184f95, --div-mid #383835, --div-pos-1 #9a3030, --div-pos-2 #e66767, --div-pos-3 #f4a9a9`. `--cat-1..4` (compare lines) and `--cat-1..5` (venue/round stacks) already pass adjacent pairs in both modes. Re-run the validator on anything touched before each milestone commit.

### B2. Milestone 1 — history & momentum UI
- FilterBar: `DateRangeControl` next to `metricSwitcher`; hint becomes "metric · range drive charts".
- Overview "Chain over time" (`ChainOverTime`): one ChartCard, 2×2 small multiples with their own axes (never dual): TVL line, daily DEX volume bars, daily fees bars, daily revenue bars; `--chain-robinhood`; the panel matching the active metric gets a subtle ring; computed takeaway; info names DefiLlama; `TvlNote` footer; table view.
- Leaderboard columns: `change7Column(metric)`, `change30Column(metric)` (ChangeCell, `sortUndefined:"last"`), `sparkColumn(metric, range)` ("Trend", `hideBelow:"md"`).
- `MoversPanel` (Overview + Traction): min-size Select in `actions`; Risers / Fallers columns, each row = name button · SparkLine · |change| bar (`--status-good`/`--status-critical`, 8 px) · ChangeCell · value; window = range; table view; empty state.
- Drawer `HistoryChart`: Tabs over metrics present (TVL, Volume, Fees, Revenue, Holders rev., Supply-side rev., later Txns/Holders); line for levels, bars for flows; range slice; table; section hidden with a one-liner when no history.
- Header `DataFreshness`; Explorer `NewlyDetectedCard` (name → DefiLlama link, category, TVL, "Know one? Submit it" button; hidden when empty).

### B3. Milestone 2 — chain users & per-project activity UI
- Overview `ChainActivity`: 2×2 small multiples honouring range: Active accounts (two lines: explorer `--cat-1`, DefiLlama `--cat-2`, legend + end labels), New accounts bars, Transactions line, Smart-wallet user ops line (takeaway quotes AA wallet count); table view; source Blockscout stats.
- Drawer "Activity" section: Daily transactions (24h, 7d avg), Unique senders (7d, EstimateLabel), Token holders, "Activity updated {date}"; hidden when all null.
- Leaderboard `cols=activity` set: txns, senders (est.), holders.
- Traction `ActivityWithoutTvl`: projects with no TVL but txns7d>0 or senders>0, sorted by txns; DataTable pageSize 10; takeaway line. Large contracts skipped in backfill are labelled "backfill skipped (large contract)".

### B4. Milestone 3 — `/stocks`
- Build precomputes per ticker (`src/data/generated/stocks/{T}.json`): daily `[date, vwap, chainlink, premium, volume]` (≤180 d; VWAP across the top 3 pools), `heat[range] = 168 × [medianPremium|null, trades]` (hour-of-week in America/New_York, market-hours flag from `market-hours.ts`), `afterHours[range] = {afterHoursShare, weekendShare, volume}`, `venues = dex → volume30d`. No raw hourly rows ship to the browser.
- Page: KPI row (tickers, with Chainlink feed "39 of 203", 24h DEX volume, pools, tickers used as Morpho collateral) → Ticker leaderboard (`DataTable<Ticker>`: ticker, premium now via `PremiumCell` with +/− sign and `--div-pos-2`/`--div-neg-2`, "no feed" when null; vol 24h/7d/30d; pools; venues; holders; supply; market cap; lending use; launch pairs; chooser; 390 px shows ticker, premium, 24h, pools) → `PremiumLine` (ticker Select, fed tickers first, zero reference line; no-feed ticker → empty state suggesting three fed tickers) | `HeatStrip` (7×24 inline SVG, 7-step diverging at ±0.25 %, ±1 %, ±3 %, hatched = no trades, 1 px outline = NYSE open, legend, focusable cells with `<title>`, `data-cell` attrs for tests) → `AfterHoursBars` (share of volume while NYSE closed, top 15, direct labels) | `VenueShareBar` (100 % stacked, top 5 DEXs `--cat-1..5` + hatched Other) → `MostUsedTokens` (score = pools + launch pairs + 3 if lending collateral) → `HowToRead` (premium = (DEX VWAP − Chainlink reference) / reference; feed holds its last value while markets are closed; multiplier note; only 39 tickers have a feed; not investment advice).
- Sources credited on-page: GeckoTerminal, Chainlink, Robinhood asset API, Blockscout, Morpho.

### B5. Milestone 4 — financials, rounds, investors
- Drawer "Financials": daily/30d fees, supply-side revenue, protocol revenue, holders revenue, annualised revenue, market cap, P/S (only when both exist), footnote "Incentives and emissions not included (paid source)". Traction `cols=financials` column set with the same footnote under the table; `cols=momentum` set (tvl, 7d/30d/90d, trend).
- Funding page: `RoundsTable` (`DataTable<Round>`; "Prior knowledge (re-verify)" rows muted + dashed tag) replaces the hand-written disclosed table; `RoundsOverTime` stacked bars by quarter and round type (`--cat-1..5` + hatched Other; undated/undisclosed counts in footer). Money-flow cards and token-funded list stay.
- `/investors`: "Top investors by deals" bars + `DataTable<Investor>` (investor → `?investor=slug`, deals, total disclosed, RH-related count with ◆ glyph, lead count, portfolio chips). `InvestorDrawer` (Sheet, mounted before ProjectDrawer so a project opened from it stacks on top) lists rounds with project links, confidence tags and sources.
- Drawer "Rounds" section lists that project's rounds with sources.

### B6. Milestone 5 — compare
- `useCompare()` over the `compare` param (cap 4, dedupe, unknown ids dropped); `suggestPeers` = top 3 same-sector by metric (fallback `similarProjects`).
- Entry points: drawer "Add to compare" (+ peer suggestion row when the tray was empty), checkbox column on Traction leaderboard and Explorer (disabled at 4), preset chips on Traction. Presets per the brief, resolved by name with missing names skipped and a preset hidden under 2 matches: Perps venues (Arcus, Lighter, Meridian), Native DEXs (Fables, up., Metric, RAMSES), Top launchpads (Pons, Long, Clutch Markets (StonkBrokers), Flap), Lending (Morpho, Longbow, LayerBank).
- `CompareTray`: fixed bottom bar with chips, "Compare {n}" link to `/compare/` carrying params, Clear; `main` gets bottom padding while visible.
- `/compare`: empty state (explainer, presets, top 6 by metric with Add); else header chips + `AddProjectPopover` (cmdk) + cross-sector warning (`--status-warning`, icon + text); 2–3 generated sentences from `compareSentences()` (leader multiple, widest fees-per-TVL gap, momentum contrast; pure, tested); `MetricMatrix` (rows TVL, volume, fees, revenue, annualised revenue, market cap, P/S, daily txns, senders est., holders; cell = value, `#rank of n in sector`, `share % of sector`; best = bold + accent + "best" tag; sticky first column, horizontal scroll inside the card at 390 px); `RatiosTable` (fees per $1 TVL, revenue capture, volume/TVL, 30d growth, daily txns per $1M TVL); `CompareOverlay` (≤4 lines `--cat-1..4` by slot, indexed to 100 on shared start date, `align=days` toggle, y=100 reference, end labels, legend, table); `ProfileGrid` (funding, token, chain, security, sources side by side).

### B7. Milestone 6 — forms & review
- `src/lib/env.ts` reads `NEXT_PUBLIC_TALLY_SUBMIT_URL` / `NEXT_PUBLIC_TALLY_CORRECT_URL`; `.env.example` documents them (plus `BLOCKSCOUT_API_KEY`, `COINGECKO_DEMO_KEY`). Submit button in header (icon-only < sm) and Explorer toolbar and NewlyDetected card; Correction button only in the drawer header, opening `?project=<name>&page=<url>`. Vercel env vars added via the Vercel MCP once links exist (project `prj_99oIvQRHQ15LAXT5knFwtAcso0fA`).
- `docs/REVIEW.md`: weekly flow (export Tally CSVs to `data/submissions/`, `npm run review`, apply approved edits to the CSVs by hand, bump `expected.json` static counts if rows were added, commit) plus the exact field lists for both Tally forms (submit: project name, website, X handle, sector dropdown of the 19 sectors, native chain dropdown of 4, short description, contract addresses, evidence URL required, contact optional; correction: hidden project, hidden page, field dropdown of the CSV columns, correct value, evidence URL required, contact optional).

### B8. Footer, README, nav copy
Methodology adds: History & momentum, Chain activity (estimate caveat), Stock tokens & premium, Financials (incentives excluded), Rounds confidence, and credits DefiLlama, Blockscout, GeckoTerminal, Chainlink, Morpho, Robinhood asset API. README: data sources with free limits, how the daily refresh works, rerunning a backfill (`workflow_dispatch` with backfill=true or `npm run refresh -- --backfill`), the history store layout, mapping/contracts maintenance, "Deferred (paid)" (DefiLlama raises/emissions/derivatives summary, Dune, Bitquery, Token Terminal, Artemis, Nansen, RootData, CryptoRank, X API → incentives/emissions, raises feed, X metrics), review workflow, hosting comparison (Vercel Pro $20/user/mo vs Cloudflare Pages free with commercial use; ready Pages config: build `npm run build`, output `out`, Node 22, env vars) with no hosting change made.

## Milestones, commits and self-checks (no stops unless something needs the user)

Each milestone ends with: `npm test` green, `npm run lint`, `npm run build` green (static export), dev server check in the browser pane at 1440 and 390 px in dark and light, Playwright suite green (extended per milestone), palette validator on touched tokens, then one commit authored as Wazarat with a plain message (`v2 m1: history pipeline and momentum UI`, …). Push after each milestone so Vercel deploys and the Action can be exercised early.

1. **M1** pipeline foundation (A1–A7), `npm run refresh -- --backfill` locally (needs `.env.local` for the keyed Blockscout part; proceeds without it), seed + hand-review `defillama-map.csv` (print the mapping table in the build log and in the commit message body), reshape `expected.json`, build join, history/momentum UI (B1–B2), workflow file. The workflow also triggers `on: push: paths: [".github/workflows/refresh.yml"]` so the first push is the manual-run proof (no `gh` here; the user can also press "Run workflow"). Verify the Action commit lands on main authored as Wazarat and Vercel redeploys.
2. **M2** contracts seeding + keyed Blockscout fetcher + chain activity UI (B3).
3. **M3** stock pipeline (robinhood, chainlink, geckoterminal, morpho sources; premium + market-hours libs) + `/stocks` (B4).
4. **M4** financial fields, rounds + investors (B5).
5. **M5** compare (B6).
6. **M6** forms, review script, `docs/REVIEW.md`, README/footer updates (B7–B8), final Playwright + build, final summary.

## Verification (end to end)
- `npm run refresh` twice in a row → second run produces no git diff under `data/history` (idempotency). `--backfill` populates ≥130 days of per-protocol TVL for uniswap-v3 and ≥145 days of chain volume.
- `npm run data` prints static checks ✓, snapshot totals ✓, live totals with ratios vs snapshot (expect TVL ≈ $1.08B chain-level, DEX volume 30d ≈ $21.8B, fees 30d ≈ $67M per today's overview totals) and the mapping report (mapped slugs, unmatched CSV names, newly detected count).
- UI spot checks: Uniswap leaderboard row shows 7d/30d change and a sparkline; range toggle rewrites the URL and reslices Chain over time; drawer for Fables shows history tabs; `/stocks/?ticker=NVDA` shows premium ≈ −0.5 % (DEX 187.26 vs feed 188.24 on 2026-11-08), heat strip with 168 cells and NYSE outline; `/investors/?investor=founders-fund` opens the drawer with Lighter; `/compare/?compare=fables,ramses` shows ranks within DEXs and the generated sentences; `?q=zzzz` still yields empty states everywhere; Tally buttons absent when env unset and present with correct prefilled URL when set.
- Playwright: existing 18 checks + new pages/interactions at both widths, zero console errors, no overflow.
- GitHub Action: first push runs it; the run must pass tests + build and push a `data: refresh YYYY-MM-DD` commit authored as Wazarat (or "no changes"); Vercel production deploy READY afterwards (check via Vercel MCP `get_deployment`).

## Needs the user (nothing else blocks)
- Add repository secret `BLOCKSCOUT_API_KEY` (Settings → Secrets and variables → Actions → Repository secrets) and fill `.env.local` (command already given; I create the placeholder file as step one if it does not exist). Until then the keyed metrics are skipped and logged, nothing breaks.
- Tally links whenever the forms exist: paste into `.env.local` and I add them to Vercel; buttons stay hidden until then.
- `COINGECKO_DEMO_KEY` optional; only used as a market-cap fallback.