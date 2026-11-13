<!-- Spec as written on 2026-11-12. Progress against it is recorded in docs/UI-PASS.md and below each step's commit. -->
# Live data and sector metrics spec (NEAR Ecosystem Atlas)

Why the site looks sparse, what data exists that it is not using, and what each sector should show. Every source below was tested live on Nov 12, 2026. Two companion files hold the values pulled for this spec. `near-live-metrics-2026-11-12.csv` has the 468 non-legacy projects in 43 columns, and `near-aurora-chain-daily-2026-11-12.csv` has 35 days of gas fees and transactions for both chains. The implementation brief is at the end.

## 0. What is wrong today

**Aurora shows no fees or revenue, but the data exists.** The "Chain over time" Aurora charts read $0 on a $0 to $4 axis because they plot the sum of protocols from `/overview/fees/aurora`. That total leaves out the chain's own row, named "Aurora" with category Chain, which holds the gas fees.

| Aurora measure, Nov 12 | Value | Source |
|---|---|---|
| Gas fees, last 30 days | $2,071 (about $55 to $170 a day) | DefiLlama `/summary/fees/aurora?dataType=dailyFees` |
| Protocol fees, last 30 days (what the chart sums today) | about $5 | DefiLlama `/overview/fees/aurora` |
| Revenue | No daily series. Methodology says revenue is "Burned coins" and the endpoint returns one stray value. Show Not tracked, never $0. | DefiLlama |
| Transactions | 2,200 to 11,400 a day over the last 31 days, 6,876 on Nov 11 | Aurora Blockscout `/api/v2/stats/charts/transactions` |
| Lifetime | 82.1M transactions, 12.6M addresses, 224M blocks | Aurora Blockscout `/api/v2/stats` |
| 30d DEX volume | $3.92M (Trisolaris $3.48M, AuroraSwap $360K, WannaSwap $69K, Pad.fi $9.9K) | DefiLlama `/overview/dexs/aurora` |
| 24h DEX activity, top pools | Trisolaris $74.9K volume and $1.16M liquidity across 11 pools | GeckoTerminal `aurora` |
| Lending | Bastion $805K TVL plus $54K borrowed, Aurigami $603K plus $216K borrowed | DefiLlama `Aurora-borrowed` |
| Stablecoins on Aurora | USDC $2.47M, USDT $1.38M, USN $53K, DAI $51K, FRAX $48K | DefiLlama stablecoins |
| Token holders | AURORA 52,300, TRI 29,498, PLY 25,742, BSTN 23,369 | Aurora Blockscout tokens |

**Zero days are gaps, not zeros.** Aurora fees read 0 on Oct 11, Nov 1, Nov 5, Nov 9 and Nov 10, and Blockscout shows 0 transactions on Nov 10. Treat a 0 as missing when the chain's transaction count for that day is also 0 or missing, and draw a gap instead of a dip.

**"Tracked for 13/468" uses the wrong denominator.** Fees only apply to DeFi protocols, so 455 of those 468 are not failures. Of the 468 non-legacy rows, 200 sit in unmeasured sectors (wallets, infra, exchanges, data, security, ecosystem, validators, other) and 65 more are defunct or inactive. Each Overview tile should read "Tracked for X of Y where it applies", with Y counting only projects whose sector uses that metric and that are not defunct.

**DefiLlama alone tops out at about 15 NEAR protocols with fees.** Better coverage needs the sources in section 2, mostly NearBlocks, Aurora Blockscout, NEAR Catalog token and contract fields, BigQuery per-contract activity and NEAR Intents referral volume. The companion file lifts projects with at least one live value from 63 in the Nov 8 dataset to 120, and 87 of them have a traction metric rather than only token facts, using only free, keyless calls.

## 1. Accuracy rules

