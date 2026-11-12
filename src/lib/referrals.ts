/**
 * NEAR Intents volume per integrating app, from the referral tag on each 1Click swap (docs/LIVE-DATA.md,
 * requirement 6). Pure, so the sums and the mapping are tested. The volume is already inside NEAR Intents' own
 * figure, so it is shown per app but never added to an app's DEX volume.
 */
export interface ReferralDay {
  date: string;
  partial?: boolean;
  referrals?: Record<string, { count: number; usd: number }>;
}

export interface ReferralTotal {
  key: string;
  count: number;
  usd: number;
}

/** Sums over the last `days` complete days, largest first. "(none)" and "(other)" are not apps and are left out. */
export function referralTotals(all: ReferralDay[], days = 30): { rows: ReferralTotal[]; days: number; end: string | null } {
  const complete = all.filter((d) => !d.partial).sort((a, b) => a.date.localeCompare(b.date)).slice(-days);
  const sums = new Map<string, ReferralTotal>();
  for (const d of complete) {
    for (const [key, v] of Object.entries(d.referrals ?? {})) {
      if (key === "(none)" || key === "(other)") continue;
      const t = sums.get(key) ?? { key, count: 0, usd: 0 };
      t.count += v.count;
      t.usd += v.usd;
      sums.set(key, t);
    }
  }
  return { rows: [...sums.values()].sort((a, b) => b.usd - a.usd), days: complete.length, end: complete.at(-1)?.date ?? null };
}

export interface ReferralMapRow {
  referral: string;
  project: string;
  verified: boolean;
}

/** Per project: 30-day volume and swaps over its verified referral tags. Unverified rows are not shown. */
export function referralsByProject(totals: ReferralTotal[], map: ReferralMapRow[]): Map<string, { usd: number; count: number; tags: string[] }> {
  const byKey = new Map(totals.map((t) => [t.key, t]));
  const out = new Map<string, { usd: number; count: number; tags: string[] }>();
  for (const r of map) {
    if (!r.verified || !r.project) continue;
    const t = byKey.get(r.referral);
    if (!t) continue;
    const v = out.get(r.project) ?? { usd: 0, count: 0, tags: [] };
    v.usd += t.usd;
    v.count += t.count;
    v.tags.push(r.referral);
    out.set(r.project, v);
  }
  return out;
}
