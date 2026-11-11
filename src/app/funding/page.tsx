import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { FundingView } from "@/components/views/funding-view";

export const metadata: Metadata = pageMeta("Funding", "/funding/");

export default function Page() {
  return <FundingView />;
}