These four rules carry over from the Robinhood atlas.
1. Every Other Traction Signal shows its as-of date. Hide it behind "Older figure" if it is more than 30 days old and differs by over 25% from the live metric of the same kind.
2. Every number has an InfoTip that says what it counts and excludes.
3. Each number has one primary source. Log any gap with a second source, and fail the build if a headline metric differs by over 10%.
4. Every value shows its as-of day, and nothing older than 3 days counts as current.

These rules are new and specific to NEAR.
5. **Never treat NearBlocks `onchain_market_cap` as a market cap.** For USDt it reads $525M, while DefiLlama stablecoins puts USDT on NEAR at $39.3M, because NearBlocks multiplies the full minted supply, treasury included, by price. Show it only for project tokens, labelled "Supply on NEAR × price", and never for stablecoins.
6. **NEAR Intents liquidity on GeckoTerminal ($1.62B across 67 pools) is not DEX liquidity.** It reflects how Intents is modelled as pools. Show the volume and hide the liquidity for Intents.
7. **Intents is counted once.** DefiLlama lists NEAR Intents under both dexs and bridges. It is a Bridges and Interoperability project in the dataset and its $3.73B 30d volume is 93% of the chain's DEX volume. Chain KPIs say "including NEAR Intents" and add a second figure that excludes it.
8. **Spoof guard for tokens.** Map a token to a project only by contract address taken from NEAR Catalog `tokens.address`, the project's docs or DefiLlama's `address` field. Never map by symbol alone. Aurora Blockscout's top holder list includes spam tokens with large holder counts (2FLR at 1.99M, AUR0, MERK, OSS, SWAPQ), which must never attach to a project.
9. **Stablecoin rows can repeat.** "DAI" and "DAI by MakerDAO" are both in the dataset. Count a stablecoin's supply once in any total, on the row marked primary in `data/defillama-map.csv`.
10. **Holders are an estimate.** One person can hold many NEAR accounts, and SWEAT's 23.2M holders are mostly app-created accounts. Holders never set a tier on their own.

## 2. Rules for every sector

**The four value states.** Each one is handled differently.
- **`value`.** The number exists and is current.
- **`zero-by-design`.** The source reports zero on purpose. Show "$0" with the reason.
- **`not-applicable`.** The metric does not exist for this kind of project. Hide the row.
- **`not-tracked`.** The metric applies but no source covers this project yet. Show "Not tracked" with the reason, and list the project on a public "Help us track this" page linked to the correction form.

A fifth display case is **`inactive`**, for a Defunct or Inactive project. Show the last value with its date, and leave it out of leaderboards.

**Leader ranking.** One rule ranks sector leaders on the cards, in the sector pop-up and on the Traction tab, over the same set as the sector totals. It is `rankLeaders` in `src/lib/sector-metrics.ts`, specified in `docs/SECTOR-METRICS.md`, section 1.

**Measured and unmeasured sectors.** Some sectors carry a traction headline and some do not.
- **Measured.** These sectors have a headline metric that drives tiers and sector leaders.
  - DEXs and Liquidity, Launchpads and Lending and Credit.
  - Liquid Staking and Restaking, Yield and Asset Management, and RWA and Tokenized Assets.
  - Bridges and Interoperability, Stablecoins and Payments, and Perps, Options and Derivatives.
  - Prediction Markets, Trading Tools and Bots, AI Agents, and NFTs, Gaming and Collectibles.
  - Memecoins and Community, Social and Identity, and DAOs, Governance and Public Goods.
- **Unmeasured.** These sectors show facts with no tier.
  - Infrastructure and Dev Tools, Wallets and Custody, Exchanges and On/Off-Ramps, and Data and Analytics.
  - Security, Risk and Compliance, Ecosystem, Funding and Education, Validators and Node Operators, and Other.
  - Their tier reads "Not applicable", never TBD.

**Effort key.** The same scale as the Robinhood spec.
- **S** means data the pipeline already fetches.
- **M** means a new free endpoint with no per-project mapping.
- **L** means it needs a per-project contract or token mapped in `data/contracts.csv`.

