# NEAR Hackathon submission pack

Track: `thesis` (Investment Thesis). Repository: https://github.com/wazarat/near-dashboard. Live: https://near-dashboard-puce.vercel.app

## Project description (for the submission form, 20 to 2000 characters)

NEAR Ecosystem Atlas maps 1,088 projects across NEAR and Aurora with researched traction, funding and security, then tracks the ecosystem every day from free sources: DefiLlama per-protocol and chain history, NearBlocks daily chain activity, the NEAR BigQuery public dataset for function calls, contracts called and distinct signers, and the NEAR Intents Explorer API for 1Click swap volume, routes, assets and referrals. Every chart shows its takeaway, its source and a table view; the thesis charts also show the exact SQL or API call and transform behind them.

The investment thesis it tests is that cross-chain volume through NEAR Intents is a better leading indicator of real NEAR network usage than the token price. The repo computes the answer rather than asserting it: weekly lead-lag cross-correlations at lags of −8 to +8 weeks, an out-of-sample forecasting check with a fixed cutoff, and robustness variants (capped spikes, usage without Intents settlement receipts, daily data, Explorer versus DefiLlama volume). THESIS.md and the /thesis page are generated from the same JSON by `npm run rebuild`, which needs no network or secrets, so judges can rebuild every number from the committed raw files. The current result, its evidence for and against, the confounders (incident, incentive programs, fee switch, ETF listing) and what would change the conclusion are all stated in THESIS.md.

NEAR's role: NEAR Intents is the object of study and the NEAR BigQuery public dataset and NearBlocks are the usage ground truth; the daily GitHub Action keeps both current with Workload Identity Federation and cost-guarded queries.

## 60-second demo script

1. (0:00) Open the live site on the Overview. "1,088 projects, 24 sectors. NEAR-native projects are 60% of the list but hold 97% of TVL." Point at the KPI tiles and the native vs imported bars.
2. (0:10) Switch metric to Volume. "NEAR Intents is 92% of 30-day DEX volume; that skew is why the charts default to log scale." Hover the treemap.
3. (0:18) Open the Intents page. "Daily 1Click swap volume from the Explorer API next to DefiLlama's all-channel series, with the share, routes and referrals." Scroll routes.
4. (0:30) Open the Thesis page. Read the verdict badge and headline. Click the Query tab on the lead-lag chart: "Every chart shows the SQL or API call behind it."
5. (0:42) Show the robustness table and the evidence-against column. "The result is honest: the edge appears in contract-level usage, not in the chain-level counts."
6. (0:50) Show the terminal: `npm run rebuild` finishing with the strict data checks and THESIS.md regenerated. "No network, no secrets, same numbers."
7. (0:57) Back to the repo README. End.

## Draft X post (post it yourself)

Built at NEAR HACKATHON: NEAR Ecosystem Atlas, an independent map of 1,088 NEAR and Aurora projects with daily history, chain activity from the NEAR BigQuery public dataset and NEAR Intents swap volume. It tests one thesis: is Intents volume a better leading indicator of real usage than price? The data says: partly supported so far. The edge shows up in contract-level usage (function calls and contracts called), not in chain-level counts, and every test, including the evidence against, is in THESIS.md. Every chart shows its query; `npm run rebuild` reproduces THESIS.md from committed raw files.

Live: https://near-dashboard-puce.vercel.app
Repo: https://github.com/wazarat/near-dashboard

@NEARProtocol #NEARHackathon @NearLegion @NearBuilders

## Submission fields the human decides

Project name, team lead name, contact email, team size, tracks (`thesis`, optionally `open`), NEAR payout account, repository link, demo post link, description (above), consent. The API accepts one submission per repository; mistakes go through https://nearhackathon.com/request-changes.
