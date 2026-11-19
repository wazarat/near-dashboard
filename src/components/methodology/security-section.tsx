"use client";

import { LoginPanel } from "@/components/auth/login-dialog";
import { SecurityView } from "@/components/views/security-view";
import { useAccess } from "@/lib/access";

/**
 * The security record (chain checklist, incidents and per-project facts), on the Methodology tab since the
 * Security tab was folded in. It stays behind the login as the Security tab was: a logged-out reader sees the
 * heading and one login panel.
 */
export function SecuritySection() {
  const full = useAccess().can({ action: "security-detail" });
  return (
    <section id="security" aria-labelledby="security-title" className="scroll-mt-24 space-y-3">
      <h2 id="security-title" className="font-display text-title text-ink-50">
        Security
      </h2>
      <p className="max-w-3xl text-sm text-ink-300">
        Audits, dated incidents and noted red flags as found, for both chains and the projects researched, without a rating.
      </p>
      {full ? <SecurityView /> : <LoginPanel trigger="tab" />}
    </section>
  );
}
