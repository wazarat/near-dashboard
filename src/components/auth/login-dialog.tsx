"use client";

import { Lock } from "lucide-react";
import { useEffect } from "react";
import { AtlasModal } from "@/components/atlas/atlas-modal";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAccess } from "@/lib/access";
import { useCompare } from "@/lib/compare";
import { PENDING_KEY, replayPending } from "@/lib/gate";
import { trackLoginPrompt, type LoginTrigger } from "@/lib/track";
import { cn } from "@/lib/utils";

export const LOGIN_TITLE = "Log in for free access";
export const LOGIN_LINE = "Free account. Sectors, traction, NEAR Intents, funding, investors, security and project detail for the whole NEAR and Aurora ecosystem.";

/** The two buttons, shared by the pop-up and the inline panels. They open Clerk's own sign-in and sign-up modals. */
export function LoginButtons() {
  const { signIn, signUp } = useAccess();
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={signIn}>Log in</Button>
      <Button variant="outline" onClick={signUp}>
        Create free account
      </Button>
    </div>
  );
}

/** The login pop-up, in the shared modal (Esc and backdrop close it, full-screen sheet on phones). */
export function LoginDialog() {
  const { loginOpen, setLoginOpen } = useAccess();
  return (
    <AtlasModal open={loginOpen} onOpenChange={setLoginOpen} testId="login-dialog" width="narrow" className="sm:w-[min(480px,calc(100vw-2rem))]">
      <div className="space-y-4 pr-6">
        <span className="inline-flex size-9 items-center justify-center rounded-lg border border-ink-700/60 text-electric-300" aria-hidden>
          <Lock className="size-4" />
        </span>
        <DialogTitle className="font-display text-title text-ink-50">{LOGIN_TITLE}</DialogTitle>
        <DialogDescription>{LOGIN_LINE}</DialogDescription>
        <LoginButtons />
      </div>
    </AtlasModal>
  );
}

/** One "Log in for free access" panel standing in for gated content, for example the rest of the project pop-up. */
export function LoginPanel({ className, trigger }: { className?: string; trigger: LoginTrigger }) {
  const { enabled } = useAccess();
  // Shown inline rather than as a pop-up, so it counts as a login prompt when it appears.
  useEffect(() => {
    if (enabled) trackLoginPrompt(trigger);
  }, [enabled, trigger]);
  return (
    <div data-testid="login-panel" className={cn("rounded-xl border border-ink-700/60 bg-ink-950/40 p-5", className)}>
      <p className="font-display text-base font-semibold text-ink-50">{LOGIN_TITLE}</p>
      <p className="mt-1 text-sm text-ink-300">{LOGIN_LINE}</p>
      <div className="mt-3">
        <LoginButtons />
      </div>
    </div>
  );
}

/** After sign-in, finishes the action the reader clicked before the pop-up (today, a compare selection). */
export function PendingActionReplay() {
  const { enabled, signedIn } = useAccess();
  const { ids, setUngated } = useCompare();
  useEffect(() => {
    if (!enabled || !signedIn) return;
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(PENDING_KEY);
      window.sessionStorage.removeItem(PENDING_KEY);
    } catch {
      return;
    }
    const next = replayPending(raw, ids);
    if (next) setUngated(next);
  }, [enabled, signedIn, ids, setUngated]);
  return null;
}
