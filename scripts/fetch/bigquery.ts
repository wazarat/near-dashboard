/**
 * NEAR BigQuery public dataset (bigquery-public-data.crypto_near_mainnet_us). Queries live in
 * queries/*.sql and are added in the chain-activity milestone; until then the source reports itself
 * as pending so the rest of the refresh is unaffected.
 */
import { skipped, type Ctx, type RunResult } from "./context";

export async function run(ctx: Ctx): Promise<RunResult> {
  if (!ctx.env.GCP_PROJECT_ID) return skipped("GCP_PROJECT_ID not set");
  return skipped("BigQuery queries are added in the chain-activity milestone");
}
