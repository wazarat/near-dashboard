"use client";

import { Lock } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/lib/access";
import { isGatedPath } from "@/lib/gate";
import { LOGIN_TITLE } from "./login-dialog";

/**
 * A gated page for a logged-out reader: the page stays in place, blurred and inert
 * (no clicks, no focus, hidden from assistive tech), with the login pop-up over it.
 * The URL is kept, so the page loads as soon as the reader logs in. While Clerk is
 * still loading the preview is blurred without the pop-up, so content never flashes.
 * Phase 1 gates in the browser only: the page's data is still in the bundle.
 */
export function LoginWall({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { enabled, loaded, signedIn, openLogin, loginOpen } = useAccess();
  const walled = enabled && isGatedPath(pathname) && !signedIn;
  const ready = walled && loaded;

  useEffect(() => {
    if (ready) openLogin("tab");
  }, [ready, pathname, openLogin]);

  if (!walled) return <>{children}</>;
  return (
    <div className="relative" data-testid="login-wall">
      <div inert aria-hidden className="pointer-events-none select-none blur-sm saturate-50">
        {children}
      </div>
      {ready && !loginOpen && (
        <div className="absolute inset-x-0 top-24 flex justify-center">
          <Button onClick={() => openLogin("tab")} className="gap-1.5 shadow-popover">
            <Lock className="size-3.5" /> {LOGIN_TITLE}
          </Button>
        </div>
      )}
    </div>
  );
}
