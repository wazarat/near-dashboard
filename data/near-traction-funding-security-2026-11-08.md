# NEAR and Aurora ecosystem, traction, funding and security (Nov 8, 2026)

Companion to `claude/near-ecosystem-2026-11-08.csv` (1,088 projects, 29 columns in the Robinhood Chain layout plus Chain Presence, TVL on NEAR and TVL on Aurora). Sources are NEAR Catalog (all 344 projects via its API, the same data behind nearprotocol.eco), AwesomeNEAR (789 of 1,093 listings, since its full-list API is broken and only the first 48 per category load), the Aurora ecosystem page (110), the near.org ecosystem page (10), DefiLlama (pulled Nov 8, 2026, 105 protocols on NEAR or Aurora) and news research. Funding was researched for 75 projects and security for 27 projects plus both chains (14 more security targets, including Paras, Mintbase, Sender and the old Aurora DEXs, were not reached before the search budget ran out). Everything else is marked "Not researched".

## Traction

Chain level on DefiLlama
- NEAR TVL $174.9M (default view, excludes liquid staking and bridges). Summing every tracked protocol gives $538M
- Aurora TVL $3.8M
- NEAR 30d DEX volume $4.19B, 30d fees $6.82M, 30d revenue $2.15M
- Aurora 30d DEX volume $4.2M, fees effectively zero

Sector totals (TVL / 30-day DEX volume / 30-day fees)
- Liquid Staking & Restaking, $199.1M / n.a. / $12K
- Bridges & Interoperability, $152.4M / $3.88B / $5.93M (almost all NEAR Intents)
- Lending & Credit, $151.2M / n.a. / $269K
- DEXs & Liquidity, $26.8M / $313.6M / $616K
- RWA & Tokenized Assets, $4.0M / n.a. / under $1K
- Yield & Asset Management, $2.9M / n.a. / n.a.
- Perps, Options & Derivatives, $0.4M, mostly stranded in dead venues
- Trading Tools & Bots, $0.1M / $0.45M / n.a.
- Launchpads, under $5K / $2.4K / under $10

Tier 1 leaders (TVL >= $50M, or 30d volume >= $500M, or 30d fees >= $1M), same thresholds as the Robinhood Chain set
- NEAR native, NEAR Intents, Rhea Lend (formerly Burrow), Meta Pool, Rhea LST
- Tier 2, Rhea Finance DEX, LiNEAR, NEAR Omni Bridge, NEAR Protocol (chain fees)
- No Aurora-native or imported project reaches Tier 2

Key figures
- NEAR Intents, $3.88B 30d volume, $5.93M fees, $1.94M revenue, $99M TVL, past $31B cumulative volume (Oct 2026)
- Rhea Lend $149.1M TVL, the largest single protocol. Rhea suite (DEX, Lend, LST) holds $242M
- Rhea Finance DEX, $23.3M TVL, $306M 30d volume, $615K fees
- Liquid staking, Meta Pool $80.8M, Rhea LST $69.7M, LiNEAR $47.6M
- NEAR chain itself, $170K 30d fees and $119K revenue
- Aurora's largest apps, Aurora+ $2.5M, Trisolaris $1.9M TVL and $3.8M volume, Bastion $0.8M, Aurigami $0.6M
- CEX reserves on NEAR (kept out of TVL), Binance $522M, Bitget $19.4M, KuCoin $18.6M, Gate $15.7M

## Funding

- Ecosystem capital. NEAR raised $150M (Jan 2022, 3AC) and $350M (Apr 2022, Tiger Global). The Oct 2021 $800M initiative included Proximity's $350M DeFi grants vehicle, and Aurora launched a $90M fund in May 2022. NEAR Foundation launched a $20M AI agent fund in Feb 2025. Aurora DAO granted 25M AURORA to Aurora Labs for both 2025 and 2026.
- App-level VC peaked in 2021 and 2022. Orderly ~$25M, Sweat $13M token sale, Aurora Labs $12M, Aurigami $12M, Few and Far $10.5M, Playible $10M, Bastion $9M, Mintbase $7.5M, Ref $4.8M, Burrow $5M, Tonic $5M, Spin $3.75M. Several of these venues are now defunct.
- 2025 and 2026 money comes mostly from public-market wrappers. OceanPal raised a $120M PIPE (Oct 2025) to start SovereignAI (now SVRN), which held 53.9M NEAR and bought FastNEAR in Oct 2026. Bitwise's spot NEAR ETF (NRR) began trading on NYSE Arca on Sep 29, 2026, and Grayscale filed to convert its NEAR trust.
- Native VC rounds in 2025 and 2026 are rare. Templar $4M pre-seed (Mar 2025, Robot Ventures), TruFin strategic round (Feb 2026, SC Ventures). Bitte (formerly Mintbase) was bought by Amadeus Protocol for $1.7M in AMA tokens (Feb 2026).
- Of 75 researched projects, 34 have disclosed VC money and 20 have nothing disclosed, including NEAR Intents (Defuse), LiNEAR, Allstake, DeltaTrade, Pikespeak, NearBlocks and most of the 2026 memecoin launchpads.

## Security

Chain level, NEAR
- 352 validators, Nakamoto coefficient 9 (Chainspect). Stateless validation (Nightshade 2.0) since Aug 2024, 600ms blocks since May 2025.
- Liveness incidents, a 30-minute slowdown on Jul 3, 2025 (validator set passed 256, official postmortem) and a reported ~3-hour partial halt on Aug 18, 2025 (third-party status page only, unverified).
- Two node-crash bugs caught through bounties (oversized receipt, Nov 2024; Zellic "Ping of Death", $150K bounty).
- Inflation cut from 5% to 2.5% in Oct 2025 by validator upgrade after an August community vote missed its 66.67% threshold. Chorus One refused to upgrade.
- Chain Signatures MPC launched Aug 2024 with 8 named operators (target 40+), audited by Kudelski with Trail of Bits reports, running in Intel TDX enclaves.