## 3. Free sources confirmed live (Nov 12)

| Source | What it gives for NEAR and Aurora | Status |
|---|---|---|
| DefiLlama `/protocols` | `Near`, `Near-borrowed`, `Near-staking`, `Near-vesting`, `Aurora`, `Aurora-borrowed`, `Aurora-staking`, `Aurora-pool2` per protocol, 105 protocols. Rhea Lend $140.4M TVL plus $25.0M borrowed. RHEA LST $5.47M own-token staking. | Used for TVL, new keys unused |
| DefiLlama `/summary/fees/aurora` and `/summary/fees/near` | Chain gas fees per day. NEAR chain $2.5K to $6K a day apart from a $25.9K spike on Oct 15 ($134K over 30d), Aurora $55 to $170 | New, fixes the Aurora chart |
| DefiLlama `/overview/fees/near` with `dataType` | Fees $6.78M, revenue $1.98M, holders revenue (Intents $1.80M, chain $94K), supply-side revenue (Intents $4.19M, Rhea DEX $404K) over 30d | Fees and revenue used, the other two unused |
| DefiLlama `/overview/aggregators` and `/overview/bridge-aggregators` | LeoDex $53K on NEAR, De1 and DZap on Aurora, Stableflow $51K and Rubic $36K bridge aggregator volume | New |
| DefiLlama `/overview/open-interest`, `/options`, `/active-users` for NEAR | HTTP 500 or zeros | Not usable |
| DefiLlama yields `/pools` and `/lendBorrow` | 10 NEAR pools, all Rhea. rNEAR $64.5M at 4.4%. Rhea Lend USDC and USDT markets $24.7M supplied, $20.9M borrowed (85% utilization), borrow APY 14% to 17% | New |
| DefiLlama stablecoins | USDC $90.5M and USDT $39.3M on NEAR, $3.9M of stablecoins on Aurora | New |
| DefiLlama `/hacks` | Ref Finance 2021 ($3.2M), Skyward 2022 ($3.0M), Rhea Lend Apr 2026 ($18.4M), Sweat Apr 2026 ($3.5M) | New |
| GeckoTerminal `near` and `aurora` | NEAR lists only 2 DEXes (Rhea Finance and Near Intents). Aurora lists Trisolaris, AuroraSwap, WannaSwap and NearPad. Per-pool 24h volume and liquidity. About 30 calls a minute, and 429s come back with no CORS header, so retry server-side. | New |
| NearBlocks `api.nearblocks.io/v1` | `/stats` (5.48B lifetime transactions, 23 TPS, 371 nodes online), `/charts/latest` (daily transactions, 500K to 970K a day), `/fts` (token list with price and supply × price), `/fts/{contract}/holders/count` (RHEA 16,285, REF 124,627, BRRR 99,423, mpDAO 83,228, stNEAR 7,010, LiNEAR 14,254, SWEAT 23.2M, BLACKDRAGON 286K). Free, about 6 calls a minute without a key | New |
| Aurora Blockscout `explorer.mainnet.aurora.dev/api/v2` | `/stats`, `/stats/charts/transactions`, `/tokens?type=ERC-20` with holders and market cap, and `/addresses/{hash}/counters` for contract transactions | New |
| NEAR Catalog `api.nearcatalog.xyz/project?pid=` | Per project `tokens` (symbol, NEAR contract, Aurora contract, CoinGecko id) for 41 projects, `contracts` (NEAR accounts) for 27, GitHub links, `lnc.score` and `updated_at`. `contracts` can be an object rather than an array. | Partly used |
| NEAR BigQuery public dataset | Per-contract daily function calls and distinct signers for every account in `data/contracts.csv` | Built in M3, needs the seeded contracts |
| NEAR Intents Explorer API | Per-swap `referral` and `appFees`, so volume and fees per integrating app | Built in M4, referral-to-project map missing |

