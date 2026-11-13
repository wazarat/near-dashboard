import { describe, expect, it } from "vitest";
import { aggregateDay, trimRow, type ApiRow, type TrimRow } from "../scripts/fetch/intents";

const row = (o: Partial<ApiRow>): ApiRow => ({ depositAddress: Math.random().toString(36).slice(2), status: "SUCCESS", createdAt: "2026-11-12T10:00:00Z", amountInUsd: "1000", amountOutUsd: "990", referral: "swapkit", ...o });

describe("NEAR Intents app fees per referral", () => {
  it("keeps the summed app fee in basis points, leaving out the protocol's buyback fee", () => {
    const t = trimRow(row({ appFees: [{ recipient: "swapkit.near", fee: 80 }, { recipient: "buybacks.multisignature.near", fee: 1 }] }));
    expect(t[11]).toBe(80);
    expect(trimRow(row({ appFees: null }))[11]).toBe(0);
  });
  it("sums amountInUsd × bps / 10,000 over successful swaps only, per referral", () => {
    const rows = [
      trimRow(row({ appFees: [{ recipient: "swapkit.near", fee: 80 }] })), // $8
      trimRow(row({ amountInUsd: 500, appFees: [{ recipient: "swapkit.near", fee: 20 }] })), // $1
      trimRow(row({ status: "REFUNDED", appFees: [{ recipient: "swapkit.near", fee: 80 }] })), // not counted
      trimRow(row({ referral: "lifi", amountInUsd: 2000, appFees: [{ recipient: "lifi_int.near", fee: 5 }, { recipient: "buybacks.multisignature.near", fee: 1 }] })), // $1
    ];
    const day = aggregateDay("2026-11-12", rows, false);
    expect(day.referralFees).toEqual({ lifi: 1, swapkit: 9 });
    expect(day.referrals.swapkit).toEqual({ count: 2, usd: 1500 });
  });
  it("leaves fees out for a day whose rows were trimmed before the fee rate was kept", () => {
    const old = trimRow(row({})).slice(0, 11) as TrimRow;
    const day = aggregateDay("2026-11-01", [old, trimRow(row({ appFees: [{ recipient: "x.near", fee: 10 }] }))], false);
    expect(day.referralFees).toBeUndefined();
  });
});
