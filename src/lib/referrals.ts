/**
 * NEAR Intents volume, swaps and app fees per integrating app, from the referral tag on each 1Click swap
 * (docs/LIVE-DATA.md, requirement 6). Pure, so the sums and the mapping are tested. The volume is already inside
 * NEAR Intents' own figure, so it is shown per app but never added to an app's DEX volume.
 */
export interface ReferralDay {
  date: string;
  partial?: boolean;
  referrals?: Record<string, { count: number; usd: number }>;
  /** App fees in USD per referral tag; absent on days whose rows did not keep the fee rate. */
  referralFees?: Record<string, number>;
}

export interface ReferralTotal {
  key: string;
  count: number;
  usd: number;
  /** App fees in USD over the window, or null when any day in the window lacks fee rates. */
  fees: number | null;
}

/**
 * Sums over the last `days` complete days, largest first. "(none)" and "(other)" are not apps and are left out.
 * Fees are summed only when every day in the window carries them, so a partial sum is never shown as 30 days.
 */
export function referralTotals(all: ReferralDay[], days = 30): { rows: ReferralTotal[]; days: number; end: string | null; feeDays: number } {
  const complete = all.filter((d) => !d.partial).sort((a, b) => a.date.localeCompare(b.date)).slice(-days);
  const feeDays = complete.filter((d) => d.referralFees).length;
  const feesComplete = complete.length > 0 && feeDays === complete.length;
  const sums = new Map<string, ReferralTotal>();
  for (const d of complete) {
    for (const [key, v] of Object.entries(d.referrals ?? {})) {
      if (key === "(none)" || key === "(other)") continue;
      const t = sums.get(key) ?? { key, count: 0, usd: 0, fees: feesComplete ? 0 : null };
      t.count += v.count;
      t.usd += v.usd;
      if (t.fees !== null) t.fees += d.referralFees?.[key] ?? 0;
      sums.set(key, t);
    }
  }
  return { rows: [...sums.values()].sort((a, b) => b.usd - a.usd), days: complete.length, end: complete.at(-1)?.date ?? null, feeDays };
}

export interface ReferralMapRow {
  referral: string;
  project: string;
  verified: boolean;
}

/** Per project: 30-day volume, swaps and app fees over its verified referral tags. Unverified rows are not shown. */
export function referralsByProject(totals: ReferralTotal[], map: ReferralMapRow[]): Map<string, { usd: number; count: number; fees: number | null; tags: string[] }> {
  const byKey = new Map(totals.map((t) => [t.key, t]));
  const out = new Map<string, { usd: number; count: number; fees: number | null; tags: string[] }>();
  for (const r of map) {
    if (!r.verified || !r.project) continue;
    const t = byKey.get(r.referral);
    if (!t) continue;
    const v = out.get(r.project) ?? { usd: 0, count: 0, fees: 0, tags: [] };
    v.usd += t.usd;
    v.count += t.count;
    v.fees = v.fees === null || t.fees === null ? null : v.fees + t.fees;
    v.tags.push(r.referral);
    out.set(r.project, v);
  }
  return out;
}

/** The referral tags with the most volume that no verified row maps to a project, for labelling. */
export function unmatchedReferrals(totals: ReferralTotal[], map: ReferralMapRow[], limit = 50): ReferralTotal[] {
  const mapped = new Set(map.filter((r) => r.verified && r.project).map((r) => r.referral));
  return totals.filter((t) => !mapped.has(t.key)).slice(0, limit);
}