**Paid or unavailable, so leave out.** These stay out for now.
- DefiLlama `/raises`, `/emissions` and `/summary/derivatives` (paid).
- NFT marketplace volume (no free NEAR feed found).
- Pikespeak (paid API).

## 4. Per-sector metrics

The first row in each table is the headline.

### DEXs and Liquidity (Rhea Finance, Veax, Jumbo, Trisolaris, DODO)
| Metric | Source | Effort |
|---|---|---|
| **Headline** 30d DEX volume | DefiLlama dexs (NEAR and Aurora) | S |
| TVL | DefiLlama | S |
| 30d fees, revenue, supply-side revenue, capture | DefiLlama fees with `dataType` | S |
| 24h volume, liquidity and pool count, top pairs | GeckoTerminal per DEX | M |
| Aggregator volume for routers (LeoDex, De1, DZap) | DefiLlama aggregators | M |
| Pool APY | DefiLlama yields | M |
| Contract activity for DEXes with no DefiLlama page | BigQuery per contract | L |

### Bridges and Interoperability (NEAR Intents, Omni Bridge, Portal, Rainbow Bridge)
| Metric | Source | Effort |
|---|---|---|
| **Headline** 30d volume. Intents uses DefiLlama dexs, and the 1Click Explorer sum is shown as a cross-check. | DefiLlama, Explorer API | S |
| TVL for lock-and-mint bridges | DefiLlama | S |
| 30d fees, holders revenue, supply-side revenue | DefiLlama fees | S |
| Bridge aggregator volume (Stableflow, Rubic) | DefiLlama bridge aggregators | M |
| `intents.near` and `omni.bridge.near` daily receipts and signers | BigQuery | S once M3 runs |

### Lending and Credit (Rhea Lend, Templar, Bastion, Aurigami)
| Metric | Source | Effort |
|---|---|---|
| **Headline** total deposited (TVL plus borrowed). Rhea Lend is about $165M. | DefiLlama TVL plus `-borrowed` | S |
| Borrowed and utilization | DefiLlama `-borrowed`, yields `/lendBorrow` | S |
| Supply and borrow APY per market | yields `/lendBorrow` | M |
| 30d fees (interest) and revenue | DefiLlama fees | S |
| Recovery status after the Apr 2026 exploit | Events file | S |
| DEX volume | Not applicable, hidden | |

### Liquid Staking and Restaking (Meta Pool, Rhea LST, LiNEAR, Allstake, TruFin)
| Metric | Source | Effort |
|---|---|---|
| **Headline** TVL (NEAR staked) | DefiLlama | S |
| Staking APY | DefiLlama yields (rNEAR 4.4%), and each protocol's API for the others | M |
| LST holders (stNEAR 7,010, LiNEAR 14,254) | NearBlocks holders | L |
| Own-token staking, kept out of TVL | DefiLlama `-staking` | S |
| 30d fees and revenue | DefiLlama fees | S |

### Launchpads (Meme Cooking, JustHoot, Nearly, Shards, NEARRR.fun, Pump.fun on NEAR)
| Metric | Source | Effort |
|---|---|---|
| **Headline** tokens launched in the last 30 days | BigQuery, counting new accounts created under the factory account (for example `*.meme-cooking.near`) | L |
| 30d volume of tokens launched on the venue | GeckoTerminal Rhea pools whose base token sits under the factory, plus DefiLlama for Meme Cooking | L |
| Holders of the top launched tokens (JAMBO 17,380) | NearBlocks | L |
| Fees, TVL where listed | DefiLlama | S |

### Memecoins and Community (Black Dragon, Shitzu, JAMBO, Nearkat, NEKO)
| Metric | Source | Effort |
|---|---|---|
| **Headline** holders on NEAR | NearBlocks holders count | L |
| 24h volume and liquidity | GeckoTerminal token pools on Rhea | L |
| Supply on NEAR × price | NearBlocks `/fts` | L |
| Market cap | Not shown, since free sources give a global figure | |

