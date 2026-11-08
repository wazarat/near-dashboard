import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TALLY_SUBMIT_URL } from "@/lib/env";

/** The one primary action in the header. Hidden until the Tally form URL is configured. */
export function SubmitProjectButton({ className }: { className?: string }) {
  if (!TALLY_SUBMIT_URL) return null;
  return (
    <Button asChild size="sm" className={className}>
      <a href={TALLY_SUBMIT_URL} target="_blank" rel="noopener noreferrer">
        Submit a project <ExternalLink className="size-3.5" />
      </a>
    </Button>
  );
}
