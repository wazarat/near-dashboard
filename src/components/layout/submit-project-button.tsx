"use client";

import { ExternalLink, PlusCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TALLY_SUBMIT_URL } from "@/lib/env";
import { trackSubmitProjectClick } from "@/lib/track";
import { cn } from "@/lib/utils";

/**
 * The one primary action in the header. Hidden until the Tally form URL is configured.
 * `iconOnlyBelowSm` keeps the icon and drops the words on a phone, where the lockup needs the room.
 */
export function SubmitProjectButton({ iconOnlyBelowSm, className }: { iconOnlyBelowSm?: boolean; className?: string }) {
  const pathname = usePathname();
  if (!TALLY_SUBMIT_URL) return null;
  return (
    <Button asChild size="sm" className={className}>
      <a href={TALLY_SUBMIT_URL} target="_blank" rel="noopener noreferrer" aria-label="Submit a project" data-testid="submit-project" onClick={() => trackSubmitProjectClick(pathname)}>
        <PlusCircle className={cn("size-3.5", iconOnlyBelowSm ? "sm:hidden" : "hidden")} />
        <span className={cn(iconOnlyBelowSm && "hidden sm:inline")}>Submit a project</span>
        <ExternalLink className={cn("size-3.5", iconOnlyBelowSm && "hidden sm:inline")} />
      </a>
    </Button>
  );
}
