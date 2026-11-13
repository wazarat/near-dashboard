# Operations

## Daily refresh

`.github/workflows/refresh.yml` runs at 03:23 UTC (and on demand with a `backfill` switch). It runs `npm run refresh`, then `npm run rebuild`, `npm test` and `npm run build`, and commits `data/history`, `data/raw` and `THESIS.md` only when they changed, authored as Wazarat Hussain with the message `data: refresh YYYY-MM-DD`. The push triggers the Vercel deploy.

Repository settings the workflow needs (GitHub UI):

1. Settings, Actions, General, Workflow permissions: **Read and write permissions** (so the job can push the data commit).
2. Settings, Secrets and variables, Actions, Repository secrets:
   - `NEAR_INTENTS_JWT` (Explorer-type key from partners.near-intents.org)
   - `GCP_PROJECT_ID` = `canhav-eth-493705`
   - `GCP_WORKLOAD_IDENTITY_PROVIDER` (full provider resource name, printed by the setup below)
   - `GCP_SERVICE_ACCOUNT` = `near-dashboard-bq@canhav-eth-493705.iam.gserviceaccount.com`
   - optional `COINGECKO_DEMO_KEY`
   - `NEAR_ANCHOR_ACCOUNT_ID` = `canhav.near` and `NEAR_ANCHOR_PRIVATE_KEY` (the function-call key that can only call `set` on `social.near`; never a full access key) for the onchain anchor
3. Optional repository variables `INTENTS_BACKFILL_DAYS` (default 90) and `NEAR_RPC_URL` (default `https://rpc.mainnet.near.org`).

## Onchain anchor

The last step of the refresh writes the day's evidence fingerprints to SocialDB (`npm run anchor:write -- --soft`), then commits `data/anchors/<date>.manifest.txt`, `data/anchors/index.json` and the `anchor` status in `data/history/_meta.json` as `data: anchor <date>`. It never fails the job. Costs about 0.003 NEAR of prepaid SocialDB storage and at most 0.003 NEAR of gas (30 Tgas) per day. A warning appears in the log and in `_meta.json` when either the SocialDB storage or the key's allowance drops under 0.05 NEAR. To top up, run in your own terminal with the full access key:

```bash
near contract call-function as-transaction social.near storage_deposit json-args '{}' prepaid-gas '30 Tgas' attached-deposit '0.5 NEAR' sign-as canhav.near network-config mainnet sign-with-keychain send
```

A spent allowance needs a new function-call key (`near account add-key canhav.near grant-function-call-access ...`) and an updated `NEAR_ANCHOR_PRIVATE_KEY` secret; delete the old key afterwards.

A missing secret skips that source and records the reason in `data/history/_meta.json`; the job never fails for it.

## BigQuery auth without key files

The organisation forbids service-account keys, so:

- **Locally** the scripts use Application Default Credentials: `gcloud auth application-default login`, with `GCP_PROJECT_ID` in `.env.local`. Do not set `GOOGLE_APPLICATION_CREDENTIALS`.
- **In GitHub Actions** the workflow uses Workload Identity Federation (`google-github-actions/auth@v2` with `id-token: write`).

One-off federation setup, run from a shell logged in as the project owner (replace nothing; the values below are the project's):

```bash
export PATH="$HOME/google-cloud-sdk/bin:$PATH"
PROJECT=canhav-eth-493705
SA=near-dashboard-bq@$PROJECT.iam.gserviceaccount.com
REPO=wazarat/near-dashboard
PROJECT_NUMBER=$(gcloud projects describe $PROJECT --format='value(projectNumber)')

gcloud services enable iamcredentials.googleapis.com sts.googleapis.com --project $PROJECT

gcloud iam workload-identity-pools create github \
  --project $PROJECT --location global --display-name "GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc near-dashboard \
  --project $PROJECT --location global --workload-identity-pool github \
  --display-name "near-dashboard" \
  --issuer-uri "https://token.actions.githubusercontent.com" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition "assertion.repository=='$REPO'"

gcloud iam service-accounts add-iam-policy-binding $SA \
  --project $PROJECT --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$REPO"

# Value for the GCP_WORKLOAD_IDENTITY_PROVIDER secret:
gcloud iam workload-identity-pools providers describe near-dashboard \
  --project $PROJECT --location global --workload-identity-pool github --format 'value(name)'
```

The service account keeps only `roles/bigquery.jobUser` and `roles/bigquery.readSessionUser`; the public dataset needs no dataset-level grant.

## Rerunning a backfill

- Locally: `npm run refresh -- --backfill` (add `--only defillama,nearblocks` to limit sources, `--max-calls N` to cap paginated calls per source, `--dry-run` to fetch without writing).
- In GitHub: Actions, Refresh data, Run workflow, tick `backfill`.
- NEAR Intents Explorer only: Actions, Intents Explorer backfill, Run workflow (`.github/workflows/intents-backfill.yml`). One run reads up to `max_calls` pages (default 380, 1,000 rows each, 5.2 s apart, about 33 minutes) with `--only intents`, so BigQuery is not touched and the as-of date does not move. It commits the per-day aggregates on top of main and starts the next run by itself until the backfill is done, three runs fail in a row, or the `stop_after` time is within 45 minutes. A runner has no row files (`data/raw/intents/days/` is gitignored), so each run restarts at the oldest complete committed day and reads the day before it whole.
- One older BigQuery window: `BQ_START=2024-12-10 BQ_END=2025-11-07 BQ_QUERIES=daily_chain BQ_CHUNK_DAYS=14 npm run refresh -- --only bigquery --backfill --dry-run`, then the same without `--dry-run`. Raise `BQ_BACKFILL_MAX_BYTES` only after reading the dry-run total. Bytes per query land in `data/history/bq-usage.json`.

The history store is idempotent: a second run with the same upstream data produces no diff. Only the last three days of each series may be revised (DefiLlama restates recent days); older points are frozen.

## Store layout

```
data/history/_meta.json                     last run, per-source status, cursors, newly detected list
data/history/chain.json                     NEAR and Aurora chain series (DefiLlama), NearBlocks daily series, BigQuery daily series, price cross-checks
data/history/defillama/protocols.json       trimmed listing of every protocol on NEAR or Aurora
data/history/defillama/tvl-{near,aurora}.json         slug -> [date, usd]
data/history/defillama/{volume,fees,revenue,holders-revenue,supply-side-revenue,aggregators}-{near,aurora}.json   display name -> [date, usd]
data/raw/nearblocks/charts.json             raw NearBlocks chart rows
data/raw/catalog/projects.json              NEAR Catalog listing
data/raw/llama/price.json                   DefiLlama daily NEAR price
data/raw/bigquery/*.csv                     query results, one file per metric and date range
data/raw/intents/daily/YYYY-MM-DD.json      committed per-day aggregates of 1Click swaps
data/raw/intents/days/YYYY-MM-DD.json.gz    trimmed swap rows (gitignored, regenerable)
```