Chain level, NEAR Intents and Aurora
- NEAR Intents' DAO multisig can upgrade, pause and withdraw all funds (Hacken audit, Dec 2024). Its SHIELD layer froze $503K of Bitget hack proceeds in Sep 2026. Bug bounty up to $300K on HackenProof.
- Aurora Engine is a contract on NEAR, not a rollup, and has no L2BEAT page. Upgrade-key holders are not documented. Mainnet stopped producing blocks for several hours on Jul 20, 2026 with no published root cause.

Incidents
- Apr 16, 2026, Rhea Finance margin-trading exploit, $18.4M (initial estimate $7.6M), about $11.2M returned or frozen, ~$4M of ZEC moved into shielded pools. Lending resumed May 13 under a recovery framework.
- Apr 29, 2026, SWEAT token drained of 13.71B tokens (~65% of supply, ~$3.5M) via a missing `#[private]` guard on `ft_resolve_transfer`. Balances restored. Fireblocks found the same flaw in HOT, patched the same day.
- Oct 1, 2026, NEAR Intents lost $3.8M of BSC USDT from the HOT Bridge treasury through a failed-deposit-notification bug. Patched within an hour and fully returned two days later.
- Jun 17, 2025, Meta Pool mpETH unauthorized mint, $27M notional but ~$132K actually lost.
- 2022 legacy, Aurora inflation bug ($6M Immunefi bounty, no loss), two $1M Rainbow Bridge bounties, two failed Rainbow Bridge attacks, Stader NearX infinite mint (Aug), USN ~$40M collateral gap (Oct), Skyward Finance ~$3M drained (Nov), NEAR Wallet recovery data leak (Jun).

Project risk
- High, Rhea Finance and its siblings (recent $18.4M exploit, margin feature unaudited), Skyward Finance, Decentral Bank (USN), Stader NearX, Octopus Network (wound down)
- Medium, NEAR Intents, Omni and Rainbow Bridge, Aurora, Meta Pool, LiNEAR, HOT, Orderly, Sweat, Jumbo, MyNearWallet, Chain Signatures
- Low, NEAR L1, Templar (Certora formal verification, $100K Immunefi bounty), Allstake (BlockSec, no high findings)
- 8 more researched projects with no audit or incident found are rated Unknown

## Ecosystem insights (from the 1,088-row dataset)

1. One app is the chain. NEAR Intents does 92% of 30d DEX volume, 85% of fees and 86% of revenue. Only 61 of 1,088 projects have measurable TVL and 16 have volume or fees. The top 3 hold 61% of TVL and the top 10 hold 98%.
2. Natives hold everything, the opposite of Robinhood Chain. NEAR-native projects are 60% of the list but 97% of TVL and nearly all volume and fees. The 197 imported EVM projects hold 0.8% of TVL.
3. TVL is staking, bridges and one lender. Liquid staking ($199M), bridges ($152M) and Rhea Lend ($149M) make up 93% of protocol TVL. DEX liquidity is only $27M. Binance alone holds $522M of NEAR-chain assets, more than all of DeFi combined.
4. Revenue capture varies. NEAR Intents keeps 33% of fees, Rhea Lend 27%, Rhea DEX 20%, Veax 25%, Rhea LST 100%, and the chain itself 70%.
5. Aurora is a legacy layer. 170 projects are Aurora-native but only 17 show any traction, with $6.4M combined TVL and $4.2M of 30d volume. Aurora DAO's 2026 plan paused the Calyx launchpad and new virtual chains to refocus on Intents Connect.
6. The directories are archives. 620 listings come only from AwesomeNEAR's 2021 to 2023 era with unknown status, 73 are marked inactive in NEAR Catalog and 39 have dead DefiLlama pages. Even in NEAR Catalog, only 20 of 340 projects have tracked traction.
7. Oversupply in NFTs and gaming. 220 entries with zero measurable TVL. SWEAT is the only one with real scale.
8. A memecoin launchpad wave is under way. 35 launchpads, many listed in NEAR Catalog between Sep and Nov 2026 (JustHoot, Nearly, Shards, NEARRR.fun, Shore, plus Pump.fun live on NEAR from Nov 2026), but launchpad TVL is under $5K and only Meme Cooking is tracked on DefiLlama.
9. Chain abstraction is the identity. 45 of 344 NEAR Catalog projects are tagged NEAR Intents, including outside wallets and apps (Brave Wallet, Zashi, KyberSwap, SwapKit, Ondo, Infinex). Most integrate Intents rather than build on NEAR.
10. AI is the narrative, not yet onchain traction. 31 AI agent projects led by NEAR AI (Cloud, Agent Market, IronClaw), but none is tracked by DefiLlama and no AI app shows fee data.
11. Gaps. No live native perps venue (Spin is dead, Orderly went omnichain, HOT's HeX is still building), only 5 prediction markets, and no NEAR-native stablecoin issuer since USN.
12. Recent losses are concentrated in DeFi primitives. The three largest 2026 incidents (Rhea $18.4M, Intents $3.8M, SWEAT $3.5M) all hit core infrastructure, and two of them traced to cross-contract callback and notification logic.

Caveats. Native-chain labels for directory-only rows are heuristic (Confidence column). AwesomeNEAR rows without traction keep "Unknown (legacy 2021-23 listing)" status because the site marks everything active. Thresholds for Tier 2 (TVL >= $5M, volume >= $50M or fees >= $100K) and Tier 3 (any measurable activity) are defined here, since the Robinhood set only documented Tier 1.