### AI Agents (NEAR AI, NEAR AI Agent Market, IronClaw, Public AI, Cosmose)
| Metric | Source | Effort |
|---|---|---|
| **Headline** project token holders on NEAR | NearBlocks | L |
| 30d signers to the project's contracts | BigQuery | L |
| Intents volume routed by agents that set a `referral` | Explorer API | M |
| Offchain usage (agent runs, API calls) | Not tracked, from self-reports only | |

### NFTs, Gaming and Collectibles (SWEAT, Hot Craft, Pumpopoly, ShardDog, PlayEmber)
| Metric | Source | Effort |
|---|---|---|
| **Headline** holders of the project token or collection | NearBlocks `/fts/{c}/holders/count` or `/nfts/{c}` | L |
| 30d signers and function calls to game contracts (`game.hot.tg`, `token.sweat`) | BigQuery | L |
| Marketplace volume | Not tracked | |

### Stablecoins and Payments (USDT, USDC, DAI, FRAX, StableFlow)
| Metric | Source | Effort |
|---|---|---|
| **Headline** supply on NEAR plus Aurora | DefiLlama stablecoins | M |
| Holders and 30d transfers | NearBlocks and Blockscout | L |
| Used in Rhea Lend (supplied, borrowed) | yields `/lendBorrow` | M |
| Payment apps | BigQuery signers to the app's contracts | L |

### Yield and Asset Management (Dew Finance, Aurora+, KAIO vaults)
| Metric | Source | Effort |
|---|---|---|
| **Headline** TVL | DefiLlama | S |
| APY and pool count | DefiLlama yields | M |
| 30d fees | DefiLlama fees | S |

### RWA and Tokenized Assets (KAIO, Ondo Finance)
| Metric | Source | Effort |
|---|---|---|
| **Headline** TVL or tokenized supply | DefiLlama, or NearBlocks supply for issued tokens | S or L |
| Holders | NearBlocks | L |
| 30d fees | DefiLlama | S |

### Perps, Options and Derivatives (Orderly Network, Crafting Finance, HeX (HOT Exchange))
| Metric | Source | Effort |
|---|---|---|
| **Headline** TVL (collateral) | DefiLlama | S |
| Open interest | DefiLlama returns 500 for NEAR, so Not tracked | |
| Contract activity for HeX | BigQuery | L |

### Prediction Markets (Kalshi, Noa Market, Prophet)
| Metric | Source | Effort |
|---|---|---|
| **Headline** 30d signers to the market contracts | BigQuery | L |
| TVL and fees where listed | DefiLlama | S |

### Trading Tools and Bots (Delta Trade, Bettear Bot, Intear Bot)
| Metric | Source | Effort |
|---|---|---|
| **Headline** 30d volume routed, flagged as double counted | DefiLlama dexs (Delta Trade $398K) | S |
| TVL in grid bots | DefiLlama | S |
| 30d signers to `grid.deltatrade.near` | BigQuery | L |

### Social and Identity (Near Social) and DAOs, Governance and Public Goods (POTLOCK, AstroDAO)
| Metric | Source | Effort |
|---|---|---|
| **Headline** 30d distinct signers to the project's contracts (for example `potlock.near` and `donate.potlock.near` from NEAR Catalog) | BigQuery | L |
| Donations routed (Potlock) | BigQuery transfers to `donate.potlock.near` | L |

