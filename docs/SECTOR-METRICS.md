# Sector metrics spec (NEAR Ecosystem Atlas)

What each of the 24 NEAR sectors shows on its card, in its sector pop-up and in each project pop-up, where the data comes from, and how hard it is. This mirrors the Robinhood Chain Atlas spec (Nov 10) and builds on what `near-dashboard` already has. The registry is in `src/lib/sector-metrics.ts` and the sources are in `docs/LIVE-DATA.md`. Checked against the live site and commit `23bb02f` on Nov 13, 2026.

## 0. What is wrong on the Sectors tab today
These come from the live site on Nov 13.
1. **Leaders are not ranked by their metric.** The cards use the curated leaders CSV, so the order ignores the values beside the names.
   - LeoDex, with no value, sits above Rhea Finance ($273.9M).
   - Templar ($539.6K) sits above Bastion ($859.0K).
   - Shitzu (11,924 holders) sits above Black Dragon (286,268).
   - HeX, with no value, sits above Spin.
2. **Defunct and inactive projects appear as leaders.** Spin ($89.4K) is a leader under Perps, and Bastion under Lending. The registry says inactive projects stay out of leaderboards.
3. **Card totals and leader values disagree.** Yield and Asset Management shows a total of $247.4K "tracked for 1 of 4", yet lists Aurora+ at $2.3M as its top leader. The total and the leaders use different filters.
4. **Unmeasured sectors still show "With traction".** Infrastructure shows 3, Wallets 1 and Security 3, which contradicts "No traction headline for this sector".
5. **Bridges are labelled "30d DEX volume".** The value is NEAR Intents' swap volume, so the label should read "30d volume".
6. **Headlines with almost no coverage.**
   - Launchpads have tokens launched "tracked for 0 of 12", because no factory account is mapped.
   - Prediction Markets show signers "0 of 3", and DAOs show "0 of 6".
   - Social shows Near Social with 38 signers in 7 days, which suggests the wrong contract is mapped (`db.social08.near` from NEAR Catalog rather than `social.near`).
7. **Holders inflate games.** SWEAT shows 23,244,524 holders, mostly accounts the app created. Accuracy rule 10 says holders never set a tier, yet it is the NFT headline.

## 1. Rules for every sector
**Four value states plus inactive.** These are already in the registry and stay as they are.
- **Not applicable.** The row is hidden.
- **$0 by design.** Shown as "$0" with the reason.
- **Not tracked.** Shown with the reason.
- **Inactive.** The last value shows with its date, and the project stays out of leaderboards.

**Two layers in every project pop-up.**
- **Universal block.** Sector and subcategory, native chain, status, tier, funding, sources, plus the cross-sector facts (NEAR Intents volume routed, Intents app fees, gas fees generated) whenever a value exists.
- **Sector block.** The sector's metrics from section 3, headline first.

**Measured and unmeasured.** Some sectors have a headline and some don't.
- **Measured.** 16 sectors have a headline that drives tiers and leader ranking.
- **Unmeasured.** 8 sectors show facts with no tier.
  - The 8 are Infrastructure, Wallets, Exchanges, Data and Analytics, Security, Ecosystem, Validators and Other.
  - Their tier reads "Not applicable".
  - Their leaders use a ranking fact where one exists (section 3), otherwise the curated rank.

**Leader ranking, the same everywhere.** Cards, the sector pop-up and the Traction tab all use this order.
1. Active projects with a headline value, sorted by that value, highest first.
2. Then active projects with no value, in curated rank order.
3. Inactive and defunct projects never appear.
4. Ranking uses the same filtered project set as the sector totals, so the two can never disagree.

**Effort key.** The same scale as the Robinhood spec.
- **S** means data the pipeline already fetches.
- **M** means a new free endpoint with no per-project mapping.
- **L** means it needs per-project contracts or tokens mapped in `data/contracts.csv`.

## 1b. Sector cards (Sectors tab)
Replace the current cards. Cards carry no money or traction figures. Those move to the sector pop-up.
- **Remove.**
  - The "With traction" stat and its percentage.
  - The headline line, for example "30d DEX volume, tracked for 4 of 34".
  - The headline total, for example "$273.9M".
  - "No traction headline for this sector".
  - Every value beside a leader's name.
- **Top row, two stats.** Projects, and NEAR-native written as a count with its share, for example "28 (50%)".
- **Divider, then Sector leaders.** Rename "Ranked leaders" to "Sector leaders". Show the top 3 names only, one per row, ranked by the rule in section 1. Clicking a name opens the project pop-up, and clicking the sector title opens the sector pop-up.
- **Layout.** Equal card heights per row. Use no colons or em dashes in copy.
- **Info tip.** Replace it with "One card per sector, with project count and NEAR-native share. Leaders are ranked by the sector's headline metric where it has one, otherwise by research rank. Open a sector for its metrics."
- **Sector card table view.** Drop the "With traction" and headline columns there too.

