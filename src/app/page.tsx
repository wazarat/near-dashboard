import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { OverviewView } from "@/components/views/overview-view";

export const metadata: Metadata = pageMeta("Overview", "/");

export default function Page() {
  return <OverviewView />;
}
