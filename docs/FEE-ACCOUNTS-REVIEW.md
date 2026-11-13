# Fee and treasury accounts for review

Researched on 2026-11-13 for the 10 largest live DEXs, aggregators and launchpads that have no fee data from DefiLlama. They are ranked by TVL, DEX volume and NEAR Intents volume routed.

**Every row is unverified and unused.** Nothing here is in `data/contracts.csv`. To use a row, the owner confirms it, then it is added to `TREASURIES` in `scripts/seed-contracts-metrics.ts` with its evidence and `npm run seed:contracts:metrics` is run.

**Checks used:**
- NearBlocks `/v1/account/{id}`: existence, creation date and creating account.
- NEAR RPC view calls: `intents.near` `mt_tokens_for_owner` and `v1.jumbo_exchange.near` `metadata`.
- Aurora RPC and Aurora Blockscout `/api/v2/addresses/{0x}`.
- The NEAR Intents Explorer's `appFees` recipients.

"Intents tokens" counts the distinct token ids an account holds inside `intents.near`. A 1Click app-fee recipient builds up its fees there.

| # | Project | Candidate account | Believed role | Evidence | Exists | Confidence |
|---|---|---|---|---|---|---|
| 1 | SwapKit | `swapkit.near` | 1Click app-fee recipient | Named in Explorer `appFees`; created 2025-06-05; 34 intents tokens; SwapKit's pricing page says fee collection is automated | yes | medium |
| 1 | SwapKit | `ledgerswapkit.near`, `trustswapkit.near`, `tangemswapkit.near`, `swapspaceswapkit.near` | Per-integrator app-fee recipients (Ledger, Trust Wallet, Tangem, SwapSpace through SwapKit) | Named in Explorer `appFees`; 33, 11, 0 and 8 intents tokens; Ledger's blog announces NEAR Intents through SwapKit | yes (all 4) | low to medium: may be the partners' revenue, not SwapKit's |
| 2 | LI.FI | `lifi_int.near` | 1Click app-fee recipient | Named in Explorer `appFees`; created 2026-03-03; 2 intents tokens; LI.FI announced its NEAR Intents integration in Feb 2026 | yes | medium |
| 2 | LI.FI on Aurora | none found | | No Aurora fee collector address in LI.FI's docs | | |
| 3 | LeoDex | `leodex.near` | 1Click app-fee recipient | Named in Explorer `appFees`; created 2025-08-15; 2 intents tokens; LeoDex's blog says it integrated NEAR Intents | yes | medium |
| 4 | Jumbo Exchange | `v1.jumbo_exchange.near` | Exchange contract; its protocol fee is minted to itself as LP shares | `metadata` gives owner `v1.jumbo_exchange.near`, exchange fee 1400 and referral fee 300; contract source sets `exchange_id` to the current account (github.com/jumbo-exchange/contracts); it holds LP shares in pools 0 to 4 | yes | high for how fees work, medium as a fee metric |
| 4 | Jumbo Exchange | `jumbo_exchange.near` | Parent account, possibly the team's | Holds about 1,996 NEAR; no document ties it to fees | yes | low |
| 5 | KyberSwap | none found | | `kyberswap.near` was created 2021-04-09 and holds nothing in intents; Kyber's docs name a cross-chain platform fee but no NEAR recipient | `kyberswap.near` yes | none |
| 6 | Solswap | `solswap.intents-referral.near` | A referral label account, likely not a fee wallet | Created 2025-01-21 by `intents-referral.near`; 0 intents tokens | yes | low |
| 7 | Curve Finance on Aurora | `0x7EeAC6CDdbd1D0B8aF061742D41877D7F707289a` | Owner of the Aurora 3pool, which can withdraw admin fees | The 3pool (listed in curve-js) returns this address from `owner()`; its admin fee is 50%; about $655 of admin fees sit unclaimed in the pool | yes (the externally owned account that created the pool) | medium |
| 7 | Curve Finance on Aurora | `0xf3A431008396df8A8b2DF492C913706BDB0874ef` | `fee_receiver` of the stable-ng and twocrypto factories | Both factories report a pool count of 0, so it collects nothing today | yes | low |
| 8 | Impossible Finance on Aurora | `0x4997C98daECDA89488dbCdAEB3DF084410B8825c` | `governance` of the Aurora swap factory (a Gnosis Safe), likely the team multisig | Factory from DefiLlama's adapter; `feeTo` is the zero address, so no protocol swap fee is switched on | yes | low |
| 8 | Impossible Finance launchpad | none found | | Sale contracts have no fee variable, and no Aurora sale addresses are published | | |
| 9 | Rango Exchange | `rangorng.near`, `rangotw.near`, `rangoni.near` | 1Click app-fee recipients for separate integrator streams | Named in Explorer `appFees`; one account, `sinancrypto.near`, created all three, which links them to each other but not provably to Rango; 2, 2 and 20 intents tokens | yes (all 3) | medium for `rangorng.near`, low to medium for the others |
| 10 | THORSwap | `thorswap.near` | 1Click app-fee recipient (THORSwap through SwapKit) | Named in Explorer `appFees`; created 2025-06-12, the day SwapKit's blog says NEAR Intents went live on THORSwap; 46 intents tokens | yes | medium to high |

## Points to settle before using any row

- **SwapKit and THORSwap may overlap.** THORSwap runs on SwapKit, so counting `thorswap.near` and the `*swapkit.near` accounts under both projects could count the same fees twice.
- **App fees are already measured.** For apps that tag their 1Click swaps, the site now computes app fees per app from the Explorer's fee rates (the "30d NEAR Intents app fees" metric). A fee-recipient account is needed only to measure fees earned outside 1Click.
- **Jumbo's fee is not a transfer.** Its fee would be measured from the growth of `get_pool_shares(pool, "v1.jumbo_exchange.near")`, or as volume × pool fee × 14%, not from transfers to an account.
- **Curve's only Aurora pool holds its fees unclaimed.** They are about $655 accrued, so the fee figure is small and moves only when someone claims it.