## 1c. Sector pop-up (where the numbers now live)
1. **Headline block.** The headline metric total for the sector, with "Tracked for X of Y where it applies" underneath and the info tip.
2. **Metrics table.** Each of the sector's other metrics with its sector total and coverage. Rows that are not applicable are hidden.
3. **Full leaders list.** Every active project, ranked by the section 1 rule. Each row shows the headline value or "Not tracked".
4. **Unmeasured sectors.** Facts with no Traction heading. For example, Exchanges shows "Assets held on NEAR", and Validators shows "NEAR staked".

## 2. Free sources
Everything in `docs/LIVE-DATA.md` section 3 still applies. This spec adds the sources below.

| Source | What it gives | Effort |
|---|---|---|
| NEAR RPC `validators` (FastNEAR free RPC or `rpc.mainnet.near.org`) | Current stake per validator pool account, for example `chorusone.poolv1.near`, `figment.poolv1.near` and `everstake.poolv1.near` (verify each id) | M |
| BigQuery over `sputnik-dao.near` sub-accounts | DAO count and 30d proposal and vote calls for AstroDAO and Sputnik DAOs | L |
| BigQuery over the correct Social contract (`social.near`) | 7d signers and 30d `set` calls for Near Social | L |
| BigQuery over launchpad factories (`meme-cooking.near` and each launchpad's factory) | Sub-accounts created per day, which counts tokens launched | L |
| GeckoTerminal token pools on NEAR (Rhea) | 24h volume and liquidity for memecoin and launchpad tokens | L |
| Intents Explorer by referral (already built) | Volume routed by wallets, aggregators and apps | S |

## 3. Per-sector metrics
Leaders in brackets are the current curated top names. The headline is the first row.

### DEXs and Liquidity (Rhea Finance, Trisolaris, LeoDex, Veax)
| Metric | Source | Effort |
|---|---|---|
| **Headline** 30d DEX volume | DefiLlama dexs | S |
| TVL | DefiLlama | S |
| 30d fees, revenue, supply-side revenue | DefiLlama fees | S |
| 24h volume and liquidity, top pools | GeckoTerminal | S |
| Aggregator volume, for routers like LeoDex | DefiLlama aggregators | S |
| Largest pool APY, pool count | DefiLlama yields | S |
| Token holders on NEAR and Aurora | NearBlocks, Blockscout | S |
| 30d function calls | BigQuery | S |

### Bridges and Interoperability (NEAR Intents, NEAR Omni Bridge, Portal)
| Metric | Source | Effort |
|---|---|---|
| **Headline** 30d volume (relabel from "30d DEX volume") | DefiLlama | S |
| TVL for lock-and-mint bridges | DefiLlama | S |
| 30d fees, revenue, holders revenue, supply-side revenue | DefiLlama fees | S |
| Bridge aggregator volume (Stableflow, Rubic) | DefiLlama | S |
| 7d signers, 30d function calls | BigQuery | S |

### Lending and Credit (Rhea Lend, Templar Protocol)
| Metric | Source | Effort |
|---|---|---|
| **Headline** total deposited (TVL plus borrowed) | DefiLlama | S |
| Borrowed, TVL, utilization, borrow APY | DefiLlama and yields `/lendBorrow` | S |
| 30d fees and revenue | DefiLlama | S |
| Token holders | NearBlocks, Blockscout | S |
| DEX volume | Not applicable, hidden | |

### Liquid Staking and Restaking (Meta Pool, Rhea LST, LiNEAR)
| Metric | Source | Effort |
|---|---|---|
| **Headline** TVL (NEAR staked) | DefiLlama | S |
| Staking APY | DefiLlama yields | S |
| LST holders | NearBlocks | S |
| Own-token staking, kept out of TVL | DefiLlama | S |
| 30d fees and revenue | DefiLlama | S |

### Yield and Asset Management (Aurora+, Dew Finance)
| Metric | Source | Effort |
|---|---|---|
| **Headline** TVL | DefiLlama | S |
| Largest pool APY, pool count | DefiLlama yields | S |
| 30d fees and revenue | DefiLlama | S |
| Fix | Aurora+ must count in the same total as its leader row, or drop out of both if inactive | S |

### Perps, Options and Derivatives (Orderly Network, HeX)
| Metric | Source | Effort |
|---|---|---|
| **Headline** TVL (collateral) | DefiLlama | S |
| 30d fees and revenue | DefiLlama | S |
| 30d function calls (HeX) | BigQuery, `contracts.csv` | L |
| Open interest and perps volume | Not tracked. DefiLlama open interest returns errors for NEAR and perps volume is paid. | |
| Fix | Spin is defunct, so it leaves the leaders | S |

### RWA and Tokenized Assets (KAIO, Ondo Finance, SVRN)
| Metric | Source | Effort |
|---|---|---|
| **Headline** TVL or tokenized supply | DefiLlama, NearBlocks supply for issued tokens | S |
| Token holders | NearBlocks | S |
| Supply on NEAR × price | NearBlocks | S |
| NEAR held in treasury (SVRN) | Shown as an Other signal with its date, not a metric | S |

### Stablecoins and Payments (USDC, USDT, Ping Pay)
| Metric | Source | Effort |
|---|---|---|
| **Headline** supply on NEAR and Aurora | DefiLlama stablecoins | S |
| Holders on NEAR and Aurora | NearBlocks, Blockscout | S |
| Supplied and borrowed in Rhea Lend | yields `/lendBorrow` | M |
| 7d signers for payment apps (Ping Pay) | BigQuery | L |

### Trading Tools and Bots (Delta Trade, Banana Gun, NearFi)
| Metric | Source | Effort |
|---|---|---|
| **Headline** 30d volume routed, flagged as counted again by the DEX | DefiLlama | S |
| 30d fees and revenue | DefiLlama | S |
| NEAR Intents volume routed | Explorer referral | S |
| 7d signers to bot contracts (`grid.deltatrade.near`) | BigQuery | L |

### Launchpads (Pump.fun, Meme Cooking, JustHoot)
| Metric | Source | Effort |
|---|---|---|
| **Headline** tokens launched in 30 days | BigQuery, counting new sub-accounts under each factory. Map the factories in `contracts.csv` with Role `factory`. | L |
| 30d volume of launched tokens | DefiLlama for Meme Cooking, GeckoTerminal token pools for the rest | L |
| Holders of the top launched tokens | NearBlocks | L |
| 30d fees and revenue | DefiLlama | S |

### Memecoins and Community (Black Dragon, Shitzu, JAMBO)
| Metric | Source | Effort |
|---|---|---|
| **Headline** token holders on NEAR | NearBlocks | S |
| 24h volume and liquidity | GeckoTerminal token pools | L |
| Supply on NEAR × price | NearBlocks | S |
| Market cap | Not shown, since free sources give a global figure | |

### NFTs, Gaming and Collectibles (SWEAT, Namesky, Paras)
| Metric | Source | Effort |
|---|---|---|
| **Headline** 7d signers to the game or collection contracts (changed from holders, per accuracy rule 10) | BigQuery | L |
| 30d function calls | BigQuery | L |
| Token or collection holders, flagged where app-created accounts inflate them (SWEAT) | NearBlocks | S |
| Marketplace volume | Not tracked | |

### AI Agents (NEAR AI, NEAR AI Agent Market, IronClaw)
| Metric | Source | Effort |
|---|---|---|
| **Headline** 7d signers to the project's contracts (changed from holders, since most AI projects have no token) | BigQuery | L |
| NEAR Intents volume routed by agents that set a referral | Explorer referral | S |
| Token holders | NearBlocks | S |
| Offchain usage (agent runs, API calls) | Not tracked, self-reported only | |

### Prediction Markets (Noa Market, Prophet, Kalshi)
| Metric | Source | Effort |
|---|---|---|
| **Headline** 7d signers to market contracts | BigQuery, after mapping contracts | L |
| TVL, 30d fees | DefiLlama where listed | S |
| Fix | Kalshi needs its NEAR presence checked. If it only routes through Intents, show referral volume and treat it as a fact rather than a market. | S |

### Social and Identity (Near Social, NEAR Email)
| Metric | Source | Effort |
|---|---|---|
| **Headline** 7d signers | BigQuery on `social.near` (fix the mapping) | L |
| 30d `set` calls | BigQuery | L |

### DAOs, Governance and Public Goods (NEAR House of Stake, POTLOCK, AstroDAO)
| Metric | Source | Effort |
|---|---|---|
| **Headline** 7d signers | BigQuery on `potlock.near`, `donate.potlock.near`, the `sputnik-dao.near` factory and House of Stake's contracts | L |
| DAOs created and active (AstroDAO) | BigQuery sub-accounts of `sputnik-dao.near` with calls in 30 days | L |
| Donations routed (POTLOCK) | BigQuery transfers to `donate.potlock.near` | L |

### Unmeasured sectors (facts, no tier)
| Sector (leaders) | Fact shown, used to rank leaders where it exists | Source | Effort |
|---|---|---|---|
| Infrastructure and Dev Tools (NEAR Protocol, Aurora, FastNEAR) | Role as text. NEAR Protocol and Aurora also show chain gas fees, transactions and active accounts. | Dataset, chain data | S |
| Wallets and Custody (HOT Wallet, Meteor Wallet, MyNearWallet) | NEAR Intents volume routed by the wallet's referral, then 7d signers to its own contracts (`game.hot.tg`) | Explorer, BigQuery | S |
| Exchanges and On/Off-Ramps (Binance, Bitget, KuCoin) | Assets held on NEAR, kept out of chain TVL | DefiLlama CEX | S |
| Validators and Node Operators (Chorus One, Figment, Everstake) | NEAR staked with the operator's pools | NEAR RPC `validators` | M |
| Security, Risk and Compliance (HackenProof, Hacken, Immunefi) | NEAR projects that list the firm as auditor or bounty host | Audits column | S |
| Ecosystem, Funding and Education (NEAR Foundation, Proximity Labs, NEAR One) | Disclosed funding deployed or raised, with dates | Funding rounds file | S |
| Data and Analytics (NearBlocks, Pikespeak, DefiLlama) | Role as text | Dataset | S |
| Other | Role as text | Dataset | S |

## 4. Order of work
1. **S, about half a day.**
   - Section 1b cards and section 1c pop-up.
   - The one ranking rule, with inactive projects out of leaders.
   - Totals and leaders on the same project set.
   - Relabel the bridges headline.
   - Switch NFTs and AI Agents to signers.
   - Remove "With traction" from unmeasured sectors.
   - Add unmeasured facts that need no new data (CEX assets, wallet Intents volume, auditor counts, funding).
2. **M, a few hours.** NEAR RPC validator stake.
3. **L, ongoing.**
   - Contract mapping for launchpad factories, `social.near`, Sputnik DAO, POTLOCK, House of Stake, prediction markets, game contracts and HeX.
   - GeckoTerminal token pools for memecoins and launched tokens.

## 5. Build notes (Nov 13)
Decisions taken when the spec was built, and where the data said something different from section 0.

**Decisions.**
- **A 1% floor on ranking values.** A value ranks a leader only if it is at least 1% of the sector's top value; smaller values keep curated order. Without it, Polaris Finance ($0.1K of 30d DEX volume) would outrank LeoDex. `LEADER_FLOOR` in `src/lib/sector-metrics.ts`.
- **Cards are ordered by project count**, then name. The card metric switch is gone; the old `sg` URL key still parses so old links load.
- **Counts are not summed in the pop-up.** Holders and signers overlap across projects, so a count metric shows its largest value and whose it is. Money and NEAR metrics are summed.
- **Security and Ecosystem facts come from the research files.** `auditedProjects` counts atlas projects whose audits column names the firm as a whole word, so "Hacken" does not match "HackenProof". `fundingDisclosed` is the total size of the disclosed rounds the organisation joined as an investor, not its own share. `src/lib/research-facts.ts`.

**Where the data differs from section 0.**
- **Near Social is mapped correctly.** `social.near` is in `data/contracts.csv` with 318 days of BigQuery history. `db.social08.near` has none. The 38 signers in 7 days are real (6 or 7 distinct signers a day), so no mapping changed.
- **SWEAT under signers.** Relayers sign for SWEAT's users, so it shows a few hundred signers against 23.2M holders. It ranks second to Pumpopoly in NFTs on signers, and its holders row carries an app-created-accounts flag.
- **Launch counts.** `meme-cooking.near` was already mapped with Role `factory`, but the mapping was added after the receipts backfill and daily runs re-read only 3 days, so `factory-launches.json` was empty.
- **Bastion is Inactive.** It wound down in its August 2023 merger into Aurigami, when depositors were told to withdraw, and bastionprotocol.com now redirects to the merger and unwind page ([Bastion's announcement, archived](https://web.archive.org/web/20230922054006/https://bastionprotocol.medium.com/joining-forces-with-aurigami-b76c994558e0)). DefiLlama still lists about $0.8M of funds not yet withdrawn, without flagging the protocol. Its status in the research CSV is now Inactive, so it leaves the Lending leaders and totals.
- **Kalshi has no NEAR contract.** Since November 2025 it accepts native NEAR deposits and withdrawals through its custodial providers. No source ties it to NEAR Intents, and `kalshi.near` is an empty account with no link to Kalshi. It stays in Prediction Markets with no onchain metric.
