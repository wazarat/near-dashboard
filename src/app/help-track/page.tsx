import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { HelpTrackView } from "@/components/views/help-track-view";

export const metadata: Metadata = pageMeta("Help us track this", "/help-track/");

export default function Page() {
  return <HelpTrackView />;
}