### Unmeasured sectors
| Sector | Fact shown instead of traction | Source | Effort |
|---|---|---|---|
| Wallets and Custody (HOT, Meteor, Intear, MyNearWallet) | Swaps routed through NEAR Intents by `referral`, and signers to the wallet's own contracts where it has one | Explorer API, BigQuery | M |
| Exchanges and On/Off-Ramps | Assets held on NEAR (Binance $536M, KuCoin $20M, Bitget $18M, Gate $16M), kept out of chain TVL | DefiLlama CEX rows | S |
| Infrastructure and Dev Tools | Role as text. Chain stats appear on the NEAR Protocol and Aurora cards only. | NearBlocks, Blockscout | S |
| Validators and Node Operators | Nodes online (371) at chain level only | NearBlocks `/stats` | S |
| Data and Analytics, Security, Ecosystem, Other | Role, date added, audits done | Dataset | S |

## 5. Order of work
1. **S, about a day.**
   - Fix the Aurora chain fees and the zero-gap rule.
   - Add the "where it applies" denominators.
   - Add the five value states, the registry, the measured flag, borrowed, total deposited, holders revenue and supply-side revenue.
   - Wire in CEX assets as a fact.
2. **M, one to two days.**
   - Chain lines from Aurora Blockscout (transactions, addresses) and NearBlocks (transactions, nodes).
   - Stablecoins, yields and lendBorrow, aggregators and bridge aggregators, hacks.
   - GeckoTerminal per DEX for NEAR and Aurora.
3. **L, ongoing.**
   - Seed `data/contracts.csv` from `near-live-metrics-2026-11-12.csv` (token contracts and Known Contracts columns) and NEAR Catalog.
   - Add NearBlocks holders for each mapped token, Blockscout holders for Aurora tokens, BigQuery per-contract signers and function calls, launchpad token counts, and the Intents referral-to-project map.

---

## Implementation brief
This file lives in the repo as `docs/LIVE-DATA.md`, with `data/near-live-metrics-2026-11-12.csv` and `tests/fixtures/chain-daily-2026-11-12.csv` beside it.

### Task
The data looks sparse. Every Overview tile shows something like "Tracked for 13/468", and the Aurora fees and revenue charts are flat at $0. Fix both, and add the free sources and per-sector metrics in `docs/LIVE-DATA.md`.
- Follow sections 0 to 5, including the accuracy rules in section 1.
- Work in the order of section 5. Stop after each step with screenshots at 1440 and 390px.
- Do not invent numbers. A metric with no source shows Not tracked with its reason.

### Requirements
1. **Aurora chain fix.**
   - Chain gas fees come from `/summary/fees/{chain}?dataType=dailyFees` for both chains, labelled "Gas fees".
   - Protocol fees stay a separate series.
   - Aurora revenue shows Not tracked with the methodology text, never $0.
   - The y axis fits the data, with no fixed $0 to $4 domain.
   - Add Aurora and NEAR daily transactions from Blockscout and NearBlocks to "Chain over time".
   - Apply the zero-gap rule from section 0.
   - Add a unit test with the chain-daily fixture that asserts Aurora's gas fees from Oct 13 to Nov 11 sum to $2,071 and that the Nov 10 zero is drawn as a gap.
2. **Registry and states.**
   - Add `src/lib/sector-metrics.ts` with each sector's metrics, labels, InfoTips, source, headline and `measured` flag, following section 4.
   - Each value carries one of `value`, `zero-by-design`, `not-applicable`, `not-tracked` or `inactive`.
   - The drawer, sector cards and sector leaders all render from the registry.
3. **Overview denominators.** Each tile reads "Tracked for X of Y where it applies", with an InfoTip that lists what Y excludes (unmeasured sectors, defunct projects).
   - Add tiles for Total borrowed, Stablecoin supply (NEAR plus Aurora), and 30d DEX volume excluding NEAR Intents.
