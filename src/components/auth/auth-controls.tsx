"use client";

import { UserButton } from "@clerk/nextjs";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/lib/access";
import { AUTH_ENABLED } from "@/lib/auth-config";
import { clerkAppearance } from "@/lib/clerk-appearance";

/** Header control: "Log in" when logged out, Clerk's UserButton when logged in, nothing with the wall off. */
export function AuthControls() {
  const { enabled, loaded, signedIn, openLogin } = useAccess();
  if (!enabled) return null;
  if (!loaded) return <span aria-hidden className="inline-block size-8" />;
  // The user button needs Clerk's provider, which is only mounted when its key is set.
  if (signedIn && AUTH_ENABLED) return <UserButton appearance={clerkAppearance} />;
  return (
    <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openLogin("header")} data-testid="header-login">
      <LogIn className="size-3.5" />
      <span>Log in</span>
    </Button>
  );
}
