import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { IntentsView } from "@/components/views/intents-view";

export const metadata: Metadata = pageMeta("NEAR Intents", "/intents/");

export default function Page() {
  return <IntentsView />;
}