4. **New fetchers in `scripts/fetch/`.** Each one is its own file and follows the existing pattern.
   - The trailing 7-day re-fetch.
   - Status written to `data/history/_meta.json`.
   - A graceful skip on failure.
   - A server-side retry with backoff on 429, since GeckoTerminal and NearBlocks send no CORS header on 429.
   - The fetchers to add:
     - DefiLlama chain fee summaries, the `-borrowed`, `-staking` and `-vesting` keys, `dataType` dailyHoldersRevenue and dailySupplySideRevenue, aggregators, bridge aggregators, yields pools and lendBorrow filtered to `Near` and `Aurora`, stablecoins `chainCirculating.Near` and `.Aurora`, and hacks.
     - GeckoTerminal `networks/near` and `networks/aurora`, covering DEXes, pools and token pools.
     - NearBlocks `/stats`, `/charts/latest`, `/fts` and `/fts/{contract}/holders/count`, rate limited to 6 a minute and run only for mapped tokens. Add `NEARBLOCKS_API_KEY` as an optional env var and secret.
     - Aurora Blockscout `/stats`, `/stats/charts/transactions`, `/tokens?type=ERC-20` and `/addresses/{hash}/counters`.
     - NEAR Catalog per-project `tokens` and `contracts`. Handle `contracts` as either an array or an object.
5. **Contracts and tokens.** Extend `data/contracts.csv` with a `Role` column (token, core, factory, game, treasury) and seed it from the live-metrics CSV's `Token Contract (NEAR)`, `Token Contract (Aurora)` and `Known Contracts` columns plus NEAR Catalog.
   - Mark each row Verified only when the account exists on NearBlocks or Blockscout.
   - Apply the spoof guard from rule 8, and add a test that a symbol-only match is rejected.
   - The BigQuery job computes per-project daily function calls and distinct signers from these accounts in the same scan as the chain metrics, so the cost guard still holds.
   - Launchpads get a factory row, and BigQuery counts new sub-accounts per day as tokens launched.
6. **NEAR Intents per app.**
   - Add `data/intents-referrals.csv` (Referral, Project, Verified, Notes).
   - Seed it by listing the top 50 `referral` values by 30d volume from the Explorer data and matching them to the 45 projects tagged NEAR Intents in the dataset. Print the unmatched referrals in the build log for me to label.
   - Show per-app 30d Intents volume, swap count and `appFees` in each matched project's drawer and on the Intents page.
   - Keep the volume out of the project's own DEX volume, since Intents already counts it.
7. **Seed values.** On first run, load `data/near-live-metrics-2026-11-12.csv` as a dated snapshot so the drawer shows values before the new fetchers have history.
   - Live fetches replace the snapshot values as they land.
   - Any value older than 3 days shows its date.
8. **Accuracy checks.**
   - Implement rules 1 to 10 in section 1.
   - The build fails if Aurora gas fees are missing for more than 3 straight days with transactions above zero.
   - The build fails if a headline metric differs by more than 10% between two sources.
   - Print a review list of every conflict.
9. **Help us track this.** Add a page listing measured-sector projects in the `not-tracked` state, grouped by the missing metric, each with a link to the correction form pre-filled with the project name.
10. **Wording.** Name sources only in InfoTips and Methodology. No colons or em dashes in UI copy, and run `npm run check:copy`.

### Checks
- Unit tests with saved fixtures cover:
  - each new parser and the registry states;
  - the Aurora gas-fee sum and the zero-gap rule;
  - total deposited (TVL plus borrowed) and utilization;
  - the "where it applies" denominators;
  - the spoof guard;
  - stablecoin de-duplication;
  - the referral mapping.
- A snapshot test checks that Rhea Lend's drawer shows total deposited, borrowed, TVL, utilization and borrow APY, with no DEX volume row.
- A second snapshot test checks that Aurora's card shows gas fees, transactions and DEX volume, never a flat $0.
- Build, tests, `npm run check:copy` and Playwright at 1440 and 390px all pass.
- Commit per step as Wazarat Hussain <wazarat100@gmail.com>, with no Co-Authored-By or other attribution trailers and no tool attribution in commits, PRs or code comments. Keep agent tooling files gitignored. Pull with rebase before pushing.
